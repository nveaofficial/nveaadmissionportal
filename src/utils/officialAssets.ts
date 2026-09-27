import QRCode from 'qrcode';

/**
 * Generates high-definition transparent PNG data URLs for:
 * 1. The single Official Circular NVEA Logo (for main front-page header & subtle centered page watermark)
 * 2. Union Bank of India Official QR Code Card (scannable UPI QR for 72923201@ubin, matching PDF Pages 60-61)
 *
 * Per Requirement 3: No second/duplicate logo or "CLAP NVEA Kendra" emblem is generated or displayed anywhere.
 */

const CUSTOM_ASSETS_KEY = 'nvea_custom_official_assets_v2';

export interface OfficialAssets {
  nveaCircularLogoPng: string;
  bankQrCardPng: string;
}

export function getStoredCustomAssets(): Partial<OfficialAssets> {
  try {
    const raw = localStorage.getItem(CUSTOM_ASSETS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveStoredCustomAssets(assets: Partial<OfficialAssets>): void {
  try {
    localStorage.setItem(CUSTOM_ASSETS_KEY, JSON.stringify(assets));
  } catch {
    // ignore quota errors
  }
}

/**
 * Renders the single official circular NVEA logo onto a high-DPI transparent canvas
 * and exports it as a crisp transparent PNG data URL.
 */
export function generateNveaCircularLogoPng(): string {
  const size = 600;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const cx = size / 2;
  const cy = size / 2;
  const radius = 280;

  ctx.clearRect(0, 0, size, size);

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  // Outer purple ring (#93278F)
  ctx.strokeStyle = '#93278F';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.arc(cx, cy, radius - 7, 0, Math.PI * 2);
  ctx.stroke();

  // Top emblem: Open Book & Veena/Saraswati motif above NVEA
  const haloGrad = ctx.createRadialGradient(cx, 115, 5, cx, 115, 65);
  haloGrad.addColorStop(0, 'rgba(245, 158, 11, 0.35)');
  haloGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
  ctx.fillStyle = haloGrad;
  ctx.beginPath();
  ctx.arc(cx, 115, 65, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#D97706';
  ctx.beginPath();
  ctx.arc(cx, 95, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#B45309';
  ctx.beginPath();
  ctx.moveTo(cx - 14, 90);
  ctx.lineTo(cx, 64);
  ctx.lineTo(cx + 14, 90);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#92400E';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx - 28, 122);
  ctx.lineTo(cx + 30, 96);
  ctx.stroke();

  // Open Book pages (Blue/White) above NVEA
  ctx.fillStyle = '#E0F2FE';
  ctx.strokeStyle = '#0284C7';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx, 168);
  ctx.quadraticCurveTo(cx - 55, 152, cx - 110, 166);
  ctx.lineTo(cx - 95, 142);
  ctx.quadraticCurveTo(cx - 48, 130, cx, 148);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx, 168);
  ctx.quadraticCurveTo(cx + 55, 152, cx + 110, 166);
  ctx.lineTo(cx + 95, 142);
  ctx.quadraticCurveTo(cx + 48, 130, cx, 148);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = '#1E3A8A';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx - 118, 173);
  ctx.lineTo(cx + 118, 173);
  ctx.stroke();

  // "N" in vibrant orange (#F97316), "VEA" in purple (#93278F)
  ctx.font = 'bold 118px "Plus Jakarta Sans", Georgia, serif';
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = '#F27A24';
  ctx.fillText('N', 108, 282);

  ctx.fillStyle = '#93278F';
  ctx.fillText('VEA', 222, 282);

  // Horizontal Cyan-Blue Bar (#008FD5)
  ctx.fillStyle = '#008FD5';
  ctx.fillRect(96, 290, 408, 16);

  // Hindi "नव्या" in bold Cyan-Blue (#008FD5)
  ctx.fillStyle = '#008FD5';
  ctx.font = 'bold 116px "Noto Sans Devanagari", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('नव्या', cx, 396);

  // "Since 2006"
  ctx.fillStyle = '#1F2937';
  ctx.font = '500 34px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('Since 2006', cx, 438);

  // Founder memorial emblem at bottom of the single official NVEA circular logo
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, 515, 62, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  ctx.fillStyle = '#F3F4F6';
  ctx.fillRect(cx - 65, 450, 130, 130);
  ctx.fillStyle = '#BE185D';
  ctx.beginPath();
  ctx.ellipse(cx, 568, 56, 34, 0, Math.PI, 0, false);
  ctx.fill();
  ctx.fillStyle = '#D97757';
  ctx.beginPath();
  ctx.ellipse(cx, 502, 24, 30, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#6B7280';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(cx, 496, 24, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = '#93278F';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.arc(cx, cy, radius - 6, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
  return canvas.toDataURL('image/png');
}

/**
 * Generates the Union Bank of India Official QR Code Card (Pages 60-61 of PDF)
 * with a genuinely scannable QR code for UPI ID: 72923201@ubin
 */
export async function generateUnionBankQrCardPng(): Promise<string> {
  const width = 520;
  const height = 680;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = '#DC2626';
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, width - 12, height - 12);

  ctx.fillStyle = '#DC2626';
  ctx.font = 'bold 24px "Noto Sans Devanagari", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('यूनियन बैंक', 24, 54);
  ctx.font = 'bold 11px "Noto Sans Devanagari", sans-serif';
  ctx.fillText('ऑफ इंडिया', 58, 70);

  ctx.fillStyle = '#00549A';
  ctx.font = 'bold 34px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('U', 148, 62);

  ctx.fillStyle = '#DC2626';
  ctx.font = 'bold 22px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('Union Bank', 182, 54);
  ctx.font = '12px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('of India', 260, 68);

  ctx.fillStyle = '#DC2626';
  ctx.font = 'bold 22px "Noto Sans Devanagari", sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('अच्छे लोग अच्छा बैंक', width - 24, 56);

  ctx.fillStyle = '#E11D48';
  ctx.fillRect(9, 90, width - 18, 52);
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('NVEA NAND VIDHYA EDUCAT', width / 2, 123);

  ctx.fillStyle = '#0066B3';
  ctx.fillRect(9, 142, width - 18, 365);

  const boxX = 75;
  const boxY = 164;
  const boxW = width - 150;
  const boxH = 322;
  const r = 28;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(boxX + r, boxY);
  ctx.lineTo(boxX + boxW - r, boxY);
  ctx.quadraticCurveTo(boxX + boxW, boxY, boxX + boxW, boxY + r);
  ctx.lineTo(boxX + boxW, boxY + boxH - r);
  ctx.quadraticCurveTo(boxX + boxW, boxY + boxH, boxX + boxW - r, boxY + boxH);
  ctx.lineTo(boxX + r, boxY + boxH);
  ctx.quadraticCurveTo(boxX, boxY + boxH, boxX, boxY + boxH - r);
  ctx.lineTo(boxX, boxY + r);
  ctx.quadraticCurveTo(boxX, boxY, boxX + r, boxY);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#111827';
  ctx.font = 'bold 24px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SCAN & PAY', width / 2, 198);

  const upiString = 'upi://pay?pa=72923201@ubin&pn=NAND%20VIDHYA%20EDUCATION%20ACADEMY&cu=INR';
  try {
    const qrDataUrl = await QRCode.toDataURL(upiString, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 230,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });
    const qrImg = new Image();
    await new Promise<void>((resolve) => {
      qrImg.onload = () => resolve();
      qrImg.onerror = () => resolve();
      qrImg.src = qrDataUrl;
    });
    ctx.drawImage(qrImg, (width - 230) / 2, 210, 230, 230);
  } catch {
    // Fallback
  }

  ctx.fillStyle = '#111827';
  ctx.font = '600 18px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('UPI ID : 72923201@ubin', width / 2, 468);

  ctx.fillStyle = '#374151';
  ctx.font = 'italic bold 34px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('BHIM  |  UPI', width / 2, 554);

  ctx.fillStyle = '#6B7280';
  ctx.font = '600 9px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('BHARAT INTERFACE FOR MONEY      •      UNIFIED PAYMENTS INTERFACE', width / 2, 570);

  ctx.fillStyle = '#0284C7';
  ctx.font = 'bold 18px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('Paytm', 80, 610);

  ctx.fillStyle = '#374151';
  ctx.fillText('G Pay', 175, 610);

  ctx.fillStyle = '#5B21B6';
  ctx.fillText('PhonePe', 285, 610);

  ctx.fillStyle = '#DC2626';
  ctx.fillText('VYOM', 415, 610);

  ctx.fillStyle = '#15803D';
  ctx.font = 'bold 15px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('BHARAT QR ₹', width / 2, 650);

  return canvas.toDataURL('image/png');
}
