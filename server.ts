import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import tls from 'tls';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json({ limit: '15mb' }));

const CONFIG_FILE_PATH = path.resolve(process.cwd(), '.nvea-otp-config.json');
const SAVED_FORMS_FILE_PATH = path.resolve(process.cwd(), '.nvea-saved-forms.json');

export interface SavedFormRecord {
  formId: string;
  recordNumber: string;
  applicantName: string;
  savedAt: string;
  submitted: boolean;
  submittedAt?: string;
  recordState: Record<string, unknown>;
  answers: Record<string, string | string[]>;
  uploadedFiles: Record<string, unknown[]>;
}

function loadSavedFormsMap(): Record<string, SavedFormRecord> {
  try {
    if (fs.existsSync(SAVED_FORMS_FILE_PATH)) {
      return JSON.parse(fs.readFileSync(SAVED_FORMS_FILE_PATH, 'utf8'));
    }
  } catch {
    // ignore read error
  }
  return {};
}

function writeSavedFormsMap(map: Record<string, SavedFormRecord>): void {
  try {
    fs.writeFileSync(SAVED_FORMS_FILE_PATH, JSON.stringify(map, null, 2), 'utf8');
  } catch {
    // ignore write error
  }
}

interface OtpGatewayConfig {
  googleAppsScriptUrl?: string;
  gmailUser?: string;
  gmailAppPassword?: string;
  whatsappAccessToken?: string;
  whatsappPhoneNumberId?: string;
}

function loadOtpConfig(): OtpGatewayConfig {
  let fileConfig: OtpGatewayConfig = {};
  try {
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      fileConfig = JSON.parse(fs.readFileSync(CONFIG_FILE_PATH, 'utf8'));
    }
  } catch {
    // ignore read error
  }
  return {
    googleAppsScriptUrl:
      fileConfig.googleAppsScriptUrl || process.env.GOOGLE_APPS_SCRIPT_WEBHOOK_URL || '',
    gmailUser: fileConfig.gmailUser || process.env.GMAIL_USER || 'nveaofficial@gmail.com',
    gmailAppPassword: fileConfig.gmailAppPassword || process.env.GMAIL_APP_PASSWORD || '',
    whatsappAccessToken:
      fileConfig.whatsappAccessToken || process.env.WHATSAPP_ACCESS_TOKEN || '',
    whatsappPhoneNumberId:
      fileConfig.whatsappPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  };
}

function saveOtpConfig(nextConfig: Partial<OtpGatewayConfig>): OtpGatewayConfig {
  const current = loadOtpConfig();
  const merged: OtpGatewayConfig = {
    ...current,
    ...nextConfig,
  };
  try {
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(merged, null, 2), 'utf8');
  } catch {
    // ignore write error
  }
  return merged;
}

interface StoredOtpRecord {
  otpHash: string;
  salt: string;
  contact: string;
  channel: 'gmail' | 'whatsapp';
  recordNumber: string;
  createdAt: number;
  expiresAt: number;
  attempts: number;
  maxAttempts: number;
  used: boolean;
}

// Server-side in-memory store for active OTP records (keyed by `${recordNumber}:${contact.toLowerCase()}`)
const otpStore = new Map<string, StoredOtpRecord>();
const rateLimitStore = new Map<string, number>();

function hashOtp(otp: string, salt: string): string {
  return crypto.createHmac('sha256', salt).update(otp).digest('hex');
}

/**
 * Native TLS SMTP sender for smtp.gmail.com:465 when Gmail App Password is provided
 */
