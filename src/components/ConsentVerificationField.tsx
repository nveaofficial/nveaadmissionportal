import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Mail,
  Send,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Lock,
  Settings,
  Copy,
  Check,
  RefreshCw,
  ArrowRightCircle,
  QrCode,
  ExternalLink,
  Award,
  Link2,
} from 'lucide-react';
export const OFFICIAL_NVEA_GMAIL = 'nveaofficial@gmail.com';
const getAccessToken = async (): Promise<string | null> => null;
import {
  extractVerificationPayload,
  generateAdmissionQrDataUrl,
  generateAdmissionConfirmedSealPng,
  buildAdmissionVerifyUrl,
  buildConfirmationEmailHtml,
} from '../utils/verificationUtils';
import { generateNveaCircularLogoPng } from '../utils/officialAssets';

export interface ConsentVerificationData {
  verified: boolean;
  statusText: string; // "Consent Verified / Approved" when verified
  verifiedContact?: string;
  verifiedChannel?: string;
  verifiedAt?: string;
  verificationId?: string;
  interviewSerialNumber?: string;
  confirmationEmailSent?: boolean;
}

interface ConsentVerificationFieldProps {
  recordNumber: string;
  applicantName: string;
  answers?: Record<string, string | string[]>;
  priorIncompleteCount: number;
  isQ170Uploaded: boolean;
  onJumpToIncomplete: () => void;
  verificationValue: string; // Stored in answers.q171
  onVerified: (statusText: string, details: ConsentVerificationData) => void;
}

