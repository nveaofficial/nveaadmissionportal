import QRCode from 'qrcode';
import { FormAnswers } from '../components/PortalRenderer';

export interface OtpVerificationRecord {
  recordNumber: string;
  verificationId: string;
  applicantName: string;
  rollNumber: string;
  enrollmentNumber: string;
  courseClass: string;
  verificationStatus: 'OTP VERIFIED';
  verifiedAt: string;
  verifiedContact?: string;
  verifiedChannel?: string;
}

function cleanFieldStr(val: string | string[] | undefined): string {
  if (Array.isArray(val)) {
    return val.map((v) => String(v).trim()).filter(Boolean).join(', ');
  }
  if (typeof val === 'string') {
    return val.trim();
  }
  return '';
}

/**
 * Extracts only the applicant's basic admission information from the form answers
 * for the OTP Verification Seal & Secure QR Verification Page.
 * Strictly excludes any sensitive personal data, passwords, OTPs, or credentials.
 */
export function extractBasicAdmissionInfo(
  recordNumber: string,
  answers: FormAnswers
): {
  applicantName: string;
  rollNumber: string;
  enrollmentNumber: string;
  courseClass: string;
} {
  const applicantName =
    cleanFieldStr(answers.q2) ||
    cleanFieldStr(answers.q119) ||
    'Applicant';

  const rollNumber =
    cleanFieldStr(answers.q41) ||
    cleanFieldStr(answers.q131) ||
    cleanFieldStr(answers.q40) ||
    cleanFieldStr(answers.q130) ||
    cleanFieldStr(answers.q42) ||
    cleanFieldStr(answers.q132) ||
    'Assigned by NVEA';

  const enrollmentNumber =
    cleanFieldStr(answers.q43) ||
    cleanFieldStr(answers.q133) ||
    cleanFieldStr(answers.q48) ||
    cleanFieldStr(answers.q136) ||
    recordNumber;

  const courseParts = [
    cleanFieldStr(answers.q72),
    cleanFieldStr(answers.q74) || cleanFieldStr(answers.q145),
    cleanFieldStr(answers.q49) || cleanFieldStr(answers.q134),
    cleanFieldStr(answers.q67) || cleanFieldStr(answers.q144),
  ].filter(Boolean);

  const courseClass =
    courseParts.length > 0 ? courseParts[0] : 'NVEA CLAP Admission Program';

  return {
    applicantName,
    rollNumber,
    enrollmentNumber,
    courseClass,
  };
}

/**
 * Builds the secure verification page URL encoded inside the application's unique QR code.
 * Contains ONLY basic admission verification identifiers (never passwords, OTPs, or credentials).
 */
export function buildVerificationPageUrl(
  record: OtpVerificationRecord,
  origin?: string
): string {
  const baseOrigin =
    origin ||
    (typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://www.nvea.in');

  const params = new URLSearchParams();
  params.set('verify', record.recordNumber);
  params.set('vid', record.verificationId);
  params.set('n', record.applicantName);
  params.set('r', record.rollNumber);
  params.set('e', record.enrollmentNumber);
  params.set('c', record.courseClass);
  params.set('s', 'OTP VERIFIED');
  params.set('d', record.verifiedAt);

  return `${baseOrigin}/?${params.toString()}`;
}

/**
 * Generates a high-resolution QR Code PNG Data URL for the verified application.
 */
export async function generateVerificationQrPngDataUrl(
  record: OtpVerificationRecord,
  origin?: string
): Promise<string> {
  const url = buildVerificationPageUrl(record, origin);
  return QRCode.toDataURL(url, {
    width: 320,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#0F2942',
      light: '#FFFFFF',
    },
  });
}

/**
 * Formats an ISO date string into a readable official date & time string.
 */
export function formatVerificationDate(isoString?: string): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch {
    return isoString;
  }
}

/**
 * Generates a high-resolution transparent PNG of the Official NVEA OTP Verification Seal / Stamp
 * suitable for embedding in both the HTML form and the generated PDF document.
 */
export function generateVerificationSealPngDataUrl(
  record: OtpVerificationRecord
): string {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  const W = 520;
  const H = 210;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Outer stamp border (Double-line institutional stamp)
  ctx.fillStyle = '#F0FDF4';
  ctx.fillRect(4, 4, W - 8, H - 8);

  ctx.strokeStyle = '#047857';
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, W - 12, H - 12);

  ctx.strokeStyle = '#0F2942';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(12, 12, W - 24, H - 24);

  // Left circular emblem seal inside the stamp
  const cx = 82;
  const cy = H / 2;
  const rOuter = 58;

  ctx.beginPath();
  ctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
  ctx.fillStyle = '#0F2942';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#D97706';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, rOuter - 7, 0, Math.PI * 2);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#FDE68A';
  ctx.setLineDash([4, 3]);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#FDE68A';
  ctx.textAlign = 'center';
  ctx.font = 'bold 12px "Plus Jakarta Sans", Arial, sans-serif';
  ctx.fillText('★ NVEA ★', cx, cy - 22);

  ctx.fillStyle = '#34D399';
  ctx.font = 'bold 14px "Plus Jakarta Sans", Arial, sans-serif';
  ctx.fillText('OTP', cx, cy - 2);
  ctx.fillText('VERIFIED', cx, cy + 15);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 9.5px "JetBrains Mono", monospace';
  ctx.fillText('OFFICIAL SEAL', cx, cy + 32);

  // Right side textual details of the stamp
  const tx = 156;
  ctx.textAlign = 'left';

  ctx.fillStyle = '#0F2942';
  ctx.font = 'bold 14.5px "Plus Jakarta Sans", Arial, sans-serif';
  ctx.fillText('NAND VIDHYA EDUCATION ACADEMY (NVEA)', tx, 38);

  // Green verified ribbon bar
  ctx.fillStyle = '#047857';
  ctx.fillRect(tx, 47, W - tx - 22, 28);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 14px "Plus Jakarta Sans", Arial, sans-serif';
  ctx.fillText('✓ APPLICATION STATUS: OTP VERIFIED', tx + 10, 66);

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 12px "JetBrains Mono", monospace';
  ctx.fillText(`Record ID   : ${record.recordNumber}`, tx, 98);
  ctx.fillText(`Seal Number : ${record.verificationId}`, tx, 118);

  const applicantShort =
    record.applicantName.length > 28
      ? record.applicantName.slice(0, 28) + '...'
      : record.applicantName;
  ctx.font = 'bold 12px "Plus Jakarta Sans", Arial, sans-serif';
  ctx.fillText(`Applicant   : ${applicantShort}`, tx, 138);

  const formattedDate = formatVerificationDate(record.verifiedAt);
  ctx.fillStyle = '#047857';
  ctx.font = 'bold 11.5px "JetBrains Mono", monospace';
  ctx.fillText(`Verified On : ${formattedDate}`, tx, 158);

  ctx.fillStyle = '#64748B';
  ctx.font = '600 10px "Plus Jakarta Sans", Arial, sans-serif';
  ctx.fillText(
    'Digitally Authenticated under IT Act, 2000 & Indian Evidence Act, 1872',
    tx,
    182
  );

  return canvas.toDataURL('image/png');
}
