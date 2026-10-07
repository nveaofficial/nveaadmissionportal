import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import tls from 'tls';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json({ limit: '15mb' }));

const SERVER_DATA_DIR = path.resolve(process.cwd(), 'server-data');
try {
  if (!fs.existsSync(SERVER_DATA_DIR)) {
    fs.mkdirSync(SERVER_DATA_DIR, { recursive: true });
  }
} catch {
  // ignore mkdir error
}

const CONFIG_FILE_PATH = path.resolve(process.cwd(), '.nvea-otp-config.json');
const PERSISTENT_CONFIG_FILE_PATH = path.resolve(SERVER_DATA_DIR, 'nvea-otp-config.json');
const SAVED_FORMS_FILE_PATH = path.resolve(process.cwd(), '.nvea-saved-forms.json');
const PERSISTENT_SAVED_FORMS_PATH = path.resolve(SERVER_DATA_DIR, 'nvea-saved-forms.json');
const VERIFICATIONS_FILE_PATH = path.resolve(SERVER_DATA_DIR, 'nvea-otp-verifications.json');

export interface OtpVerificationRecordServer {
  recordNumber: string;
  verificationId: string;
  applicantName: string;
  srNumber: string;
  registrationNumber: string;
  rollNumber: string;
  enrollmentNumber: string;
  admissionDate: string;
  courseClass: string;
  interviewSerialNumber?: string;
  verificationStatus: 'OTP VERIFIED' | 'ADMISSION CONFIRMED (OTP VERIFIED)';
  verifiedAt: string;
  verifiedContact?: string;
  verifiedChannel?: string;
  confirmationEmailSent?: boolean;
  seventeenPoints?: Array<{ pointNumber: number; label: string; value: string }>;
  summaryIdentifiers?: Array<{ label: string; value: string }>;
}

function loadVerificationsMap(): Record<string, OtpVerificationRecordServer> {
  try {
    if (fs.existsSync(VERIFICATIONS_FILE_PATH)) {
      return JSON.parse(fs.readFileSync(VERIFICATIONS_FILE_PATH, 'utf8'));
    }
  } catch {
    // ignore read error
  }
  return {};
}

function writeVerificationsMap(map: Record<string, OtpVerificationRecordServer>): void {
  try {
    fs.writeFileSync(VERIFICATIONS_FILE_PATH, JSON.stringify(map, null, 2), 'utf8');
  } catch {
    // ignore write error
  }
}

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
  otpVerification?: OtpVerificationRecordServer;
}

function loadSavedFormsMap(): Record<string, SavedFormRecord> {
  try {
    if (fs.existsSync(PERSISTENT_SAVED_FORMS_PATH)) {
      return JSON.parse(fs.readFileSync(PERSISTENT_SAVED_FORMS_PATH, 'utf8'));
    }
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
    const serialized = JSON.stringify(map, null, 2);
    fs.writeFileSync(PERSISTENT_SAVED_FORMS_PATH, serialized, 'utf8');
    fs.writeFileSync(SAVED_FORMS_FILE_PATH, serialized, 'utf8');
  } catch {
    // ignore write error
  }
}

interface OtpGatewayConfig {
  oauthAccessToken?: string;
  googleAppsScriptUrl?: string;
  gmailUser?: string;
  gmailAppPassword?: string;
  whatsappAccessToken?: string;
  whatsappPhoneNumberId?: string;
  connectedAt?: string;
  connectionExpired?: boolean;
}

function loadOtpConfig(): OtpGatewayConfig {
  let fileConfig: OtpGatewayConfig = {};
  try {
    if (fs.existsSync(PERSISTENT_CONFIG_FILE_PATH)) {
      fileConfig = JSON.parse(fs.readFileSync(PERSISTENT_CONFIG_FILE_PATH, 'utf8'));
    } else if (fs.existsSync(CONFIG_FILE_PATH)) {
      fileConfig = JSON.parse(fs.readFileSync(CONFIG_FILE_PATH, 'utf8'));
    }
  } catch {
    // ignore read error
  }
  return {
    oauthAccessToken: fileConfig.oauthAccessToken || '',
    googleAppsScriptUrl:
      fileConfig.googleAppsScriptUrl || process.env.GOOGLE_APPS_SCRIPT_WEBHOOK_URL || '',
    gmailUser: fileConfig.gmailUser || process.env.GMAIL_USER || 'nveaofficial@gmail.com',
    gmailAppPassword: fileConfig.gmailAppPassword || process.env.GMAIL_APP_PASSWORD || '',
    whatsappAccessToken:
      fileConfig.whatsappAccessToken || process.env.WHATSAPP_ACCESS_TOKEN || '',
    whatsappPhoneNumberId:
      fileConfig.whatsappPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    connectedAt: fileConfig.connectedAt || '',
    connectionExpired: Boolean(fileConfig.connectionExpired),
  };
}