async function sendViaGmailSmtp(
  gmailUser: string,
  gmailAppPassword: string,
  toEmail: string,
  subject: string,
  htmlBody: string
): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    const cleanPass = gmailAppPassword.replace(/\s+/g, '');
    const socket = tls.connect(465, 'smtp.gmail.com', { rejectUnauthorized: true });
    let step = 0;
    let buffer = '';

    const timeout = setTimeout(() => {
      socket.destroy();
      resolve({ ok: false, error: 'Gmail SMTP connection timed out.' });
    }, 12000);

    const sendLine = (line: string) => {
      socket.write(line + '\r\n');
    };

    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      if (!buffer.endsWith('\r\n')) return;
      const lines = buffer.trim().split('\r\n');
      buffer = '';
      const lastLine = lines[lines.length - 1] || '';
      const code = parseInt(lastLine.slice(0, 3), 10);

      if (code >= 400) {
        clearTimeout(timeout);
        socket.end();
        resolve({ ok: false, error: `SMTP Error: ${lastLine}` });
        return;
      }

      if (step === 0 && code === 220) {
        step = 1;
        sendLine('EHLO nvea.in');
      } else if (step === 1 && code === 250) {
        step = 2;
        sendLine('AUTH LOGIN');
      } else if (step === 2 && code === 334) {
        step = 3;
        sendLine(Buffer.from(gmailUser, 'utf8').toString('base64'));
      } else if (step === 3 && code === 334) {
        step = 4;
        sendLine(Buffer.from(cleanPass, 'utf8').toString('base64'));
      } else if (step === 4 && code === 235) {
        step = 5;
        sendLine(`MAIL FROM:<${gmailUser}>`);
      } else if (step === 5 && code === 250) {
        step = 6;
        sendLine(`RCPT TO:<${toEmail}>`);
      } else if (step === 6 && code === 250) {
        step = 7;
        sendLine('DATA');
      } else if (step === 7 && code === 354) {
        step = 8;
        const message = [
          `From: "NVEA Admission Portal" <${gmailUser}>`,
          `To: <${toEmail}>`,
          `Subject: ${subject}`,
          'MIME-Version: 1.0',
          'Content-Type: text/html; charset=UTF-8',
          '',
          htmlBody,
          '.',
        ].join('\r\n');
        sendLine(message);
      } else if (step === 8 && code === 250) {
        step = 9;
        sendLine('QUIT');
        clearTimeout(timeout);
        socket.end();
        resolve({ ok: true });
      }
    });

    socket.on('error', (err) => {
      clearTimeout(timeout);
      resolve({ ok: false, error: err.message });
    });
  });
}

// 1. Check genuinely configured OTP delivery channels
app.get('/api/otp/status', (_req, res) => {
  const cfg = loadOtpConfig();
  const gmailGasConfigured = Boolean(
    cfg.googleAppsScriptUrl &&
      cfg.googleAppsScriptUrl.startsWith('https://script.google.com/macros/s/')
  );
  const gmailSmtpConfigured = Boolean(cfg.gmailUser && cfg.gmailAppPassword);
  const whatsappConfigured = Boolean(cfg.whatsappAccessToken && cfg.whatsappPhoneNumberId);

  res.json({
    gmailReady: gmailGasConfigured || gmailSmtpConfigured,
    gmailMethod: gmailGasConfigured
      ? 'google_apps_script'
      : gmailSmtpConfigured
      ? 'gmail_smtp'
      : 'unconfigured',
    whatsappReady: whatsappConfigured,
    googleAppsScriptUrl: cfg.googleAppsScriptUrl || '',
    gmailUser: cfg.gmailUser || 'nveaofficial@gmail.com',
    hasGmailAppPassword: Boolean(cfg.gmailAppPassword),
  });
});

