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
} from 'lucide-react';

export interface ConsentVerificationData {
  verified: boolean;
  statusText: string; // "Consent Verified / Approved" when verified
  verifiedContact?: string;
  verifiedChannel?: string;
  verifiedAt?: string;
  verificationId?: string;
}

interface ConsentVerificationFieldProps {
  recordNumber: string;
  applicantName: string;
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
          "<p>Your One-Time Password (OTP) for Point 171 (Consent Verification & Approval) for Record <b>" + recordNo + "</b> is:</p>" +
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
  const [contact, setContact] = useState<string>('');
  const [otpInput, setOtpInput] = useState<string>('');

  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [sending, setSending] = useState<boolean>(false);
  const [verifying, setVerifying] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [infoMsg, setInfoMsg] = useState<string>('');
  const [countdown, setCountdown] = useState<number>(0);

  // Gateway configuration state
  const [gatewayStatus, setGatewayStatus] = useState<{
    gmailReady: boolean;
    gmailMethod: string;
    whatsappReady: boolean;
    googleAppsScriptUrl: string;
    gmailUser: string;
  }>({
    gmailReady: false,
    gmailMethod: 'unconfigured',
    whatsappReady: false,
    googleAppsScriptUrl: localStorage.getItem(LOCAL_GAS_URL_KEY) || '',
    gmailUser: 'nveaofficial@gmail.com',
  });

  const [showGatewaySetup, setShowGatewaySetup] = useState<boolean>(false);
  const [gasUrlInput, setGasUrlInput] = useState<string>(
    localStorage.getItem(LOCAL_GAS_URL_KEY) || ''
  );
  const [gmailUserInput, setGmailUserInput] = useState<string>('nveaofficial@gmail.com');
  const [gmailAppPassInput, setGmailAppPassInput] = useState<string>('');
  const [savingConfig, setSavingConfig] = useState<boolean>(false);
  const [copiedScript, setCopiedScript] = useState<boolean>(false);
  const [verifiedMeta, setVerifiedMeta] = useState<ConsentVerificationData | null>(null);