function saveOtpConfig(nextConfig: Partial<OtpGatewayConfig>): OtpGatewayConfig {
  const current = loadOtpConfig();
  const merged: OtpGatewayConfig = {
    ...current,
    ...nextConfig,
  };
  try {
    const serialized = JSON.stringify(merged, null, 2);
    fs.writeFileSync(PERSISTENT_CONFIG_FILE_PATH, serialized, 'utf8');
    fs.writeFileSync(CONFIG_FILE_PATH, serialized, 'utf8');
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

/**
 * Direct Gmail REST API v1 sender using persistent OAuth 2.0 Bearer token
 */
async function sendViaGmailOAuthApi(
  accessToken: string,
  fromEmail: string,
  toEmail: string,
  subject: string,
  htmlBody: string
): Promise<{ ok: boolean; expired?: boolean; error?: string }> {
  try {
    const utf8Subject = `=?utf-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;
    const mimeLines = [
      `From: "NVEA Admission Portal" <${fromEmail || 'nveaofficial@gmail.com'}>`,
      `To: <${toEmail}>`,
      `Subject: ${utf8Subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
      '',
      htmlBody,
    ].join('\r\n');

    const raw = Buffer.from(mimeLines, 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    });

    if (res.ok) {
      return { ok: true };
    }
    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        expired: true,
        error: 'Gmail OAuth session expired. Please click "Reconnect Gmail".',
      };
    }
    const errText = await res.text();
    return { ok: false, error: `Gmail API error (${res.status}): ${errText}` };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to send via Gmail API',
    };
  }
}

/**
 * Unified server-side Gmail dispatcher that tries:
 * 1. Google Apps Script Web App (permanent non-expiring Google relay)
 * 2. Official Gmail OAuth 2.0 API token
 * 3. Gmail SMTP App Password
 */
async function deliverOfficialGmailMessage(params: {
  toEmail: string;
  subject: string;
  htmlBody: string;
  otpCode?: string;
  recordNumber?: string;
  applicantName?: string;
  clientGasUrl?: string;
  clientAccessToken?: string;
}): Promise<{
  ok: boolean;
  method?: string;
  code?: string;
  error?: string;
}> {
  let cfg = loadOtpConfig();

  // Persist any valid Google Apps Script URL or OAuth token sent by the client
  const updates: Partial<OtpGatewayConfig> = {};
  if (
    !cfg.googleAppsScriptUrl &&
    params.clientGasUrl &&
    params.clientGasUrl.trim().startsWith('https://script.google.com/macros/s/')
  ) {
    updates.googleAppsScriptUrl = params.clientGasUrl.trim();
    updates.connectionExpired = false;
    updates.connectedAt = new Date().toISOString();
  }
  if (params.clientAccessToken && params.clientAccessToken.trim()) {
    updates.oauthAccessToken = params.clientAccessToken.trim();
    updates.connectionExpired = false;
    updates.connectedAt = new Date().toISOString();
  }
  if (Object.keys(updates).length > 0) {
    cfg = saveOtpConfig(updates);
  }

  let lastError = '';
  let expiredDetected = false;

  // Path 1: Google Apps Script Web App (Permanent, never expires)
  if (
    cfg.googleAppsScriptUrl &&
    cfg.googleAppsScriptUrl.startsWith('https://script.google.com/macros/s/')
  ) {
    try {
      const gasRes = await fetch(cfg.googleAppsScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_otp_from_server',
          to: params.toEmail,
          subject: params.subject,
          htmlBody: params.htmlBody,
          otp: params.otpCode || '',
          recordNumber: params.recordNumber || '',
          applicantName: params.applicantName || 'Applicant',
        }),
        redirect: 'follow',
      });
      const gasText = await gasRes.text();
      let gasData: { ok?: boolean; error?: string } = {};
      try {
        gasData = JSON.parse(gasText);
      } catch {
        // non-JSON response
      }
      if (gasRes.ok && !gasText.includes('<!DOCTYPE html>') && gasData.ok !== false) {
        if (cfg.connectionExpired) {
          saveOtpConfig({ connectionExpired: false });
        }
        return { ok: true, method: 'google_apps_script' };
      }
      lastError = gasData.error || 'Google Apps Script relay needs re-authorization.';
    } catch (e: unknown) {
      lastError = e instanceof Error ? e.message : 'Google Apps Script request failed.';
    }
  }

  // Path 2: Gmail REST API v1 via OAuth Access Token
  const activeOAuthToken = cfg.oauthAccessToken || '';
  if (activeOAuthToken) {
    const oauthResult = await sendViaGmailOAuthApi(
      activeOAuthToken,
      cfg.gmailUser || 'nveaofficial@gmail.com',
      params.toEmail,
      params.subject,
      params.htmlBody
    );
    if (oauthResult.ok) {
      if (cfg.connectionExpired) {
        saveOtpConfig({ connectionExpired: false });
      }
      return { ok: true, method: 'gmail_oauth' };
    }
    if (oauthResult.expired) {
      expiredDetected = true;
    }
    lastError = oauthResult.error || lastError;
  }

  // Path 3: Gmail SMTP with App Password
  if (cfg.gmailUser && cfg.gmailAppPassword) {
    const smtpResult = await sendViaGmailSmtp(
      cfg.gmailUser,
      cfg.gmailAppPassword,
      params.toEmail,
      params.subject,
      params.htmlBody
    );
    if (smtpResult.ok) {
      if (cfg.connectionExpired) {
        saveOtpConfig({ connectionExpired: false });
      }
      return { ok: true, method: 'gmail_smtp' };
    }
    lastError = smtpResult.error || lastError;
  }

  if (expiredDetected) {
    saveOtpConfig({ connectionExpired: true });
    return {
      ok: false,
      code: 'GMAIL_RECONNECT_REQUIRED',
      error: 'Official Gmail session expired. Please click "Reconnect Gmail" once to refresh.',
    };
  }

  if (lastError) {
    return {
      ok: false,
      code: 'GMAIL_RECONNECT_REQUIRED',
      error: lastError,
    };
  }

  return {
    ok: false,
    code: 'GMAIL_NOT_CONFIGURED',
    error: 'Please click "Connect Official Gmail OTP Gateway" once in the top admin bar.',
  };
}