// 2. Save Google Apps Script Web App URL or Gmail App Password configuration
app.post('/api/otp/config', (req, res) => {
  const {
    googleAppsScriptUrl,
    gmailUser,
    gmailAppPassword,
    whatsappAccessToken,
    whatsappPhoneNumberId,
  } = req.body || {};

  const updated = saveOtpConfig({
    ...(typeof googleAppsScriptUrl === 'string'
      ? { googleAppsScriptUrl: googleAppsScriptUrl.trim() }
      : {}),
    ...(typeof gmailUser === 'string' ? { gmailUser: gmailUser.trim() } : {}),
    ...(typeof gmailAppPassword === 'string'
      ? { gmailAppPassword: gmailAppPassword.trim() }
      : {}),
    ...(typeof whatsappAccessToken === 'string'
      ? { whatsappAccessToken: whatsappAccessToken.trim() }
      : {}),
    ...(typeof whatsappPhoneNumberId === 'string'
      ? { whatsappPhoneNumberId: whatsappPhoneNumberId.trim() }
      : {}),
  });

  const gmailGasConfigured = Boolean(
    updated.googleAppsScriptUrl &&
      updated.googleAppsScriptUrl.startsWith('https://script.google.com/macros/s/')
  );
  const gmailSmtpConfigured = Boolean(updated.gmailUser && updated.gmailAppPassword);
  const whatsappConfigured = Boolean(
    updated.whatsappAccessToken && updated.whatsappPhoneNumberId
  );

  res.json({
    ok: true,
    gmailReady: gmailGasConfigured || gmailSmtpConfigured,
    gmailMethod: gmailGasConfigured
      ? 'google_apps_script'
      : gmailSmtpConfigured
      ? 'gmail_smtp'
      : 'unconfigured',
    whatsappReady: whatsappConfigured,
    googleAppsScriptUrl: updated.googleAppsScriptUrl || '',
    gmailUser: updated.gmailUser || 'nveaofficial@gmail.com',
  });
});