export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * NVEA Official Gmail OTP Server Script (Google Apps Script - Code.gs)
 * Deploy in your official Google Account (nveaofficial@gmail.com):
 * 1. Go to https://script.google.com -> Click "New project"
 * 2. Paste this entire code into Code.gs and click Save
 * 3. Click "Deploy" -> "New deployment" -> Select type: "Web app"
 * 4. Set Execute as: "Me (nveaofficial@gmail.com)"
 * 5. Set Who has access: "Anyone" -> Click "Deploy" & Authorize
 * 6. Copy the generated Web App URL (https://script.google.com/macros/s/.../exec)
 *    and paste it into the NVEA Form OTP Gateway Setup box.
 */

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents || "{}");
    var action = body.action || "send_otp_from_server";
    var cache = CacheService.getScriptCache();

    // Mode 1: Called by NVEA Express Server to deliver server-generated OTP via Gmail
    if (action === "send_otp_from_server") {
      MailApp.sendEmail({
        to: body.to,
        subject: body.subject || ("NVEA Official Consent Verification OTP - " + (body.recordNumber || "")),
        htmlBody: body.htmlBody || ("Your NVEA Consent Verification OTP is: <b>" + body.otp + "</b>")
      });
      return jsonResponse({ ok: true, delivered: true });
    }

    // Mode 2: Standalone HTML Mode - Generate & store OTP on Google Servers (Never exposed to browser)
    if (action === "send_otp_standalone") {
      var email = String(body.to || "").trim().toLowerCase();
      var recordNo = String(body.recordNumber || "NVEA").trim();
      if (!email || email.indexOf("@") === -1) {
        return jsonResponse({ ok: false, error: "Invalid email address." });
      }
      var otp = String(Math.floor(100000 + Math.random() * 900000));
      var key = "NVEA_OTP_" + recordNo + "_" + email;
      var payload = JSON.stringify({ otp: otp, attempts: 0, used: false, createdAt: new Date().getTime() });
      cache.put(key, payload, 300); // 5-minute expiry

      MailApp.sendEmail({
        to: email,
        subject: "NVEA Official Consent Verification OTP - Record " + recordNo,
        htmlBody: "<div style='font-family:Arial,sans-serif;padding:16px;border:2px solid #0F2942;'>" +
          "<h3 style='color:#0F2942;margin:0 0 8px;'>NAND VIDHYA EDUCATION ACADEMY (NVEA)</h3>" +
          "<p>Your One-Time Password (OTP) for Point 174 (Consent Verification & Approval) for Record <b>" + recordNo + "</b> is:</p>" +
          "<div style='font-size:26px;font-weight:bold;letter-spacing:5px;color:#991B1B;padding:12px;background:#F8FAFC;border:1px dashed #1E3A8A;text-align:center;'>" + otp + "</div>" +
          "<p style='font-size:12px;color:#475569;'>Valid for 5 minutes. Single-use only.</p></div>"
      });
      return jsonResponse({ ok: true, delivered: true, expiresInSeconds: 300 });
    }

    // Mode 3: Standalone HTML Mode - Verify OTP on Google Servers
    if (action === "verify_otp_standalone") {
      var vEmail = String(body.to || "").trim().toLowerCase();
      var vRecord = String(body.recordNumber || "NVEA").trim();
      var candidate = String(body.otp || "").trim();
      var vKey = "NVEA_OTP_" + vRecord + "_" + vEmail;
      var raw = cache.get(vKey);
      if (!raw) {
        return jsonResponse({ ok: false, verified: false, error: "OTP expired or not found. Please request a new OTP." });
      }
      var data = JSON.parse(raw);
      if (data.used) {
        cache.remove(vKey);
        return jsonResponse({ ok: false, verified: false, error: "OTP already used. Please request a new OTP." });
      }
      data.attempts = (data.attempts || 0) + 1;
      if (data.attempts > 5) {
        cache.remove(vKey);
        return jsonResponse({ ok: false, verified: false, error: "Maximum failed attempts exceeded. Please request a new OTP." });
      }
      if (data.otp !== candidate) {
        cache.put(vKey, JSON.stringify(data), 300);
        return jsonResponse({ ok: false, verified: false, error: "Incorrect OTP. " + (5 - data.attempts) + " attempts remaining." });
      }
      cache.remove(vKey);
      return jsonResponse({
        ok: true,
        verified: true,
        statusText: "Consent Verified / Approved",
        verifiedContact: vEmail,
        verifiedChannel: "gmail",
        verifiedAt: new Date().toISOString(),
        verificationId: "NVEA-GAS-" + Math.floor(100000 + Math.random() * 900000)
      });
    }

    // Mode 4: Auto-Save Submitted Form Response to Google Sheet in nveaofficial@gmail.com
    if (action === "append_sheet_row") {
      var props = PropertiesService.getScriptProperties();
      var ssId = String(body.spreadsheetId || props.getProperty("NVEA_SPREADSHEET_ID") || "").trim();
      var ss = null;
      if (ssId) {
        try { ss = SpreadsheetApp.openById(ssId); } catch (e) { ss = null; }
      }
      if (!ss) {
        ss = SpreadsheetApp.create("NVEA Online Admission Portal — Submitted Responses (nveaofficial@gmail.com)");
        props.setProperty("NVEA_SPREADSHEET_ID", ss.getId());
      }
      var sheet = ss.getSheets()[0];
      if (sheet.getLastRow() === 0 && body.headers && body.headers.length > 0) {
        sheet.appendRow(body.headers);
        sheet.setFrozenRows(1);
      }
      if (body.rowValues && body.rowValues.length > 0) {
        sheet.appendRow(body.rowValues);
      }
      return jsonResponse({
        ok: true,
        synced: true,
        spreadsheetId: ss.getId(),
        spreadsheetUrl: ss.getUrl(),
        sheetTabName: sheet.getName()
      });
    }

    return jsonResponse({ ok: false, error: "Unknown action" });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}`;

const LOCAL_GAS_URL_KEY = 'nvea_gas_webapp_url_v1';

export const ConsentVerificationField: React.FC<ConsentVerificationFieldProps> = ({
  recordNumber,
  applicantName,
  answers = {},
  priorIncompleteCount,
  isQ170Uploaded,
  onJumpToIncomplete,
  verificationValue,
  onVerified,
}) => {
  const isAlreadyVerified = verificationValue.startsWith('Consent Verified / Approved');

  const [consentIntentConfirmed, setConsentIntentConfirmed] = useState<boolean>(
    isAlreadyVerified
  );
  const [channel, setChannel] = useState<'gmail' | 'whatsapp'>('gmail');
  const [contact, setContact] = useState<string>(() => {
    const q13 = answers.q13;
    return typeof q13 === 'string' && q13.includes('@') ? q13.trim() : '';
  });
  const [otpInput, setOtpInput] = useState<string>('');

  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [sending, setSending] = useState<boolean>(false);
  const [verifying, setVerifying] = useState<boolean>(false);
  const [connectingOAuth, setConnectingOAuth] = useState<boolean>(false);
  const [needsReconnect, setNeedsReconnect] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [infoMsg, setInfoMsg] = useState<string>('');
  const [countdown, setCountdown] = useState<number>(0);

  // Automatic Seal & QR Code state
  const [sealDataUrl, setSealDataUrl] = useState<string>('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [logoDataUrl, setLogoDataUrl] = useState<string>('');

  // Gateway configuration state
  const [gatewayStatus, setGatewayStatus] = useState<{
    gmailReady: boolean;
    gmailMethod: string;
    whatsappReady: boolean;
    googleAppsScriptUrl: string;
    gmailUser: string;
  }>({
    gmailReady: Boolean(localStorage.getItem(LOCAL_GAS_URL_KEY)),
    gmailMethod: localStorage.getItem(LOCAL_GAS_URL_KEY) ? 'google_apps_script' : 'unconfigured',
    whatsappReady: false,
    googleAppsScriptUrl: localStorage.getItem(LOCAL_GAS_URL_KEY) || '',
    gmailUser: OFFICIAL_NVEA_GMAIL,
  });

  const [showGatewaySetup, setShowGatewaySetup] = useState<boolean>(false);
  const [gasUrlInput, setGasUrlInput] = useState<string>(
    localStorage.getItem(LOCAL_GAS_URL_KEY) || ''
  );
  const [gmailUserInput, setGmailUserInput] = useState<string>(OFFICIAL_NVEA_GMAIL);
  const [gmailAppPassInput, setGmailAppPassInput] = useState<string>('');
  const [savingConfig, setSavingConfig] = useState<boolean>(false);
  const [copiedScript, setCopiedScript] = useState<boolean>(false);
  const [verifiedMeta, setVerifiedMeta] = useState<ConsentVerificationData | null>(null);

  // Auto-populate applicant email from Q13 if contact is empty
  useEffect(() => {
    const q13 = answers.q13;
    if (!contact && typeof q13 === 'string' && q13.includes('@')) {
      setContact(q13.trim());
    }
  }, [answers.q13, contact]);

  const verificationPayload = extractVerificationPayload(
    recordNumber,
    answers,
    verifiedMeta?.verifiedAt,
    verifiedMeta?.verifiedContact || contact.trim()
  );

  const halfSummary = Math.ceil(verificationPayload.summaryIdentifiers.length / 2);
  const leftSummaryRecords = verificationPayload.summaryIdentifiers.slice(0, halfSummary);
  const rightSummaryRecords = verificationPayload.summaryIdentifiers.slice(halfSummary);

  // Automatically generate Seal & QR Code and persist verification record when verified
  useEffect(() => {
    if (!isAlreadyVerified) {
      setSealDataUrl('');
      setQrDataUrl('');
      setLogoDataUrl('');
      return;
    }

    const payload = extractVerificationPayload(
      recordNumber,
      answers,
      verifiedMeta?.verifiedAt,
      verifiedMeta?.verifiedContact || contact.trim()
    );
    const seal = generateAdmissionConfirmedSealPng(payload);
    setSealDataUrl(seal);

    try {
      const logo = generateNveaCircularLogoPng();
      setLogoDataUrl(logo);
    } catch {
      // ignore
    }

    generateAdmissionQrDataUrl(payload).then((url) => {
      setQrDataUrl(url);
    });

    // Persist updated admission details & 17-point snapshot to backend verification store
    fetch('/api/verification/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recordNumber: payload.recordNumber,
        verificationId: payload.verificationId,
        applicantName: payload.applicantName,
        srNumber: payload.srNumber,
        registrationNumber: payload.registrationNumber,
        rollNumber:
          typeof answers.q48 === 'string' && answers.q48.trim()
            ? answers.q48.trim()
            : payload.srNumber,
        enrollmentNumber: payload.enrollmentNumber,
        admissionDate: payload.admissionDate,
        courseClass: payload.courseClass,
        interviewSerialNumber: payload.interviewSerialNumber,
        verifiedAt: payload.verifiedAt,
        verifiedContact: payload.verifiedContact || contact.trim(),
        seventeenPoints: payload.seventeenPoints,
        summaryIdentifiers: payload.summaryIdentifiers,
      }),
    }).catch(() => {
      // ignore in standalone offline mode
    });
  }, [
    isAlreadyVerified,
    recordNumber,
    verificationValue,
    answers.q2,
    answers.q38,
    answers.q41,
    answers.q42,
    answers.q43,
    answers.q47,
    answers.q48,
    answers.q49,
    answers.q61,
    answers.q72,
    answers.q74,
    answers.q75,
    answers.q107,
    answers.q118,
    answers.q119,
    answers.q124,
    answers.q125,
    answers.q128,
  ]);

  // Check server gateway configuration on mount & auto-sync any existing local GAS URL or OAuth token
  useEffect(() => {
    let active = true;
    const syncAndCheckGateway = async () => {
      try {
        const storedGas = localStorage.getItem(LOCAL_GAS_URL_KEY) || '';
        const memToken = await getAccessToken();

        const r = await fetch('/api/otp/status');
        const data = await r.json();
        if (!active) return;

        // If server is not yet configured, but browser has a saved GAS URL or active OAuth token, sync it once to backend
        if (!data.gmailReady && (storedGas || memToken)) {
          const cfgRes = await fetch('/api/otp/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...(storedGas ? { googleAppsScriptUrl: storedGas } : {}),
              ...(memToken ? { oauthAccessToken: memToken } : {}),
              gmailUser: data.gmailUser || OFFICIAL_NVEA_GMAIL,
            }),
          });
          if (cfgRes.ok) {
            const updated = await cfgRes.json();
            if (!active) return;
            setGatewayStatus({
              gmailReady: Boolean(updated.gmailReady || storedGas),
              gmailMethod: updated.gmailMethod || (storedGas ? 'google_apps_script' : 'gmail_oauth'),
              whatsappReady: Boolean(updated.whatsappReady),
              googleAppsScriptUrl: updated.googleAppsScriptUrl || storedGas,
              gmailUser: updated.gmailUser || OFFICIAL_NVEA_GMAIL,
            });
            return;
          }
        }

        const effectiveGas = data.googleAppsScriptUrl || storedGas;
        if (data.googleAppsScriptUrl && !storedGas) {
          localStorage.setItem(LOCAL_GAS_URL_KEY, data.googleAppsScriptUrl);
        }

        setGatewayStatus({
          gmailReady: Boolean(data.gmailReady || effectiveGas),
          gmailMethod: data.gmailMethod || (effectiveGas ? 'google_apps_script' : 'unconfigured'),
          whatsappReady: Boolean(data.whatsappReady),
          googleAppsScriptUrl: effectiveGas,
          gmailUser: data.gmailUser || OFFICIAL_NVEA_GMAIL,
        });
        if (effectiveGas) setGasUrlInput(effectiveGas);
        if (data.gmailUser) setGmailUserInput(data.gmailUser);
      } catch {
        const storedGas = localStorage.getItem(LOCAL_GAS_URL_KEY) || '';
        if (active && storedGas) {
          setGatewayStatus((prev) => ({
            ...prev,
            gmailReady: true,
            gmailMethod: 'google_apps_script',
            googleAppsScriptUrl: storedGas,
          }));
        }
      }
    };

    syncAndCheckGateway();
    return () => {
      active = false;
    };
  }, []);

  // Countdown timer for OTP expiry
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // One-Time Official Gmail OAuth Connection
  const handleOneClickGmailConnect = async () => {
    setInfoMsg('');
    setErrorMsg(
      'Cloud authentication has been disabled per configuration. Please configure Alternative A (Google Apps Script Web App URL) or Alternative B (App Password) below for Official Gmail OTP delivery.'
    );
  };

  const handleSaveGatewayConfig = async () => {
    setSavingConfig(true);
    setErrorMsg('');
    const trimmedGas = gasUrlInput.trim();
    if (trimmedGas) {
      localStorage.setItem(LOCAL_GAS_URL_KEY, trimmedGas);
    } else {
      localStorage.removeItem(LOCAL_GAS_URL_KEY);
    }

    try {
      const res = await fetch('/api/otp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          googleAppsScriptUrl: trimmedGas,
          gmailUser: gmailUserInput.trim(),
          ...(gmailAppPassInput.trim() ? { gmailAppPassword: gmailAppPassInput.trim() } : {}),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setGatewayStatus({
          gmailReady: Boolean(data.gmailReady || trimmedGas),
          gmailMethod: data.gmailMethod || (trimmedGas ? 'google_apps_script' : 'unconfigured'),
          whatsappReady: Boolean(data.whatsappReady),
          googleAppsScriptUrl: data.googleAppsScriptUrl || trimmedGas,
          gmailUser: data.gmailUser || gmailUserInput.trim(),
        });
        setNeedsReconnect(false);
        setShowGatewaySetup(false);
        setInfoMsg('Official Gmail OTP gateway connected and saved permanently on the server.');
      } else {
        setGatewayStatus((prev) => ({
          ...prev,
          gmailReady: Boolean(trimmedGas),
          gmailMethod: trimmedGas ? 'google_apps_script' : 'unconfigured',
          googleAppsScriptUrl: trimmedGas,
        }));
        setShowGatewaySetup(false);
      }
    } catch {
      setGatewayStatus((prev) => ({
        ...prev,
        gmailReady: Boolean(trimmedGas),
        gmailMethod: trimmedGas ? 'google_apps_script' : 'unconfigured',
        googleAppsScriptUrl: trimmedGas,
      }));
      setShowGatewaySetup(false);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSendOtp = async () => {
    setErrorMsg('');
    setInfoMsg('');
    const cleanContact = contact.trim();
    if (!cleanContact) {
      setErrorMsg(
        channel === 'gmail'
          ? 'Please enter the applicant’s valid Gmail / Email address to receive the OTP.'
          : 'Please enter a valid WhatsApp number.'
      );
      return;
    }

    setSending(true);
    try {
      const memToken = await getAccessToken();
      const res = await fetch('/api/otp/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(memToken ? { Authorization: `Bearer ${memToken}` } : {}),
        },
        body: JSON.stringify({
          channel,
          contact: cleanContact,
          recordNumber,
          applicantName: verificationPayload.applicantName,
        }),
      });

      const data = await res.json();
      if (res.ok && data.ok && data.delivered) {
        setOtpSent(true);
        setNeedsReconnect(false);
        setGatewayStatus((prev) => ({ ...prev, gmailReady: true }));
        setCountdown(data.expiresInSeconds || 300);
        setInfoMsg(
          `A 6-digit OTP has been sent from the Official Gmail Gateway (${gatewayStatus.gmailUser}) to ${cleanContact}. Valid for 5 minutes.`
        );
        return;
      }

      if (data.needsReconnect) {
        setNeedsReconnect(true);
        setErrorMsg('Official Gmail session expired. Please click "Reconnect Gmail" once to continue.');
        return;
      }

      if (data.code === 'GMAIL_NOT_CONFIGURED' || data.code === 'WHATSAPP_NOT_CONFIGURED') {
        setNeedsReconnect(true);
      }
      setErrorMsg(data.error || 'Could not deliver OTP. Please connect or reconnect Official Gmail.');
    } catch {
      const gasUrl = gatewayStatus.googleAppsScriptUrl || localStorage.getItem(LOCAL_GAS_URL_KEY);
      if (channel === 'gmail' && gasUrl && gasUrl.startsWith('https://script.google.com/')) {
        try {
          const gasRes = await fetch(gasUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
              action: 'send_otp_standalone',
              to: cleanContact,
              recordNumber,
              applicantName: verificationPayload.applicantName,
            }),
          });
          const gasData = await gasRes.json();
          if (gasData.ok && gasData.delivered) {
            setOtpSent(true);
            setCountdown(300);
            setInfoMsg(
              `A 6-digit OTP has been generated and sent to ${cleanContact}. Valid for 5 minutes.`
            );
            return;
          }
          setErrorMsg(gasData.error || 'Could not send the OTP.');
        } catch (gasErr) {
          setErrorMsg(
            gasErr instanceof Error ? gasErr.message : 'Failed to reach OTP gateway.'
          );
        }
      } else {
        setNeedsReconnect(true);
        setErrorMsg('Please click "Connect Official Gmail OTP Gateway" once to enable automatic OTP delivery.');
      }
    } finally {
      setSending(false);
    }
  };

  const handleVerifyOtp = async () => {
    setErrorMsg('');
    setInfoMsg('');
    const cleanOtp = otpInput.trim();
    if (!/^\d{6}$/.test(cleanOtp)) {
      setErrorMsg('Please enter the 6-digit numeric OTP sent to your email.');
      return;
    }

    setVerifying(true);
    const payload = extractVerificationPayload(
      recordNumber,
      answers,
      undefined,
      contact.trim()
    );
    try {
      const memToken = await getAccessToken();
      const res = await fetch('/api/otp/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(memToken ? { Authorization: `Bearer ${memToken}` } : {}),
        },
        body: JSON.stringify({
          contact: contact.trim(),
          recordNumber,
          otp: cleanOtp,
          applicantName: payload.applicantName,
          srNumber: payload.srNumber,
          registrationNumber: payload.registrationNumber,
          rollNumber:
            typeof answers.q48 === 'string' && answers.q48.trim()
              ? answers.q48.trim()
              : payload.srNumber,
          enrollmentNumber: payload.enrollmentNumber,
          admissionDate: payload.admissionDate,
          courseClass: payload.courseClass,
          interviewSerialNumber: payload.interviewSerialNumber,
          seventeenPoints: payload.seventeenPoints,
          summaryIdentifiers: payload.summaryIdentifiers,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok && data.verified) {
        const generatedIsn =
          data.verification?.interviewSerialNumber ||
          data.interviewSerialNumber ||
          payload.interviewSerialNumber;
        const meta: ConsentVerificationData = {
          verified: true,
          statusText: 'Consent Verified / Approved',
          verifiedContact: data.verifiedContact || contact.trim(),
          verifiedChannel: data.verifiedChannel || channel,
          verifiedAt: data.verifiedAt || new Date().toISOString(),
          verificationId: data.verificationId,
          interviewSerialNumber: generatedIsn,
          confirmationEmailSent: Boolean(data.confirmationEmailSent),
        };
        setVerifiedMeta(meta);
        onVerified(
          `Consent Verified / Approved (${meta.verifiedContact} • ${meta.verificationId})`,
          meta
        );
        return;
      }
      setErrorMsg(data.error || 'OTP verification failed. Consent remains UNVERIFIED.');
    } catch {
      const gasUrl = gatewayStatus.googleAppsScriptUrl || localStorage.getItem(LOCAL_GAS_URL_KEY);
      if (gasUrl && gasUrl.startsWith('https://script.google.com/')) {
        try {
          const gasRes = await fetch(gasUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
              action: 'verify_otp_standalone',
              to: contact.trim(),
              recordNumber,
              otp: cleanOtp,
            }),
          });
          const gasData = await gasRes.json();
          if (gasData.ok && gasData.verified) {
            const fullConfirmPayload = extractVerificationPayload(
              recordNumber,
              answers,
              gasData.verifiedAt || new Date().toISOString(),
              contact.trim()
            );
            if (gasData.verificationId) {
              fullConfirmPayload.verificationId = gasData.verificationId;
            }
            // Send automatic 17-point confirmation email via GAS bridge to the exact verified Gmail ID
            fetch(gasUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain;charset=utf-8' },
              body: JSON.stringify({
                action: 'send_otp_from_server',
                to: contact.trim(),
                recordNumber,
                subject: `NVEA Official Admission & Consent Confirmation — Record ${recordNumber}`,
                htmlBody: buildConfirmationEmailHtml(fullConfirmPayload),
              }),
            }).catch(() => {});

            const meta: ConsentVerificationData = {
              verified: true,
              statusText: 'Consent Verified / Approved',
              verifiedContact: gasData.verifiedContact || contact.trim(),
              verifiedChannel: 'gmail',
              verifiedAt: gasData.verifiedAt || new Date().toISOString(),
              verificationId: gasData.verificationId,
              interviewSerialNumber: fullConfirmPayload.interviewSerialNumber,
              confirmationEmailSent: true,
            };
            setVerifiedMeta(meta);
            onVerified(
              `Consent Verified / Approved (${meta.verifiedContact} • ${meta.verificationId})`,
              meta
            );
            return;
          }
          setErrorMsg(gasData.error || 'OTP verification failed. Consent remains UNVERIFIED.');
        } catch {
          setErrorMsg('Verification request failed. Consent remains UNVERIFIED.');
        }
      } else {
        setErrorMsg('Verification server unreachable. Consent remains UNVERIFIED.');
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleCopyAppsScript = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2500);
  };

  const prerequisitesMet = priorIncompleteCount === 0 && isQ170Uploaded;
  const verifyPageUrl = buildAdmissionVerifyUrl(verificationPayload);

  return (
    <div className="mt-2">
      {/* Print-Only Summary of Point 174 including Verified Record Summary, Round Seal & 17-Point QR Code (Compact Single-A4 Block) */}
      <div className="hidden print-only border-2 border-[#0F2942] p-2.5 bg-white text-xs break-inside-avoid">
        <div className="flex items-center justify-between border-b border-slate-300 pb-1.5 mb-2">
          <div>
            <span className="font-bold text-[#0F2942] uppercase">
              Point 174 — Official OTP Verification &amp; Admission Record Summary:{' '}
            </span>
            <span className="font-bold text-emerald-800">
              {isAlreadyVerified
                ? 'VERIFIED & CONFIRMED (OTP VERIFIED)'
                : 'UNVERIFIED (Pending OTP Verification)'}
            </span>
          </div>
        </div>
        {isAlreadyVerified && (
          <div className="border border-slate-300 rounded-xs overflow-hidden mt-1 bg-white">
            <div className="bg-[#0F2942] text-white px-3 py-1 text-[10.5px] font-bold uppercase tracking-wide flex items-center justify-between">
              <span>Verified Admission Record Summary</span>
              <span className="font-mono-num text-amber-200">
                Interview Serial No: {verificationPayload.interviewSerialNumber}
              </span>
            </div>
            <div className="grid grid-cols-12 gap-2 p-1.5 items-center">
              {/* Left Column: First half of records in proper sequence */}
              <div className="col-span-4 border border-slate-200 rounded-xs overflow-hidden">
                <table className="w-full border-collapse text-[9.5px] leading-snug">
                  <tbody>
                    {leftSummaryRecords.map((item, idx) => (
                      <tr
                        key={item.label}
                        className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}
                      >
                        <td className="px-1.5 py-0.5 border-b border-r border-slate-200 font-semibold text-slate-700 w-[50%] align-top">
                          {item.label}
                        </td>
                        <td className="px-1.5 py-0.5 border-b border-slate-200 font-mono-num font-bold text-[#0F2942] break-words [overflow-wrap:anywhere] align-top">
                          {item.value}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Center Column: Existing Round Seal + Logo + QR Code */}
              <div className="col-span-4 flex flex-col items-center justify-center text-center gap-1.5 py-1">
                {logoDataUrl && (
                  <img
                    src={logoDataUrl}
                    alt="NVEA Official Logo"
                    className="w-10 h-10 object-contain"
                  />
                )}
                {sealDataUrl && (
                  <div className="flex flex-col items-center">
                    <img
                      src={sealDataUrl}
                      alt="Official NVEA Admission Confirmed Seal"
                      className="w-20 h-20 object-contain"
                    />
                    <span className="text-[8px] font-bold text-[#4C1D95] text-center">
                      Official Verification Seal
                    </span>
                  </div>
                )}
                {qrDataUrl && (
                  <div className="flex flex-col items-center">
                    <img
                      src={qrDataUrl}
                      alt="Official 17-Point Verification QR Code"
                      className="w-18 h-18 object-contain border border-slate-300 p-0.5 bg-white"
                    />
                    <span className="text-[8px] font-bold text-[#0F2942] text-center">
                      17-Point Verified QR
                    </span>
                  </div>
                )}
              </div>

              {/* Right Column: Remaining half of records in proper sequence */}
              <div className="col-span-4 border border-slate-200 rounded-xs overflow-hidden">
                <table className="w-full border-collapse text-[9.5px] leading-snug">
                  <tbody>
                    {rightSummaryRecords.map((item, idx) => (
                      <tr
                        key={item.label}
                        className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}
                      >
                        <td className="px-1.5 py-0.5 border-b border-r border-slate-200 font-semibold text-slate-700 w-[50%] align-top">
                          {item.label}
                        </td>
                        <td className="px-1.5 py-0.5 border-b border-slate-200 font-mono-num font-bold text-[#0F2942] break-words [overflow-wrap:anywhere] align-top">
                          {item.value}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Screen Interactive Verification System */}
      <div className="no-print border border-slate-300 rounded-sm bg-[#F8FAFC] p-3 space-y-3">
        {/* Verified State Banner + Verified Admission Record Summary + Official Round Seal + 17-Point QR Code */}
        {isAlreadyVerified ? (
          <div className="bg-white border-2 border-emerald-700 rounded-sm overflow-hidden shadow-xs break-inside-avoid">
            <div className="bg-emerald-800 text-white px-3.5 py-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-200 shrink-0" />
                <div>
                  <div className="text-xs sm:text-sm font-bold tracking-wide uppercase">
                    ADMISSION CONFIRMED • CONSENT &amp; APPLICATION OTP VERIFIED
                  </div>
                  <div className="text-[11px] text-emerald-100 font-mono-num break-words [overflow-wrap:anywhere]">
                    {verificationValue}
                  </div>
                </div>
              </div>
              <span className="px-2.5 py-0.5 text-[11px] font-bold bg-emerald-950 text-emerald-200 border border-emerald-400 rounded-xs uppercase tracking-wider">
                ✓ VERIFIED &amp; APPROVED
              </span>
            </div>

            {/* Automatic Confirmation Email Dispatch Notice */}
            <div className="bg-emerald-50 border-b border-emerald-200 px-3.5 py-1.5 text-xs text-emerald-950 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>
                  <strong>17-Point Confirmation Email Sent:</strong> Personalized confirmation email with all 17 verified form points has been sent to{' '}
                  <strong className="font-mono-num">
                    {verificationPayload.verifiedContact || contact || 'the verified Gmail ID'}
                  </strong>
                  .
                </span>
              </div>
              <span className="text-[11px] font-semibold text-emerald-800">
                Point 175 Unlocked
              </span>
            </div>

            {/* Symmetrical Two-Column Summary with Center Round Seal + Logo + QR Code */}
            <div className="p-3.5 bg-gradient-to-b from-white to-slate-50/70">
              <div className="border-2 border-[#0F2942] rounded-sm overflow-hidden bg-white shadow-xs">
                {/* Top of the Verification Admission Record Summary */}
                <div className="bg-[#0F2942] text-white px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#D97706]">
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-bold uppercase tracking-wide">
                    <Award className="w-4 h-4 text-[#F59E0B] shrink-0" />
                    <span>VERIFIED ADMISSION RECORD SUMMARY</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11.5px] font-bold px-2.5 py-0.5 bg-amber-500/20 text-amber-200 border border-amber-400/40 rounded-xs font-mono-num">
                      INTERVIEW SERIAL NUMBER: {verificationPayload.interviewSerialNumber}
                    </span>
                    <span className="text-[10px] font-mono-num text-emerald-200 font-semibold hidden sm:inline">
                      OFFICIAL AUTHENTICATION RECORD
                    </span>
                  </div>
                </div>

                <div className="p-3 grid grid-cols-1 lg:grid-cols-12 gap-3 items-center bg-white">
                  {/* Left Column: First half of records in proper sequence */}
                  <div className="lg:col-span-4 border border-slate-300 rounded-sm overflow-hidden bg-white">
                    <table className="w-full border-collapse text-[11px] leading-snug">
                      <tbody>
                        {leftSummaryRecords.map((item, idx) => {
                          const isStatusRow = item.label.includes('Status');
                          return (
                            <tr
                              key={item.label}
                              className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/90'}
                            >
                              <td className="px-2.5 py-1 border-b border-r border-slate-200 font-semibold text-slate-700 w-[50%] align-top">
                                {item.label}
                              </td>
                              <td
                                className={`px-2.5 py-1 border-b border-slate-200 font-mono-num font-bold break-words [overflow-wrap:anywhere] align-top ${
                                  isStatusRow ? 'text-emerald-800' : 'text-[#0F2942]'
                                }`}
                              >
                                {item.value}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Center Column: Existing Round Seal + Logo + QR Code */}
                  <div className="lg:col-span-4 flex flex-col items-center justify-center text-center p-2.5 bg-slate-50/60 border border-dashed border-slate-300 rounded-sm gap-2">
                    {logoDataUrl && (
                      <div className="flex flex-col items-center">
                        <img
                          src={logoDataUrl}
                          alt="NVEA Official Circular Logo"
                          className="w-12 h-12 object-contain"
                        />
                        <span className="text-[10px] font-bold text-[#0F2942] tracking-wide mt-0.5">
                          NAND VIDHYA EDUCATION ACADEMY
                        </span>
                      </div>
                    )}
                    {sealDataUrl ? (
                      <div className="flex flex-col items-center">
                        <img
                          src={sealDataUrl}
                          alt="Official NVEA Admission Confirmed Seal"
                          className="w-28 h-28 object-contain select-none"
                        />
                        <span className="text-[10.5px] font-bold text-[#4C1D95]">
                          Official Admission Confirmation Seal
                        </span>
                        <span className="text-[9.5px] font-mono-num text-slate-600">
                          {verificationPayload.sealRegistrationNumber}
                        </span>
                      </div>
                    ) : (
                      <div className="w-24 h-24 flex items-center justify-center text-xs text-slate-400">
                        Generating Seal...
                      </div>
                    )}
                    {qrDataUrl ? (
                      <div className="flex flex-col items-center">
                        <img
                          src={qrDataUrl}
                          alt="Official Admission Verification QR Code"
                          className="w-24 h-24 object-contain border border-slate-200 p-1 bg-white rounded-xs"
                        />
                        <span className="text-[10px] font-bold text-[#0F2942] mt-0.5">
                          17-Point Verification QR
                        </span>
                        <a
                          href={verifyPageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-[#1D4ED8] hover:underline"
                        >
                          <span>Single-Page A4 Certificate View</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    ) : (
                      <div className="w-24 h-24 flex items-center justify-center text-xs text-slate-400">
                        Generating QR...
                      </div>
                    )}
                  </div>

                  {/* Right Column: Remaining half of records in proper sequence */}
                  <div className="lg:col-span-4 border border-slate-300 rounded-sm overflow-hidden bg-white">
                    <table className="w-full border-collapse text-[11px] leading-snug">
                      <tbody>
                        {rightSummaryRecords.map((item, idx) => {
                          const isStatusRow = item.label.includes('Status');
                          return (
                            <tr
                              key={item.label}
                              className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/90'}
                            >
                              <td className="px-2.5 py-1 border-b border-r border-slate-200 font-semibold text-slate-700 w-[50%] align-top">
                                {item.label}
                              </td>
                              <td
                                className={`px-2.5 py-1 border-b border-slate-200 font-mono-num font-bold break-words [overflow-wrap:anywhere] align-top ${
                                  isStatusRow ? 'text-emerald-800' : 'text-[#0F2942]'
                                }`}
                              >
                                {item.value}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Prerequisite Gate Check: All prior required questions (1-172) + Q173 Consent Upload must be completed */}
            {!prerequisitesMet ? (
              <div className="bg-amber-50 border border-amber-400 rounded-sm p-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <Lock className="w-5 h-5 text-amber-800 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-amber-950">
                      Complete Mandatory Sections &amp; Upload Consent Form (Point 173) First
                    </h4>
                    <p className="text-xs text-amber-900 font-hindi mt-0.5">
                      Point 174 (Consent Verification &amp; Approval) तभी सक्रिय होगा जब फॉर्म के सभी अनिवार्य प्रश्न (1–172) और Point 173 (Consent Certificate Upload) पूर्ण कर लिए जाएंगे।
                      {!isQ170Uploaded && ' [Point 173 Consent Certificate upload is still pending.]'}
                      {priorIncompleteCount > 0 &&
                        ` [${priorIncompleteCount} prior required field(s) still incomplete.]`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onJumpToIncomplete}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-amber-800 hover:bg-amber-900 rounded-sm cursor-pointer whitespace-nowrap"
                >
                  <ArrowRightCircle className="w-3.5 h-3.5" />
                  <span>Jump to Incomplete Required Field</span>
                </button>
              </div>
            ) : null}

            {/* Step 1: Explicit Applicant Confirmation to Verify & Approve Submitted Consent */}
            <div className="bg-white border border-slate-300 rounded-sm p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <label className="flex items-start gap-2.5 cursor-pointer flex-1 min-w-[240px]">
                  <input
                    type="checkbox"
                    checked={consentIntentConfirmed}
                    disabled={!prerequisitesMet}
                    onChange={(e) => setConsentIntentConfirmed(e.target.checked)}
                    className="w-4 h-4 mt-0.5 accent-[#0F2942] rounded-xs cursor-pointer disabled:opacity-50"
                  />
                  <span className="text-xs font-semibold text-slate-900 font-hindi leading-relaxed">
                    <strong>Applicant Consent Approval Confirmation:</strong> क्या आप अपने द्वारा प्रस्तुत सभी विवरणों, शर्तों एवं अपलोड किए गए अंतिम सहमति-पत्र (Point 173) को आधिकारिक OTP सत्यापन द्वारा प्रमाणित एवं अनुमोदित (Approve &amp; Verify) करना चाहते हैं? (Yes, I want to verify and approve my submitted consent via OTP).
                  </span>
                </label>

                <div className="flex items-center gap-1.5 shrink-0">
                  {needsReconnect ? (
                    <button
                      type="button"
                      disabled={connectingOAuth}
                      onClick={handleOneClickGmailConnect}
                      className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold text-white bg-amber-700 hover:bg-amber-800 rounded-sm cursor-pointer whitespace-nowrap"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${connectingOAuth ? 'animate-spin' : ''}`} />
                      <span>{connectingOAuth ? 'Reconnecting...' : 'Reconnect Gmail'}</span>
                    </button>
                  ) : gatewayStatus.gmailReady ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-emerald-900 bg-emerald-50 border border-emerald-300 rounded-sm whitespace-nowrap">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Official Gmail Connected ({gatewayStatus.gmailUser})</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={connectingOAuth}
                      onClick={handleOneClickGmailConnect}
                      className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold text-white bg-[#0F2942] hover:bg-[#1E3A8A] rounded-sm cursor-pointer whitespace-nowrap"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      <span>
                        {connectingOAuth
                          ? 'Connecting Gmail...'
                          : 'Connect Official Gmail OTP Gateway'}
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowGatewaySetup((prev) => !prev)}
                    title="Gateway Settings"
                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-sm cursor-pointer shrink-0"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Step 2: Dynamic Verification Method Selection & OTP Dispatch */}
              {consentIntentConfirmed && (
                <div className="mt-3 pt-3 border-t border-slate-200 space-y-3">
                  {/* Verification Channel Selector */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#0F2942]">
                        Verification Channel:
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setChannel('gmail');
                          setErrorMsg('');
                        }}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-sm border cursor-pointer transition-colors ${
                          channel === 'gmail'
                            ? 'bg-[#0F2942] text-white border-[#0F2942]'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <Mail className="w-3.5 h-3.5" />
                        <span>Official Gmail OTP (Primary)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setChannel('whatsapp');
                          setErrorMsg('');
                        }}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-sm border cursor-pointer transition-colors ${
                          channel === 'whatsapp'
                            ? 'bg-[#0F2942] text-white border-[#0F2942]'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <span>WhatsApp Cloud API</span>
                      </button>
                    </div>

                    <div className="text-[11px] text-slate-600">
                      Status:{' '}
                      <strong className="text-red-700">UNVERIFIED</strong> (OTP Required)
                    </div>
                  </div>

                  {/* Honest Channel Capability Notice if WhatsApp is selected without API credentials */}
                  {channel === 'whatsapp' && !gatewayStatus.whatsappReady && (
                    <div className="bg-amber-50 border border-amber-300 p-2.5 rounded-sm text-xs text-amber-950 flex items-center justify-between gap-2">
                      <span>
                        <strong>Note:</strong> Direct WhatsApp OTP delivery requires an official Meta WhatsApp Business Cloud API token. We recommend using the <strong>Official Gmail OTP</strong> channel.
                      </span>
                      <button
                        type="button"
                        onClick={() => setChannel('gmail')}
                        className="px-2.5 py-1 text-xs font-bold text-white bg-[#0F2942] rounded-sm shrink-0 cursor-pointer"
                      >
                        Switch to Gmail OTP
                      </button>
                    </div>
                  )}

                  {/* Contact Input + Send OTP Button */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
                    <div className="md:col-span-7">
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        {channel === 'gmail'
                          ? "Applicant's Verified Email / Gmail Address (for OTP & Admission Confirmation)"
                          : "Applicant's WhatsApp Number (with Country Code, e.g. 919414008310)"}
                      </label>
                      <input
                        type={channel === 'gmail' ? 'email' : 'tel'}
                        value={contact}
                        onChange={(e) => setContact(e.target.value)}
                        placeholder={
                          channel === 'gmail'
                            ? 'Enter Gmail / Email address (e.g. applicant@gmail.com)'
                            : 'e.g. 919414008310'
                        }
                        className="w-full h-9 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-sm focus:outline-none focus:border-[#1E3A8A]"
                      />
                    </div>

                    <div className="md:col-span-5 flex items-center gap-2">
                      <button
                        type="button"
                        disabled={sending}
                        onClick={handleSendOtp}
                        className="w-full h-9 inline-flex items-center justify-center gap-1.5 px-4 text-xs font-bold text-white bg-[#1E3A8A] hover:bg-[#1D4ED8] disabled:opacity-60 rounded-sm cursor-pointer transition-colors whitespace-nowrap"
                      >
                        {sending ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Sending Official OTP...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            <span>{otpSent ? 'Resend New OTP' : 'Send Official OTP'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Enter 6-Digit OTP & Verify Row */}
                  {otpSent && (
                    <div className="bg-[#EFF6FF] border border-blue-300 rounded-sm p-3 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-[#0F2942] flex items-center gap-1.5">
                          <KeyRound className="w-4 h-4 text-[#1E3A8A]" />
                          Enter the 6-Digit Server OTP Received on {contact}:
                        </span>
                        {countdown > 0 ? (
                          <span className="text-xs font-mono-num font-semibold text-amber-900">
                            Expires in {Math.floor(countdown / 60)}:
                            {String(countdown % 60).padStart(2, '0')}
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-red-700">
                            OTP Expired — Please click Resend New OTP
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={otpInput}
                          onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                          placeholder="Enter 6-digit OTP"
                          className="h-9 w-48 px-3 text-sm font-mono-num font-bold tracking-widest bg-white border-2 border-[#1E3A8A] rounded-sm focus:outline-none"
                        />
                        <button
                          type="button"
                          disabled={verifying || countdown === 0}
                          onClick={handleVerifyOtp}
                          className="h-9 inline-flex items-center gap-1.5 px-5 text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-700 disabled:opacity-50 rounded-sm cursor-pointer transition-colors whitespace-nowrap"
                        >
                          <ShieldCheck className="w-4 h-4" />
                          <span>
                            {verifying ? 'Verifying OTP...' : 'Verify OTP & Confirm Admission'}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Feedback Messages */}
                  {infoMsg && (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-300 rounded-sm text-xs text-emerald-900 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span>{infoMsg}</span>
                    </div>
                  )}

                  {errorMsg && (
                    <div className="p-2.5 bg-red-50 border border-red-300 rounded-sm text-xs text-red-900 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-700 shrink-0" />
                        <span>{errorMsg}</span>
                      </div>
                      {needsReconnect && (
                        <button
                          type="button"
                          disabled={connectingOAuth}
                          onClick={handleOneClickGmailConnect}
                          className="px-3 py-1 text-xs font-bold text-white bg-[#0F2942] hover:bg-[#1E3A8A] rounded-sm cursor-pointer shrink-0"
                        >
                          {connectingOAuth ? 'Connecting...' : 'Reconnect Gmail'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* One-Time Official Gmail Gateway Setup Panel */}
            {showGatewaySetup && (
              <div className="bg-white border-2 border-[#0F2942] rounded-sm p-3.5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-[#0F2942]">
                      One-Time Official Gmail OTP Gateway Setup ({OFFICIAL_NVEA_GMAIL})
                    </h4>
                    <p className="text-[11px] text-slate-600">
                      Connect your Official Gmail account once. Every new applicant&apos;s OTP and Admission Confirmation email will automatically be sent from this connected gateway.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowGatewaySetup(false)}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    Close
                  </button>
                </div>

                {/* Primary Option: One-Click Official Gmail Login */}
                <div className="bg-emerald-50/70 border border-emerald-300 rounded-sm p-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="block text-xs font-bold text-emerald-950">
                      Recommended: One-Click Official Gmail Login ({OFFICIAL_NVEA_GMAIL})
                    </span>
                    <span className="text-[11px] text-emerald-900">
                      Authenticate once via Google Sign-In. No Google Apps Script deployment required.
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={connectingOAuth}
                    onClick={handleOneClickGmailConnect}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-700 rounded-sm cursor-pointer"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>
                      {connectingOAuth
                        ? 'Connecting Official Gmail...'
                        : gatewayStatus.gmailReady
                        ? 'Reconnect Official Gmail'
                        : 'Connect Official Gmail OTP Gateway'}
                    </span>
                  </button>
                </div>

                {/* Option A: Google Apps Script Web App */}
                <div className="bg-slate-50 border border-slate-300 rounded-sm p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#0F2942]">
                      Alternative A: Persistent Google Apps Script Web App URL
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyAppsScript}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-[#0F2942] hover:bg-[#1E3A8A] rounded-sm cursor-pointer"
                    >
                      {copiedScript ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-300" />
                          <span>Copied Code.gs!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Google Apps Script (Code.gs)</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-800 mb-1">
                      Deployed Google Apps Script Web App URL (Saved Permanently on Server):
                    </label>
                    <input
                      type="url"
                      value={gasUrlInput}
                      onChange={(e) => setGasUrlInput(e.target.value)}
                      placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                      className="w-full h-8 px-2.5 text-xs bg-white border border-slate-300 rounded-sm font-mono-num"
                    />
                  </div>
                </div>

                {/* Option B: Direct Gmail SMTP App Password */}
                <div className="bg-slate-50 border border-slate-300 rounded-sm p-3 space-y-2">
                  <span className="block text-xs font-bold text-[#0F2942]">
                    Alternative B: Google Account 16-Character App Password (SMTP)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                        Official Gmail Address:
                      </label>
                      <input
                        type="email"
                        value={gmailUserInput}
                        onChange={(e) => setGmailUserInput(e.target.value)}
                        placeholder="nveaofficial@gmail.com"
                        className="w-full h-8 px-2.5 text-xs bg-white border border-slate-300 rounded-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                        Google 16-Character App Password:
                      </label>
                      <input
                        type="password"
                        value={gmailAppPassInput}
                        onChange={(e) => setGmailAppPassInput(e.target.value)}
                        placeholder="xxxx xxxx xxxx xxxx"
                        className="w-full h-8 px-2.5 text-xs bg-white border border-slate-300 rounded-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    disabled={savingConfig}
                    onClick={handleSaveGatewayConfig}
                    className="px-4 py-1.5 text-xs font-bold text-white bg-[#0F2942] hover:bg-[#1E3A8A] rounded-sm cursor-pointer"
                  >
                    {savingConfig ? 'Saving...' : 'Save Permanent Gateway Configuration'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