  // Check server gateway configuration on mount
  useEffect(() => {
    let active = true;
    fetch('/api/otp/status')
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        const storedGas = localStorage.getItem(LOCAL_GAS_URL_KEY) || '';
        const effectiveGas = data.googleAppsScriptUrl || storedGas;
        setGatewayStatus({
          gmailReady: Boolean(data.gmailReady || effectiveGas),
          gmailMethod: data.gmailMethod || (effectiveGas ? 'google_apps_script' : 'unconfigured'),
          whatsappReady: Boolean(data.whatsappReady),
          googleAppsScriptUrl: effectiveGas,
          gmailUser: data.gmailUser || 'nveaofficial@gmail.com',
        });
        if (effectiveGas) setGasUrlInput(effectiveGas);
        if (data.gmailUser) setGmailUserInput(data.gmailUser);
      })
      .catch(() => {
        // Standalone file mode fallback
        const storedGas = localStorage.getItem(LOCAL_GAS_URL_KEY) || '';
        if (active && storedGas) {
          setGatewayStatus((prev) => ({
            ...prev,
            gmailReady: true,
            gmailMethod: 'google_apps_script',
            googleAppsScriptUrl: storedGas,
          }));
        }
      });
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
        setShowGatewaySetup(false);
        setInfoMsg('Official Gmail OTP gateway configuration saved successfully.');
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
      // Standalone mode
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
      // First try Express backend /api/otp/send
      const res = await fetch('/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel,
          contact: cleanContact,
          recordNumber,
          applicantName,
        }),
      });

      const data = await res.json();
      if (res.ok && data.ok && data.delivered) {
        setOtpSent(true);
        setCountdown(data.expiresInSeconds || 300);
        setInfoMsg(
          `A 6-digit OTP has been generated server-side and delivered to ${cleanContact}. Valid for 5 minutes.`
        );
        return;
      }

      if (data.code === 'GMAIL_NOT_CONFIGURED' || data.code === 'WHATSAPP_NOT_CONFIGURED') {
        setShowGatewaySetup(true);
      }
      setErrorMsg(data.error || 'Could not deliver OTP. Please check gateway configuration.');
    } catch {
      // Fallback for standalone downloaded HTML file: call deployed Google Apps Script Web App directly
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
              applicantName,
            }),
          });
          const gasData = await gasRes.json();
          if (gasData.ok && gasData.delivered) {
            setOtpSent(true);
            setCountdown(300);
            setInfoMsg(
              `A 6-digit OTP has been generated on Google Servers and sent to ${cleanContact}. Valid for 5 minutes.`
            );
            return;
          }
          setErrorMsg(gasData.error || 'Google Apps Script could not send the OTP.');
        } catch (gasErr) {
          setErrorMsg(
            gasErr instanceof Error
              ? gasErr.message
              : 'Failed to reach Google Apps Script Web App.'
          );
        }
      } else {
        setShowGatewaySetup(true);
        setErrorMsg(
          'Server OTP endpoint is unreachable or not configured. Please link your Google Apps Script Web App URL below.'
        );
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
    try {
      const res = await fetch('/api/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact: contact.trim(),
          recordNumber,
          otp: cleanOtp,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok && data.verified) {
        const meta: ConsentVerificationData = {
          verified: true,
          statusText: 'Consent Verified / Approved',
          verifiedContact: data.verifiedContact || contact.trim(),
          verifiedChannel: data.verifiedChannel || channel,
          verifiedAt: data.verifiedAt || new Date().toISOString(),
          verificationId: data.verificationId,
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
      // Fallback for standalone downloaded HTML file: verify against Google Apps Script CacheService
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
            const meta: ConsentVerificationData = {
              verified: true,
              statusText: 'Consent Verified / Approved',
              verifiedContact: gasData.verifiedContact || contact.trim(),
              verifiedChannel: 'gmail',
              verifiedAt: gasData.verifiedAt || new Date().toISOString(),
              verificationId: gasData.verificationId,
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

  return (
    <div className="mt-2">
      {/* Print-Only Summary of Point 171 */}
      <div className="hidden print-only border border-slate-400 p-2 bg-slate-50 text-xs">
        <span className="font-bold text-[#0F2942]">
          Point 171 Status:{' '}
        </span>
        <span className="font-semibold">
          {isAlreadyVerified ? verificationValue : 'UNVERIFIED (Pending OTP Verification)'}
        </span>
      </div>

      {/* Screen Interactive Verification System */}
      <div className="no-print border border-slate-300 rounded-sm bg-[#F8FAFC] p-3 space-y-3">
        {/* Verified State Banner */}
        {isAlreadyVerified ? (
          <div className="bg-emerald-50 border-2 border-emerald-700 rounded-sm p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-6 h-6 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-bold text-emerald-950">
                  Consent Verified / Approved
                </div>
                <p className="text-xs text-emerald-900 font-mono-num mt-0.5">
                  {verificationValue}
                </p>
                {verifiedMeta?.verifiedAt && (
                  <p className="text-[11px] text-emerald-800 mt-0.5">
                    Verified Timestamp: {verifiedMeta.verifiedAt} • Point 172 (Enrolment Status) is now unlocked.
                  </p>
                )}
              </div>
            </div>
            <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
              ✓ OTP Verified
            </span>
          </div>
        ) : (
          <>
            {/* Prerequisite Gate Check: All prior required questions (1-169) + Q170 Consent Upload must be completed */}
            {!prerequisitesMet ? (
              <div className="bg-amber-50 border border-amber-400 rounded-sm p-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <Lock className="w-5 h-5 text-amber-800 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-amber-950">
                      Complete Mandatory Sections &amp; Upload Consent Form (Point 170) First
                    </h4>
                    <p className="text-xs text-amber-900 font-hindi mt-0.5">
                      Point 171 (Consent Verification &amp; Approval) तभी सक्रिय होगा जब फॉर्म के सभी अनिवार्य प्रश्न (1–169) और Point 170 (Consent Certificate Upload) पूर्ण कर लिए जाएंगे।
                      {!isQ170Uploaded && ' [Point 170 Consent Certificate upload is still pending.]'}
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
              <div className="flex items-start justify-between gap-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentIntentConfirmed}
                    disabled={!prerequisitesMet}
                    onChange={(e) => setConsentIntentConfirmed(e.target.checked)}
                    className="w-4 h-4 mt-0.5 accent-[#0F2942] rounded-xs cursor-pointer disabled:opacity-50"
                  />
                  <span className="text-xs font-semibold text-slate-900 font-hindi leading-relaxed">
                    <strong>Applicant Consent Approval Confirmation:</strong> क्या आप अपने द्वारा प्रस्तुत सभी विवरणों, शर्तों एवं अपलोड किए गए अंतिम सहमति-पत्र (Point 170) को आधिकारिक OTP सत्यापन द्वारा प्रमाणित एवं अनुमोदित (Approve &amp; Verify) करना चाहते हैं? (Yes, I want to verify and approve my submitted consent via OTP).
                  </span>
                </label>

                <button
                  type="button"
                  onClick={() => setShowGatewaySetup((prev) => !prev)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[#0F2942] bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-sm cursor-pointer shrink-0 whitespace-nowrap"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>
                    {gatewayStatus.gmailReady ? 'Gmail Gateway: Ready' : 'Setup Gmail OTP Gateway'}
                  </span>
                </button>
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
                        <strong>Note:</strong> Direct WhatsApp OTP delivery requires an official Meta WhatsApp Business Cloud API token. Merely entering a number cannot send a background WhatsApp message from a browser. We recommend using the <strong>Official Gmail OTP</strong> channel.
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
                          ? "Applicant's Verified Email / Gmail Address (for OTP Delivery)"
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
                            <span>Sending Server OTP...</span>
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
                            {verifying ? 'Verifying OTP...' : 'Verify OTP & Approve Consent'}
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
                    <div className="p-2.5 bg-red-50 border border-red-300 rounded-sm text-xs text-red-900 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-700 shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Collapsible 1-Minute Official Google Apps Script / Gmail Setup Panel */}
            {showGatewaySetup && (
              <div className="bg-white border-2 border-[#0F2942] rounded-sm p-3.5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-[#0F2942]">
                      Official Google Gmail OTP Delivery Setup (nveaofficial@gmail.com)
                    </h4>
                    <p className="text-[11px] text-slate-600">
                      Connect your official Gmail account using either Option A (Free Google Apps Script Web App — No 3rd-party service required) or Option B (Gmail 16-digit App Password).
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

                {/* Option A: Google Apps Script Web App */}
                <div className="bg-slate-50 border border-slate-300 rounded-sm p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#0F2942]">
                      Option A (Recommended): Google Apps Script Web App Bridge
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

                  <ol className="list-decimal list-inside text-[11px] text-slate-700 space-y-0.5 leading-relaxed">
                    <li>
                      Open{' '}
                      <a
                        href="https://script.google.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#1D4ED8] underline font-semibold"
                      >
                        https://script.google.com
                      </a>{' '}
                      logged in as <strong>nveaofficial@gmail.com</strong> and click{' '}
                      <strong>New project</strong>.
                    </li>
                    <li>
                      Click <strong>"Copy Google Apps Script (Code.gs)"</strong> above, paste it
                      into the editor replacing existing code, and press <strong>Ctrl+S</strong> to
                      save.
                    </li>
                    <li>
                      Click <strong>Deploy</strong> &rarr; <strong>New deployment</strong> &rarr;
                      Select type: <strong>Web app</strong>.
                    </li>
                    <li>
                      Set <em>Execute as</em>: <strong>Me (nveaofficial@gmail.com)</strong> and{' '}
                      <em>Who has access</em>: <strong>Anyone</strong>, then click{' '}
                      <strong>Deploy</strong> and authorize permissions.
                    </li>
                    <li>
                      Copy the generated <strong>Web App URL</strong> (
                      <code>https://script.google.com/macros/s/.../exec</code>) and paste it below:
                    </li>
                  </ol>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-800 mb-1">
                      Deployed Google Apps Script Web App URL:
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
                    Option B (Alternative): Google Account 16-Character App Password (SMTP)
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
                    {savingConfig ? 'Saving...' : 'Save OTP Gateway Configuration'}
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