// 3. Server-side OTP Generation & Genuine Delivery
app.post('/api/otp/send', async (req, res) => {
  try {
    const { channel = 'gmail', contact = '', recordNumber = '', applicantName = '' } =
      req.body || {};
    const cleanContact = String(contact).trim();
    const cleanRecord = String(recordNumber).trim() || 'NVEA_DEFAULT';

    if (!cleanContact) {
      return res.status(400).json({
        ok: false,
        error: 'Please enter a valid recipient Email Address or contact identifier.',
      });
    }

    // Rate limiting check (25 seconds cooldown per record + contact)
    const key = `${cleanRecord}:${cleanContact.toLowerCase()}`;
    const lastSent = rateLimitStore.get(key) || 0;
    const now = Date.now();
    if (now - lastSent < 25000) {
      const waitSec = Math.ceil((25000 - (now - lastSent)) / 1000);
      return res.status(429).json({
        ok: false,
        error: `Please wait ${waitSec} seconds before requesting a new OTP.`,
      });
    }

    const cfg = loadOtpConfig();

    // Generate cryptographically random 6-digit OTP server-side
    const otpCode = String(crypto.randomInt(100000, 1000000));
    const salt = crypto.randomBytes(16).toString('hex');
    const otpHash = hashOtp(otpCode, salt);
    const expiresAt = now + 5 * 60 * 1000; // 5 minutes validity

    if (channel === 'gmail') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanContact)) {
        return res.status(400).json({
          ok: false,
          error: 'Please enter a valid Gmail / Email address (e.g., applicant@gmail.com).',
        });
      }

      const subject = `NVEA Official Consent Verification OTP - Record ${cleanRecord}`;
      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; border: 2px solid #0F2942; border-radius: 4px; overflow: hidden;">
          <div style="background-color: #0F2942; color: #FFFFFF; padding: 14px 18px; border-bottom: 3px solid #D97706;">
            <h2 style="margin: 0; font-size: 16px;">NAND VIDHYA EDUCATION ACADEMY (NVEA / नव्या)</h2>
            <p style="margin: 4px 0 0; font-size: 12px; color: #E2E8F0;">Official Admission &amp; Consent Verification Portal</p>
          </div>
          <div style="padding: 20px; color: #0F172A; background-color: #FFFFFF;">
            <p style="margin: 0 0 10px; font-size: 14px;">Dear <strong>${applicantName || 'Applicant'}</strong>,</p>
            <p style="margin: 0 0 14px; font-size: 13px; line-height: 1.5;">
              Your One-Time Password (OTP) for Point 171 — <strong>Consent Verification &amp; Approval</strong> for NVEA Admission Record <strong>${cleanRecord}</strong> is:
            </p>
            <div style="background-color: #F8FAFC; border: 2px dashed #1E3A8A; padding: 14px; text-align: center; margin: 16px 0;">
              <span style="font-family: monospace; font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #991B1B;">${otpCode}</span>
            </div>
            <p style="margin: 0 0 8px; font-size: 12px; color: #475569;">
              • This OTP is valid for <strong>5 minutes</strong> and is <strong>single-use only</strong>.<br/>
              • Do not share this OTP with any unauthorized person.
            </p>
          </div>
          <div style="background-color: #F1F5F9; padding: 10px 18px; font-size: 11px; color: #475569; border-top: 1px solid #CBD5E1;">
            NVEA Official Portal: https://www.nvea.in/ • Helpline: 09414008310
          </div>
        </div>
      `;

      // Delivery Path A: Google Apps Script Web App (Primary Google-native method)
      if (
        cfg.googleAppsScriptUrl &&
        cfg.googleAppsScriptUrl.startsWith('https://script.google.com/macros/s/')
      ) {
        const gasRes = await fetch(cfg.googleAppsScriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'send_otp_from_server',
            to: cleanContact,
            subject,
            htmlBody,
            otp: otpCode,
            recordNumber: cleanRecord,
            applicantName: applicantName || 'Applicant',
          }),
          redirect: 'follow',
        });

        const gasText = await gasRes.text();
        let gasData: { ok?: boolean; error?: string } = {};
        try {
          gasData = JSON.parse(gasText);
        } catch {
          // If Google Apps Script returned HTML error page
          if (!gasRes.ok || gasText.includes('<!DOCTYPE html>')) {
            return res.status(502).json({
              ok: false,
              error:
                'Google Apps Script Web App returned an authorization or deployment page. Please ensure the Web App is deployed with "Execute as: Me" and "Who has access: Anyone".',
            });
          }
        }

        if (gasData.ok === false) {
          return res.status(502).json({
            ok: false,
            error: gasData.error || 'Google Apps Script failed to send the email.',
          });
        }

        otpStore.set(key, {
          otpHash,
          salt,
          contact: cleanContact,
          channel: 'gmail',
          recordNumber: cleanRecord,
          createdAt: now,
          expiresAt,
          attempts: 0,
          maxAttempts: 5,
          used: false,
        });
        rateLimitStore.set(key, now);

        return res.json({
          ok: true,
          delivered: true,
          channel: 'gmail',
          method: 'google_apps_script',
          maskedContact: cleanContact,
          expiresInSeconds: 300,
        });
      }

      // Delivery Path B: Gmail SMTP with App Password
      if (cfg.gmailUser && cfg.gmailAppPassword) {
        const smtpResult = await sendViaGmailSmtp(
          cfg.gmailUser,
          cfg.gmailAppPassword,
          cleanContact,
          subject,
          htmlBody
        );

        if (!smtpResult.ok) {
          return res.status(502).json({
            ok: false,
            error: `Gmail SMTP delivery failed: ${smtpResult.error}`,
          });
        }

        otpStore.set(key, {
          otpHash,
          salt,
          contact: cleanContact,
          channel: 'gmail',
          recordNumber: cleanRecord,
          createdAt: now,
          expiresAt,
          attempts: 0,
          maxAttempts: 5,
          used: false,
        });
        rateLimitStore.set(key, now);

        return res.json({
          ok: true,
          delivered: true,
          channel: 'gmail',
          method: 'gmail_smtp',
          maskedContact: cleanContact,
          expiresInSeconds: 300,
        });
      }

      return res.status(412).json({
        ok: false,
        delivered: false,
        code: 'GMAIL_NOT_CONFIGURED',
        error:
          'Official Gmail OTP gateway is not linked yet. Please complete the 1-minute Google Apps Script Web App setup (or enter a Gmail App Password) in the Gateway Setup panel below so the server can genuinely deliver the OTP email.',
      });
    }

    if (channel === 'whatsapp') {
      if (!cfg.whatsappAccessToken || !cfg.whatsappPhoneNumberId) {
        return res.status(412).json({
          ok: false,
          delivered: false,
          code: 'WHATSAPP_NOT_CONFIGURED',
          error:
            'WhatsApp Official Cloud API credentials are not configured on the server. An HTML page cannot send a private WhatsApp OTP message without an official WhatsApp Business API gateway. Please switch to the Official Gmail OTP channel.',
        });
      }

      const digitsOnly = cleanContact.replace(/\D/g, '');
      if (digitsOnly.length < 10) {
        return res.status(400).json({
          ok: false,
          error: 'Please enter a valid WhatsApp mobile number with country code (e.g. 919414008310).',
        });
      }

      const waRes = await fetch(
        `https://graph.facebook.com/v19.0/${cfg.whatsappPhoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cfg.whatsappAccessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: digitsOnly,
            type: 'text',
            text: {
              body: `NVEA Official Consent Verification OTP for Record ${cleanRecord}: ${otpCode}. Valid for 5 minutes. Do not share.`,
            },
          }),
        }
      );

      if (!waRes.ok) {
        const errData = await waRes.json().catch(() => ({}));
        return res.status(502).json({
          ok: false,
          delivered: false,
          error:
            errData?.error?.message ||
            'WhatsApp Cloud API failed to deliver the OTP message.',
        });
      }

      otpStore.set(key, {
        otpHash,
        salt,
        contact: cleanContact,
        channel: 'whatsapp',
        recordNumber: cleanRecord,
        createdAt: now,
        expiresAt,
        attempts: 0,
        maxAttempts: 5,
        used: false,
      });
      rateLimitStore.set(key, now);

      return res.json({
        ok: true,
        delivered: true,
        channel: 'whatsapp',
        method: 'whatsapp_cloud_api',
        maskedContact: cleanContact,
        expiresInSeconds: 300,
      });
    }

    return res.status(400).json({
      ok: false,
      error: 'Unsupported verification channel.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error while sending OTP';
    return res.status(500).json({
      ok: false,
      error: message,
    });
  }
});