// 1. Check genuinely configured OTP delivery channels (Never exposes passwords or credentials)
app.get('/api/otp/status', (_req, res) => {
  const cfg = loadOtpConfig();
  const gmailGasConfigured = Boolean(
    cfg.googleAppsScriptUrl &&
      cfg.googleAppsScriptUrl.startsWith('https://script.google.com/macros/s/')
  );
  const gmailOAuthConfigured = Boolean(cfg.oauthAccessToken);
  const gmailSmtpConfigured = Boolean(cfg.gmailUser && cfg.gmailAppPassword);
  const whatsappConfigured = Boolean(cfg.whatsappAccessToken && cfg.whatsappPhoneNumberId);
  const anyGmailConfigured = gmailGasConfigured || gmailOAuthConfigured || gmailSmtpConfigured;
  const gmailReady = anyGmailConfigured && (!cfg.connectionExpired || gmailGasConfigured);

  res.json({
    gmailReady,
    gmailConnectedEver: anyGmailConfigured,
    connectionExpired: Boolean(cfg.connectionExpired && !gmailGasConfigured),
    gmailMethod: gmailGasConfigured
      ? 'google_apps_script'
      : gmailOAuthConfigured
      ? 'gmail_oauth'
      : gmailSmtpConfigured
      ? 'gmail_smtp'
      : 'unconfigured',
    whatsappReady: whatsappConfigured,
    gmailUser: cfg.gmailUser || 'nveaofficial@gmail.com',
    connectedAt: cfg.connectedAt || '',
  });
});

// 2. Save One-Time Persistent Official Gmail OTP Gateway configuration on backend
app.post('/api/otp/config', (req, res) => {
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  const {
    oauthAccessToken,
    googleAppsScriptUrl,
    gmailUser,
    gmailAppPassword,
    whatsappAccessToken,
    whatsappPhoneNumberId,
  } = req.body || {};

  const effectiveToken =
    (typeof oauthAccessToken === 'string' && oauthAccessToken.trim()) || bearerToken || '';

  const updated = saveOtpConfig({
    ...(effectiveToken ? { oauthAccessToken: effectiveToken } : {}),
    ...(typeof googleAppsScriptUrl === 'string' && googleAppsScriptUrl.trim()
      ? { googleAppsScriptUrl: googleAppsScriptUrl.trim() }
      : {}),
    ...(typeof gmailUser === 'string' && gmailUser.trim()
      ? { gmailUser: gmailUser.trim() }
      : {}),
    ...(typeof gmailAppPassword === 'string' && gmailAppPassword.trim()
      ? { gmailAppPassword: gmailAppPassword.trim() }
      : {}),
    ...(typeof whatsappAccessToken === 'string' && whatsappAccessToken.trim()
      ? { whatsappAccessToken: whatsappAccessToken.trim() }
      : {}),
    ...(typeof whatsappPhoneNumberId === 'string' && whatsappPhoneNumberId.trim()
      ? { whatsappPhoneNumberId: whatsappPhoneNumberId.trim() }
      : {}),
    connectedAt: new Date().toISOString(),
    connectionExpired: false,
  });

  const gmailGasConfigured = Boolean(
    updated.googleAppsScriptUrl &&
      updated.googleAppsScriptUrl.startsWith('https://script.google.com/macros/s/')
  );
  const gmailOAuthConfigured = Boolean(updated.oauthAccessToken);
  const gmailSmtpConfigured = Boolean(updated.gmailUser && updated.gmailAppPassword);
  const whatsappConfigured = Boolean(
    updated.whatsappAccessToken && updated.whatsappPhoneNumberId
  );

  res.json({
    ok: true,
    gmailReady: gmailGasConfigured || gmailOAuthConfigured || gmailSmtpConfigured,
    gmailConnectedEver: gmailGasConfigured || gmailOAuthConfigured || gmailSmtpConfigured,
    connectionExpired: false,
    gmailMethod: gmailGasConfigured
      ? 'google_apps_script'
      : gmailOAuthConfigured
      ? 'gmail_oauth'
      : gmailSmtpConfigured
      ? 'gmail_smtp'
      : 'unconfigured',
    whatsappReady: whatsappConfigured,
    gmailUser: updated.gmailUser || 'nveaofficial@gmail.com',
    connectedAt: updated.connectedAt || new Date().toISOString(),
  });
});