// 4. Server-side OTP Verification (Time-limited, Single-use, Brute-force protected)
app.post('/api/otp/verify', (req, res) => {
  const { contact = '', recordNumber = '', otp = '' } = req.body || {};
  const cleanContact = String(contact).trim();
  const cleanRecord = String(recordNumber).trim() || 'NVEA_DEFAULT';
  const cleanOtp = String(otp).trim();

  if (!cleanContact || !cleanOtp) {
    return res.status(400).json({
      ok: false,
      verified: false,
      error: 'Please provide both recipient contact and the 6-digit OTP.',
    });
  }

  const key = `${cleanRecord}:${cleanContact.toLowerCase()}`;
  const record = otpStore.get(key);

  if (!record) {
    return res.status(400).json({
      ok: false,
      verified: false,
      error: 'No active OTP found for this contact and record. Please request a new OTP.',
    });
  }

  if (record.used) {
    return res.status(400).json({
      ok: false,
      verified: false,
      error: 'This OTP has already been used. Please request a new OTP.',
    });
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(key);
    return res.status(400).json({
      ok: false,
      verified: false,
      error: 'This OTP has expired (5-minute limit exceeded). Please request a new OTP.',
    });
  }

  if (record.attempts >= record.maxAttempts) {
    otpStore.delete(key);
    return res.status(429).json({
      ok: false,
      verified: false,
      error:
        'Maximum failed verification attempts (5) exceeded. This OTP has been invalidated. Please request a new OTP.',
    });
  }

  record.attempts += 1;
  const candidateHash = hashOtp(cleanOtp, record.salt);
  const isMatch =
    candidateHash.length === record.otpHash.length &&
    crypto.timingSafeEqual(Buffer.from(candidateHash), Buffer.from(record.otpHash));

  if (!isMatch) {
    const remaining = record.maxAttempts - record.attempts;
    if (remaining <= 0) {
      otpStore.delete(key);
      return res.status(400).json({
        ok: false,
        verified: false,
        error:
          'Incorrect OTP. Maximum attempts reached; this OTP is now invalid. Please request a new OTP.',
      });
    }
    return res.status(400).json({
      ok: false,
      verified: false,
      error: `Incorrect OTP entered. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before lockout.`,
    });
  }

  // Mark OTP as used and delete from active store so it can never be reused
  record.used = true;
  otpStore.delete(key);

  const verifiedAt = new Date().toISOString();
  const verificationToken = crypto
    .createHash('sha256')
    .update(`${cleanRecord}:${cleanContact}:${verifiedAt}:${record.salt}`)
    .digest('hex')
    .slice(0, 16)
    .toUpperCase();

  return res.json({
    ok: true,
    verified: true,
    statusText: 'Consent Verified / Approved',
    verifiedContact: cleanContact,
    verifiedChannel: record.channel,
    verifiedAt,
    verificationId: `NVEA-OTP-${verificationToken}`,
  });
});

// 5. Save Form State for Reopening Later & Shareable Form Links (Requirement 1)
app.post('/api/forms/save', (req, res) => {
  try {
    const {
      formId,
      recordNumber,
      applicantName = '',
      submitted = false,
      submittedAt,
      recordState = {},
      answers = {},
      uploadedFiles = {},
    } = req.body || {};

    const cleanId = String(formId || recordNumber || '').trim();
    if (!cleanId) {
      return res.status(400).json({ ok: false, error: 'Missing formId / recordNumber' });
    }

    const savedAt = new Date().toISOString();
    const map = loadSavedFormsMap();
    map[cleanId] = {
      formId: cleanId,
      recordNumber: String(recordNumber || cleanId),
      applicantName: String(applicantName || answers?.q2 || 'Applicant'),
      savedAt,
      submitted: Boolean(submitted),
      submittedAt: submittedAt ? String(submittedAt) : undefined,
      recordState,
      answers,
      uploadedFiles,
    };
    writeSavedFormsMap(map);

    return res.json({
      ok: true,
      formId: cleanId,
      recordNumber: map[cleanId].recordNumber,
      savedAt,
    });
  } catch (err: unknown) {
    return res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to save form on server',
    });
  }
});

app.get('/api/forms/list', (_req, res) => {
  const map = loadSavedFormsMap();
  const list = Object.values(map)
    .map((item) => ({
      formId: item.formId,
      recordNumber: item.recordNumber,
      applicantName: item.applicantName,
      savedAt: item.savedAt,
      submitted: item.submitted,
      submittedAt: item.submittedAt,
    }))
    .sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));

  return res.json({ ok: true, forms: list });
});

app.get('/api/forms/:formId', (req, res) => {
  const cleanId = String(req.params.formId || '').trim();
  const map = loadSavedFormsMap();
  const found = map[cleanId];
  if (!found) {
    return res.status(404).json({ ok: false, error: 'Saved form not found.' });
  }
  return res.json({ ok: true, form: found });
});

app.delete('/api/forms/:formId', (req, res) => {
  const cleanId = String(req.params.formId || '').trim();
  const map = loadSavedFormsMap();
  if (map[cleanId]) {
    delete map[cleanId];
    writeSavedFormsMap(map);
  }
  return res.json({ ok: true });
});

async function startServer() {
  const PORT = 3000;
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NVEA Full-Stack Admission Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