// 3. Server-side OTP Generation & Genuine Delivery
app.post('/api/otp/send', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

    const {
      channel = 'gmail',
      contact = '',
      recordNumber = '',
      applicantName = '',
      clientGasUrl = '',
      oauthAccessToken = '',
    } = req.body || {};
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
              Your One-Time Password (OTP) for Point 174 — <strong>Consent Verification &amp; Approval</strong> for NVEA Admission Record <strong>${cleanRecord}</strong> is:
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

      const delivery = await deliverOfficialGmailMessage({
        toEmail: cleanContact,
        subject,
        htmlBody,
        otpCode,
        recordNumber: cleanRecord,
        applicantName: applicantName || 'Applicant',
        clientGasUrl: typeof clientGasUrl === 'string' ? clientGasUrl : '',
        clientAccessToken:
          (typeof oauthAccessToken === 'string' && oauthAccessToken) || bearerToken,
      });

      if (delivery.ok) {
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
          method: delivery.method,
          maskedContact: cleanContact,
          expiresInSeconds: 300,
        });
      }

      return res.status(delivery.code === 'GMAIL_NOT_CONFIGURED' ? 412 : 502).json({
        ok: false,
        delivered: false,
        code: delivery.code || 'GMAIL_RECONNECT_REQUIRED',
        error: delivery.error,
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

// 4. Server-side OTP Verification (Time-limited, Single-use, Brute-force protected + Automatic 17-Point Confirmation Email)
app.post('/api/otp/verify', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  const {
    contact = '',
    recordNumber = '',
    otp = '',
    applicantName = '',
    srNumber = '',
    registrationNumber = '',
    rollNumber = '',
    enrollmentNumber = '',
    admissionDate = '',
    courseClass = '',
    interviewSerialNumber = '',
    seventeenPoints = [],
    summaryIdentifiers = [],
    clientGasUrl = '',
    oauthAccessToken = '',
  } = req.body || {};
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

  const nowDate = new Date();
  const verifiedAt = nowDate.toISOString();
  const dateIst = nowDate.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeIst =
    nowDate.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }) + ' IST';

  const formattedAdmissionDate = String(admissionDate || '').trim() || dateIst;

  const verificationToken = crypto
    .createHash('sha256')
    .update(`${cleanRecord}:${cleanContact}:${verifiedAt}:${record.salt}`)
    .digest('hex')
    .slice(0, 12)
    .toUpperCase();
  const verificationId = `NVEA-OTP-${verificationToken}`;

  const cleanApplicantName = String(applicantName || 'Applicant').trim() || 'Applicant';
  const cleanSrNumber = String(srNumber || '—').trim() || '—';
  const cleanRegNumber = String(registrationNumber || cleanRecord).trim() || cleanRecord;
  const cleanEnrollNumber = String(enrollmentNumber || cleanRecord).trim() || cleanRecord;
  const cleanRollNumber = String(rollNumber || cleanSrNumber).trim() || cleanSrNumber;
  const cleanCourseClass =
    String(courseClass || 'NVEA CLAP Admission Program').trim() ||
    'NVEA CLAP Admission Program';
  const cleanRecId = cleanRecord.replace(/[^A-Z0-9]/gi, '');
  const cleanNum = cleanRecId.replace(/^NVEA/i, '') || cleanRecId || `${new Date().getFullYear()}01`;
  const autoGeneratedIsn = `NVEA-ISN-${cleanNum}`;
  const cleanInterviewSerial =
    interviewSerialNumber &&
    String(interviewSerialNumber).trim() !== '' &&
    String(interviewSerialNumber).trim() !== '—'
      ? String(interviewSerialNumber).trim()
      : autoGeneratedIsn;

  let valid17Points: Array<{ pointNumber: number; label: string; value: string }> =
    Array.isArray(seventeenPoints) && seventeenPoints.length > 0
      ? seventeenPoints.map((pt: { pointNumber: number; label: string; value: string }) =>
          pt.pointNumber === 43 ? { ...pt, label: 'Interview Serial Number', value: cleanInterviewSerial } : pt
        )
      : [
          { pointNumber: 2, label: 'Applicant Name', value: cleanApplicantName },
          { pointNumber: 41, label: 'Enrollment Date', value: formattedAdmissionDate },
          { pointNumber: 43, label: 'Interview Serial Number', value: cleanInterviewSerial },
          { pointNumber: 44, label: 'SR Number', value: cleanSrNumber },
          { pointNumber: 45, label: 'Registration Number', value: cleanRegNumber },
          { pointNumber: 46, label: 'Enrollment Number', value: cleanEnrollNumber },
        ];

  if (!valid17Points.some((pt) => pt.pointNumber === 43)) {
    const idx41 = valid17Points.findIndex((pt) => pt.pointNumber === 41);
    const item43 = { pointNumber: 43, label: 'Interview Serial Number', value: cleanInterviewSerial };
    if (idx41 >= 0) {
      valid17Points.splice(idx41 + 1, 0, item43);
    } else {
      valid17Points.push(item43);
    }
  }

  let validSummary: Array<{ label: string; value: string }> =
    Array.isArray(summaryIdentifiers) && summaryIdentifiers.length > 0
      ? summaryIdentifiers.map((item: { label: string; value: string }) => {
          if (item.label.includes('Point 43') || item.label.includes('Interview Serial Number')) {
            return { label: 'Point 43 — Interview Serial Number', value: cleanInterviewSerial };
          }
          if (item.label === 'OTP Verification ID') {
            return { ...item, value: verificationId };
          }
          if (item.label === 'Verification Date (IST)') {
            return { ...item, value: dateIst };
          }
          if (item.label === 'Verification Time (IST)') {
            return { ...item, value: timeIst };
          }
          return item;
        })
      : [
          { label: 'Point 43 — Interview Serial Number', value: cleanInterviewSerial },
          { label: 'Admission / Form Reference ID', value: cleanRecord },
          { label: 'OTP Verification ID', value: verificationId },
          { label: 'Consent Reference Number', value: `NVEA-CR-${cleanRecId}` },
          { label: 'Official Consent Certification ID', value: `NVEA-CC-${verificationToken}` },
          { label: 'Seal & Stamp Registration No.', value: `NVEA-SEAL-${cleanRecId}` },
          { label: 'Departmental Record No.', value: `NVEA-DR-${cleanRecId}` },
          { label: 'OTP Verified Gmail ID', value: cleanContact },
          { label: 'Consent Verification Status', value: 'VERIFIED & CONFIRMED' },
          { label: 'Oath Verification Status', value: 'VERIFIED & APPROVED' },
          { label: 'Gmail / OTP Verification Status', value: 'OTP VERIFIED' },
          { label: 'Verification Date (IST)', value: dateIst },
          { label: 'Verification Time (IST)', value: timeIst },
        ];

  if (!validSummary.some((item) => item.label.includes('Point 43') || item.label.includes('Interview Serial Number'))) {
    validSummary.unshift({ label: 'Point 43 — Interview Serial Number', value: cleanInterviewSerial });
  }

  let confirmationEmailSent = false;

  // Automatically send Admission & Consent Confirmation Email with ALL 17 POINTS to the EXACT SAME Gmail ID used for OTP
  if (record.channel === 'gmail' && cleanContact.includes('@')) {
    const confirmSubject = `NVEA Official Admission & Consent Confirmation — Record ${cleanRecord}`;
    const rows17Html = valid17Points
      .map(
        (pt, idx) => `
          <tr style="background-color: ${idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC'};">
            <td style="padding: 7px 10px; border: 1px solid #CBD5E1; font-weight: bold; color: #0F2942; width: 14%; text-align: center;">Point ${pt.pointNumber}</td>
            <td style="padding: 7px 10px; border: 1px solid #CBD5E1; font-weight: bold; color: #1E293B; width: 42%;">${pt.label}</td>
            <td style="padding: 7px 10px; border: 1px solid #CBD5E1; font-family: monospace, sans-serif; font-weight: 600; color: #0F172A;">${pt.value || '—'}</td>
          </tr>`
      )
      .join('');

    const confirmHtmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 660px; margin: 0 auto; border: 2px solid #0F2942; border-radius: 4px; overflow: hidden;">
        <div style="background-color: #0F2942; color: #FFFFFF; padding: 16px 20px; border-bottom: 3px solid #059669;">
          <h2 style="margin: 0; font-size: 17px;">NAND VIDHYA EDUCATION ACADEMY (NVEA / नव्या)</h2>
          <p style="margin: 4px 0 0; font-size: 12px; color: #A7F3D0;">Official Admission &amp; Consent Verification Confirmation</p>
        </div>
        <div style="padding: 20px; color: #0F172A; background-color: #FFFFFF;">
          <p style="margin: 0 0 12px; font-size: 15px;">Dear <strong>${cleanApplicantName}</strong>,</p>
          <div style="background-color: #ECFDF5; border: 2px solid #059669; padding: 12px 15px; border-radius: 4px; margin-bottom: 16px;">
            <p style="margin: 0; font-size: 15px; font-weight: bold; color: #065F46;">
              ✓ Your admission and consent have been successfully verified and confirmed through OTP verification.
            </p>
            <p style="margin: 5px 0 0; font-size: 12px; color: #047857;">
              OTP Verification ID: <strong>${verificationId}</strong> &nbsp;|&nbsp; Verified On (IST): <strong>${dateIst}, ${timeIst}</strong>
            </p>
            <p style="margin: 6px 0 0; font-size: 13px; color: #065F46; font-weight: bold;">
              Interview Serial Number (Q.43): <span style="font-family: monospace, sans-serif; font-size: 13.5px; color: #0F2942; background: #FFFFFF; padding: 2px 7px; border: 1px solid #A7F3D0; border-radius: 3px;">${cleanInterviewSerial}</span>
            </p>
          </div>
          <h3 style="margin: 0 0 8px; font-size: 13px; color: #0F2942; text-transform: uppercase; letter-spacing: 0.5px;">
            Official 17-Point Verified Admission &amp; Consent Data
          </h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 12.5px; margin-bottom: 16px;">
            <thead>
              <tr style="background-color: #0F2942; color: #FFFFFF;">
                <th style="padding: 8px 10px; border: 1px solid #0F2942; text-align: center;">Point No.</th>
                <th style="padding: 8px 10px; border: 1px solid #0F2942; text-align: left;">Field Name</th>
                <th style="padding: 8px 10px; border: 1px solid #0F2942; text-align: left;">Verified Value</th>
              </tr>
            </thead>
            <tbody>
              ${rows17Html}
            </tbody>
          </table>
          <div style="background-color: #F8FAFC; border: 1px solid #CBD5E1; padding: 10px 14px; border-radius: 3px; font-size: 12px; color: #334155; margin-bottom: 12px;">
            <strong>Official Verification Reference Summary:</strong><br/>
            • Interview Serial Number: <strong style="color: #0F2942; font-family: monospace;">${cleanInterviewSerial}</strong><br/>
            • Admission / Form Ref ID: <strong>${cleanRecord}</strong><br/>
            • OTP Verification ID: <strong>${verificationId}</strong><br/>
            • Consent Reference No.: <strong>NVEA-CR-${cleanRecId}</strong><br/>
            • Seal &amp; Stamp Reg. No.: <strong>NVEA-SEAL-${cleanRecId}</strong><br/>
            • Verification Status: <strong style="color: #065F46;">VERIFIED &amp; CONFIRMED (${dateIst} ${timeIst})</strong>
          </div>
          <p style="margin: 0; font-size: 12px; color: #475569;">
            Thank you for completing your official consent verification with NAND VIDHYA EDUCATION ACADEMY (NVEA).
          </p>
        </div>
        <div style="background-color: #F1F5F9; padding: 10px 20px; font-size: 11px; color: #475569; border-top: 1px solid #CBD5E1;">
          NVEA Official Portal: https://www.nvea.in/ • Helpline: 09414008310
        </div>
      </div>
    `;

    const confirmDelivery = await deliverOfficialGmailMessage({
      toEmail: cleanContact,
      subject: confirmSubject,
      htmlBody: confirmHtmlBody,
      recordNumber: cleanRecord,
      applicantName: cleanApplicantName,
      clientGasUrl: typeof clientGasUrl === 'string' ? clientGasUrl : '',
      clientAccessToken:
        (typeof oauthAccessToken === 'string' && oauthAccessToken) || bearerToken,
    });
    confirmationEmailSent = confirmDelivery.ok;
  }

  const verificationRecord: OtpVerificationRecordServer = {
    recordNumber: cleanRecord,
    verificationId,
    applicantName: cleanApplicantName,
    srNumber: cleanSrNumber,
    registrationNumber: cleanRegNumber,
    rollNumber: cleanRollNumber,
    enrollmentNumber: cleanEnrollNumber,
    admissionDate: formattedAdmissionDate,
    courseClass: cleanCourseClass,
    interviewSerialNumber: cleanInterviewSerial,
    verificationStatus: 'ADMISSION CONFIRMED (OTP VERIFIED)',
    verifiedAt,
    verifiedContact: cleanContact,
    verifiedChannel: record.channel,
    confirmationEmailSent,
    seventeenPoints: valid17Points,
    summaryIdentifiers: validSummary,
  };

  const verificationsMap = loadVerificationsMap();
  verificationsMap[cleanRecord] = verificationRecord;
  writeVerificationsMap(verificationsMap);

  // Also associate with saved form if already present on backend
  const savedForms = loadSavedFormsMap();
  if (savedForms[cleanRecord]) {
    savedForms[cleanRecord].otpVerification = verificationRecord;
    writeSavedFormsMap(savedForms);
  }

  return res.json({
    ok: true,
    verified: true,
    statusText: 'Consent Verified / Approved',
    verificationStatus: 'ADMISSION CONFIRMED (OTP VERIFIED)',
    verifiedContact: cleanContact,
    verifiedChannel: record.channel,
    verifiedAt,
    verificationId,
    interviewSerialNumber: cleanInterviewSerial,
    confirmationEmailSent,
    verification: verificationRecord,
  });
});

// 4b. Save/Update verification record snapshot
app.post('/api/verification/save', (req, res) => {
  const {
    recordNumber,
    verificationId,
    applicantName,
    srNumber,
    registrationNumber,
    rollNumber,
    enrollmentNumber,
    admissionDate,
    courseClass,
    verifiedAt,
    verifiedContact,
    seventeenPoints,
    summaryIdentifiers,
  } = req.body || {};
  const cleanRecord = String(recordNumber || '').trim();
  if (!cleanRecord) {
    return res.status(400).json({ ok: false, error: 'Missing recordNumber' });
  }
  const verificationsMap = loadVerificationsMap();
  const existing = verificationsMap[cleanRecord];
  const updated: OtpVerificationRecordServer = {
    recordNumber: cleanRecord,
    verificationId: String(verificationId || existing?.verificationId || `NVEA-OTP-${cleanRecord}`),
    applicantName: String(applicantName || existing?.applicantName || 'Applicant'),
    srNumber: String(srNumber || existing?.srNumber || '—'),
    registrationNumber: String(registrationNumber || existing?.registrationNumber || cleanRecord),
    rollNumber: String(rollNumber || existing?.rollNumber || '—'),
    enrollmentNumber: String(enrollmentNumber || existing?.enrollmentNumber || cleanRecord),
    admissionDate: String(admissionDate || existing?.admissionDate || new Date().toISOString()),
    courseClass: String(courseClass || existing?.courseClass || 'NVEA CLAP Admission Program'),
    verificationStatus: 'ADMISSION CONFIRMED (OTP VERIFIED)',
    verifiedAt: String(verifiedAt || existing?.verifiedAt || new Date().toISOString()),
    verifiedContact: String(verifiedContact || existing?.verifiedContact || ''),
    verifiedChannel: existing?.verifiedChannel || 'gmail',
    confirmationEmailSent: existing?.confirmationEmailSent,
    seventeenPoints: Array.isArray(seventeenPoints) ? seventeenPoints : existing?.seventeenPoints,
    summaryIdentifiers: Array.isArray(summaryIdentifiers)
      ? summaryIdentifiers
      : existing?.summaryIdentifiers,
  };
  verificationsMap[cleanRecord] = updated;
  writeVerificationsMap(verificationsMap);
  return res.json({ ok: true, record: updated });
});

app.get('/api/verification/:recordNumber', (req, res) => {
  const cleanRecord = String(req.params.recordNumber || '').trim();
  if (!cleanRecord) {
    return res.status(400).json({ ok: false, error: 'Missing recordNumber' });
  }
  const verificationsMap = loadVerificationsMap();
  const found = verificationsMap[cleanRecord] || loadSavedFormsMap()[cleanRecord]?.otpVerification;
  if (!found) {
    return res.status(404).json({ ok: false, verified: false });
  }
  return res.json({
    ok: true,
    verified: true,
    record: {
      recordNumber: found.recordNumber,
      verificationId: found.verificationId,
      applicantName: found.applicantName,
      srNumber: found.srNumber,
      registrationNumber: found.registrationNumber,
      rollNumber: found.rollNumber,
      enrollmentNumber: found.enrollmentNumber,
      admissionDate: found.admissionDate,
      courseClass: found.courseClass,
      verificationStatus: 'ADMISSION CONFIRMED (OTP VERIFIED)',
      verifiedAt: found.verifiedAt,
      verifiedContact: found.verifiedContact,
      seventeenPoints: found.seventeenPoints || [],
      summaryIdentifiers: found.summaryIdentifiers || [],
    },
  });
});

// 4b. Retrieve or update persistent OTP Verification Record & QR metadata for a specific Application Record
app.get('/api/otp/verification/:recordNumber', (req, res) => {
  const cleanRecord = String(req.params.recordNumber || '').trim();
  if (!cleanRecord) {
    return res.status(400).json({ ok: false, error: 'Missing recordNumber' });
  }
  const verificationsMap = loadVerificationsMap();
  const found = verificationsMap[cleanRecord];
  if (!found) {
    const savedForms = loadSavedFormsMap();
    if (savedForms[cleanRecord]?.otpVerification) {
      const v = savedForms[cleanRecord].otpVerification;
      return res.json({
        ok: true,
        verified: true,
        verification: {
          recordNumber: v.recordNumber || cleanRecord,
          verificationId: v.verificationId,
          applicantName: v.applicantName,
          srNumber: v.srNumber || 'Assigned by NVEA',
          registrationNumber: v.registrationNumber || cleanRecord,
          rollNumber: v.rollNumber || 'Assigned by NVEA',
          enrollmentNumber: v.enrollmentNumber || cleanRecord,
          admissionDate: v.admissionDate || v.verifiedAt,
          courseClass: v.courseClass,
          verificationStatus: 'ADMISSION CONFIRMED (OTP VERIFIED)',
          verifiedAt: v.verifiedAt,
        },
      });
    }
    return res.status(404).json({ ok: false, verified: false });
  }

  // Return strictly basic admission verification fields (never exposing passwords, OTPs, or credentials)
  return res.json({
    ok: true,
    verified: true,
    verification: {
      recordNumber: found.recordNumber,
      verificationId: found.verificationId,
      applicantName: found.applicantName,
      srNumber: found.srNumber || 'Assigned by NVEA',
      registrationNumber: found.registrationNumber || found.recordNumber,
      rollNumber: found.rollNumber,
      enrollmentNumber: found.enrollmentNumber,
      admissionDate: found.admissionDate || found.verifiedAt,
      courseClass: found.courseClass,
      verificationStatus: 'ADMISSION CONFIRMED (OTP VERIFIED)',
      verifiedAt: found.verifiedAt,
    },
  });
});

app.post('/api/otp/verification/:recordNumber', (req, res) => {
  const cleanRecord = String(req.params.recordNumber || '').trim();
  if (!cleanRecord) {
    return res.status(400).json({ ok: false, error: 'Missing recordNumber' });
  }
  const {
    verificationId,
    applicantName,
    srNumber,
    registrationNumber,
    rollNumber,
    enrollmentNumber,
    admissionDate,
    courseClass,
    interviewSerialNumber,
    verifiedAt,
    verifiedContact,
    verifiedChannel,
  } = req.body || {};

  const verificationsMap = loadVerificationsMap();
  const existing = verificationsMap[cleanRecord];
  if (!existing && !verificationId) {
    return res.status(404).json({ ok: false, error: 'Verification record not found' });
  }

  const updated: OtpVerificationRecordServer = {
    recordNumber: cleanRecord,
    verificationId: String(verificationId || existing?.verificationId || 'NVEA-OTP-VERIFIED'),
    applicantName: String(applicantName || existing?.applicantName || 'Applicant'),
    srNumber: String(srNumber || existing?.srNumber || 'Assigned by NVEA'),
    registrationNumber: String(
      registrationNumber || existing?.registrationNumber || cleanRecord
    ),
    rollNumber: String(rollNumber || existing?.rollNumber || 'Assigned by NVEA'),
    enrollmentNumber: String(enrollmentNumber || existing?.enrollmentNumber || cleanRecord),
    admissionDate: String(
      admissionDate || existing?.admissionDate || existing?.verifiedAt || new Date().toISOString()
    ),
    courseClass: String(
      courseClass || existing?.courseClass || 'NVEA CLAP Admission Program'
    ),
    interviewSerialNumber: String(
      interviewSerialNumber || existing?.interviewSerialNumber || '—'
    ),
    verificationStatus: 'ADMISSION CONFIRMED (OTP VERIFIED)',
    verifiedAt: String(verifiedAt || existing?.verifiedAt || new Date().toISOString()),
    verifiedContact: String(verifiedContact || existing?.verifiedContact || ''),
    verifiedChannel: String(verifiedChannel || existing?.verifiedChannel || 'gmail'),
    confirmationEmailSent: existing?.confirmationEmailSent,
  };

  verificationsMap[cleanRecord] = updated;
  writeVerificationsMap(verificationsMap);

  return res.json({
    ok: true,
    verified: true,
    verification: updated,
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
    const verificationsMap = loadVerificationsMap();
    const existingVerification =
      req.body?.otpVerification || verificationsMap[cleanId] || map[cleanId]?.otpVerification;

    if (existingVerification) {
      verificationsMap[cleanId] = {
        ...existingVerification,
        recordNumber: String(recordNumber || cleanId),
        applicantName: String(
          applicantName || answers?.q2 || existingVerification.applicantName || 'Applicant'
        ),
      };
      writeVerificationsMap(verificationsMap);
    }

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
      otpVerification: verificationsMap[cleanId],
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
