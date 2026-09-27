import { jsPDF } from 'jspdf';
import { PORTALS, QUESTIONS, QuestionItem, isQuestionRequired } from '../data/formSchema';
import { UploadedFileItem } from '../components/DocumentUploadField';

export interface PdfGenerationInput {
  recordNumber: string;
  formattedDate: string;
  submitted: boolean;
  submissionDateIso?: string;
  answers: Record<string, string | string[]>;
  uploadedFiles: Record<string, UploadedFileItem[]>;
  nveaCircularLogoPng: string;
  bankQrCardPng: string;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  font: string
): string[] {
  if (!text) return [];
  ctx.font = font;
  const paragraphs = text.split(/\r?\n/);
  const lines: string[] = [];

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) {
      lines.push('');
      continue;
    }
    const words = trimmed.split(/\s+/);
    let currentLine = words[0] || '';

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const testLine = `${currentLine} ${word}`;
      if (ctx.measureText(testLine).width <= maxWidth) {
        currentLine = testLine;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    lines.push(currentLine);
  }
  return lines;
}

/**
 * Generates a strictly sequential, properly paginated multi-page A4 PDF file
 * containing all 10 portals, all 172 questions in exact order (1 to 172),
 * the single official NVEA circular logo & watermark, Union Bank QR code,
 * and uncropped visual previews of all uploaded documents.
 */
export async function generateAdmissionFormPdf(
  input: PdfGenerationInput
): Promise<{ blob: Blob; file: File; fileName: string }> {
  // A4 at 150 DPI: 1240 x 1754 px (210mm x 297mm)
  const PAGE_W = 1240;
  const PAGE_H = 1754;
  const MARGIN_X = 44;
  const MARGIN_TOP = 42;
  const MARGIN_BOTTOM = 54;
  const CONTENT_W = PAGE_W - MARGIN_X * 2;
  const MAX_Y = PAGE_H - MARGIN_BOTTOM;

  // Preload official logos and uploaded images
  const logoImg = await loadImage(input.nveaCircularLogoPng);
  const qrImg = await loadImage(input.bankQrCardPng);

  const uploadedImgMap = new Map<string, (HTMLImageElement | null)[]>();
  for (const q of QUESTIONS) {
    if (q.inputType === 'file') {
      const files = input.uploadedFiles[q.id] || [];
      const loaded: (HTMLImageElement | null)[] = [];
      for (const f of files) {
        if (f.dataUrl && !f.name.toLowerCase().endsWith('.pdf') && f.type !== 'application/pdf') {
          loaded.push(await loadImage(f.dataUrl));
        } else {
          loaded.push(null);
        }
      }
      uploadedImgMap.set(q.id, loaded);
    }
  }

  const pageCanvases: HTMLCanvasElement[] = [];
  let currentCanvas = document.createElement('canvas');
  let ctx = currentCanvas.getContext('2d')!;
  let curY = MARGIN_TOP;

  const startNewPage = (isFirstPage: boolean) => {
    currentCanvas = document.createElement('canvas');
    currentCanvas.width = PAGE_W;
    currentCanvas.height = PAGE_H;
    ctx = currentCanvas.getContext('2d')!;
    pageCanvases.push(currentCanvas);

    // Crisp white paper background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, PAGE_W, PAGE_H);

    // Outer institutional frame border
    ctx.strokeStyle = '#0F2942';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(24, 24, PAGE_W - 48, PAGE_H - 48);

    // Subtle Centered Official NVEA Circular Logo Watermark on EVERY page
    if (logoImg) {
      ctx.save();
      ctx.globalAlpha = 0.065;
      const wmSize = 440;
      ctx.drawImage(logoImg, (PAGE_W - wmSize) / 2, (PAGE_H - wmSize) / 2, wmSize, wmSize);
      ctx.restore();
    }

    curY = MARGIN_TOP;

    if (isFirstPage) {
      // Main Front-Page Institutional Header Banner
      const headerH = 148;
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(MARGIN_X, curY, CONTENT_W, headerH);
      ctx.strokeStyle = '#0F2942';
      ctx.lineWidth = 2;
      ctx.strokeRect(MARGIN_X, curY, CONTENT_W, headerH);

      // Single Official NVEA Circular Logo on Left
      if (logoImg) {
        ctx.drawImage(logoImg, MARGIN_X + 16, curY + 14, 120, 120);
      }

      // Center Institutional Heading
      const centerX = MARGIN_X + 146 + (CONTENT_W - 146 - 355) / 2;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#991B1B';
      ctx.font = 'bold 14px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(
        'ONLINE ADMISSION & ENROLMENT FORM PORTAL • SINCE 2006',
        centerX,
        curY + 32
      );

      ctx.fillStyle = '#0F2942';
      ctx.font = 'bold 24px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('NAND VIDHYA EDUCATION ACADEMY (NVEA)', centerX, curY + 64);

      ctx.fillStyle = '#1E3A8A';
      ctx.font = 'bold 17px "Noto Sans Devanagari", "Plus Jakarta Sans", sans-serif';
      ctx.fillText(
        'नव्या — नन्द विद्या शिक्षण संस्थान (स्वतंत्र, वैधानिक रूप से शैक्षिक संस्थान)',
        centerX,
        curY + 94
      );

      ctx.fillStyle = '#334155';
      ctx.font = '600 13.5px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(
        'Creative Learning Activity Program (CLAP) • Website: https://www.nvea.in/ • Helpline: 09414008310',
        centerX,
        curY + 122
      );

      // Right Record Number Box
      const recBoxW = 335;
      const recBoxX = MARGIN_X + CONTENT_W - recBoxW - 12;
      const recBoxY = curY + 14;
      const recBoxH = 120;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(recBoxX, recBoxY, recBoxW, recBoxH);
      ctx.strokeStyle = '#0F2942';
      ctx.lineWidth = 2;
      ctx.strokeRect(recBoxX, recBoxY, recBoxW, recBoxH);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#0F2942';
      ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(
        input.submitted ? 'FINAL SUBMISSION / REF NO.' : 'AUTOMATIC RECORD NUMBER',
        recBoxX + 12,
        recBoxY + 24
      );

      ctx.fillStyle = '#991B1B';
      ctx.font = 'bold 22px "JetBrains Mono", monospace';
      ctx.fillText(input.recordNumber, recBoxX + 12, recBoxY + 56);

      ctx.fillStyle = '#334155';
      ctx.font = '600 12.5px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(
        `Date: ${input.formattedDate}  •  Status: ${input.submitted ? 'Submitted' : 'Saved Draft'}`,
        recBoxX + 12,
        recBoxY + 82
      );

      if (input.submissionDateIso) {
        ctx.fillStyle = '#0F2942';
        ctx.font = 'bold 11px "JetBrains Mono", monospace';
        ctx.fillText(`Submitted ISO: ${input.submissionDateIso}`, recBoxX + 12, recBoxY + 105);
      }

      curY += headerH + 14;
    } else {
      // Running Compact Header on Subsequent Pages
      const runH = 38;
      ctx.fillStyle = '#F1F5F9';
      ctx.fillRect(MARGIN_X, curY, CONTENT_W, runH);
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 1;
      ctx.strokeRect(MARGIN_X, curY, CONTENT_W, runH);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#0F2942';
      ctx.font = 'bold 13.5px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(
        'NAND VIDHYA EDUCATION ACADEMY (NVEA / नव्या) — Official Admission Form',
        MARGIN_X + 12,
        curY + 24
      );

      ctx.textAlign = 'right';
      ctx.fillStyle = '#991B1B';
      ctx.font = 'bold 13.5px "JetBrains Mono", monospace';
      ctx.fillText(`Record No: ${input.recordNumber}`, MARGIN_X + CONTENT_W - 12, curY + 24);
      ctx.textAlign = 'left';

      curY += runH + 12;
    }
  };

  const ensureSpace = (neededHeight: number) => {
    if (curY + neededHeight > MAX_Y) {
      startNewPage(false);
    }
  };

  const drawSubSectionBanner = (title: string, lines: string[], bgColor = '#F8FAFC') => {
    const wrapped: string[] = [];
    for (const l of lines) {
      wrapped.push(
        ...wrapTextLines(
          ctx,
          l,
          CONTENT_W - 28,
          '500 13.5px "Noto Sans Devanagari", "Plus Jakarta Sans", sans-serif'
        )
      );
    }
    const boxH = 34 + wrapped.length * 20 + 10;
    ensureSpace(boxH + 8);

    ctx.fillStyle = bgColor;
    ctx.fillRect(MARGIN_X, curY, CONTENT_W, boxH);
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 1;
    ctx.strokeRect(MARGIN_X, curY, CONTENT_W, boxH);

    // Left accent bar
    ctx.fillStyle = '#0F2942';
    ctx.fillRect(MARGIN_X, curY, 6, boxH);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#0F2942';
    ctx.font = 'bold 15px "Noto Sans Devanagari", "Plus Jakarta Sans", sans-serif';
    ctx.fillText(title, MARGIN_X + 16, curY + 23);

    ctx.fillStyle = '#1E293B';
    ctx.font = '500 13.5px "Noto Sans Devanagari", "Plus Jakarta Sans", sans-serif';
    wrapped.forEach((line, idx) => {
      ctx.fillText(line, MARGIN_X + 16, curY + 45 + idx * 20);
    });

    curY += boxH + 8;
  };

  const isQuestionFilledForPdf = (q: QuestionItem): boolean => {
    if (q.inputType === 'file') {
      const files = input.uploadedFiles[q.id] || [];
      return files.length > 0;
    }
    const raw = input.answers[q.id];
    if (Array.isArray(raw)) {
      return raw.length > 0;
    }
    return typeof raw === 'string' && raw.trim() !== '';
  };

  const formatAnswerForPdf = (q: QuestionItem): string => {
    if (q.inputType === 'file') {
      const files = input.uploadedFiles[q.id] || [];
      return files.map((f) => f.name).join(', ');
    }
    const raw = input.answers[q.id];
    if (Array.isArray(raw)) {
      return raw.join(', ');
    }
    if (typeof raw === 'string' && raw.trim() !== '') {
      return raw.trim();
    }
    return '';
  };

  // Start Page 1
  startNewPage(true);

  let drewResidentBanner = false;
  let drewLiveFeeBanner = false;
  let drewOathIntroBanner = false;
  let drewOathSec12Banner = false;
  let drewStatutoryBanner = false;
  let drewClausesBanner = false;

  // Iterate strictly through Portals 1..10 and include ONLY filled/uploaded Questions in ascending numerical sequence
  for (const portal of PORTALS) {
    const filledPortalQuestions = QUESTIONS.filter(
      (q) => q.portalId === portal.id && isQuestionFilledForPdf(q)
    ).sort((a, b) => a.number - b.number);

    if (filledPortalQuestions.length === 0) {
      continue;
    }

    // Portal Header Bar
    const subtitleLines = portal.subtitle
      ? wrapTextLines(
          ctx,
          portal.subtitle,
          CONTENT_W - 240,
          '500 13px "Noto Sans Devanagari", "Plus Jakarta Sans", sans-serif'
        )
      : [];
    const portalHeaderH = 38 + subtitleLines.length * 19 + 8;
    ensureSpace(portalHeaderH + 90);

    ctx.fillStyle = '#0F2942';
    ctx.fillRect(MARGIN_X, curY, CONTENT_W, portalHeaderH);
    ctx.fillStyle = '#D97706';
    ctx.fillRect(MARGIN_X, curY + portalHeaderH - 4, CONTENT_W, 4);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 17px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(portal.title, MARGIN_X + 14, curY + 25);

    ctx.fillStyle = '#E2E8F0';
    ctx.font = '500 13px "Noto Sans Devanagari", "Plus Jakarta Sans", sans-serif';
    subtitleLines.forEach((line, idx) => {
      ctx.fillText(line, MARGIN_X + 14, curY + 46 + idx * 19);
    });

    ctx.textAlign = 'right';
    ctx.fillStyle = '#FDE68A';
    ctx.font = 'bold 13px "JetBrains Mono", monospace';
    ctx.fillText(
      `Filled: ${filledPortalQuestions.length}`,
      MARGIN_X + CONTENT_W - 14,
      curY + 25
    );
    ctx.textAlign = 'left';

    curY += portalHeaderH + 8;

    for (const q of filledPortalQuestions) {
      // Exact Pre-Question Sub-Section Notices in strict sequence (only when a question in that sub-section is filled)
      if (!drewResidentBanner && q.number >= 21 && q.number <= 35) {
        drewResidentBanner = true;
        drawSubSectionBanner('Resident Information (निवास स्थान संबंधी विवरण)', [
          'इस भाग में विद्यार्थी/शिक्षार्थी/क्लाइंट सिर्फ अपने आवेदन से संबंधित स्थायी अथवा वर्तमान लोकैशन के बारे मे आवश्यक जानकारी साँझा करे। आधिकारिक सरकारी डायरेक्टरी: https://lgdirectory.gov.in/',
        ]);
      }
      if (!drewLiveFeeBanner && q.number >= 116 && q.number <= 117) {
        drewLiveFeeBanner = true;
        drawSubSectionBanner('Live Fee Status', [
          'कितनी फीस जमा है कितनी बकाया है उसका विवरण भरो।',
        ]);
      }
      if (!drewOathIntroBanner && q.number >= 118 && q.number <= 128) {
        drewOathIntroBanner = true;
        drawSubSectionBanner('1. Oath Declaration Portal (आधिकारिक डिजिटल शपथ पत्र)', [
          'यदि नामांकित/शपथकर्ता की आयु 18 वर्ष से कम है, तो यह शपथ/घोषणा केवल उसके वैध अभिभावक द्वारा भारतीय वयस्कता अधिनियम, 1875 की धारा 3 तथा भारतीय अनुबंध अधिनियम, 1872 की धारा 10 के अंतर्गत स्वीकार्य होगी। यदि आयु 18 वर्ष या अधिक है, तो वह स्वयं भारतीय साक्ष्य अधिनियम, 1872 व सूचना प्रौद्योगिकी अधिनियम, 2000 के अंतर्गत इसे प्रमाणित करेगा/करेगी।',
        ]);
      }
      if (!drewOathSec12Banner && q.number >= 129 && q.number <= 134) {
        drewOathSec12Banner = true;
        drawSubSectionBanner(
          'शपथ बयान: 1. संस्थान संबंधी सत्यापन एवं 2. नामांकन स्थिति और सीमा',
          [
            'भारतीय शपथ अधिनियम, 1969 तथा साक्ष्य अधिनियम, 1872 के अंतर्गत शपथकर्ता द्वारा प्रवेशार्थी के CLAP Course/Class/Program मे नामांकन हेतु आधिकारिक डिजिटल सहमति एवं स्वीकृति बयान।',
            '1.1 NAND VIDHYA EDUCATION ACADEMY (NVEA/नव्या) एक स्वतंत्र, वैधानिक रूप से शैक्षिक संस्थान है (स्थापना वर्ष 2006)।',
          ]
        );
      }
      if (!drewStatutoryBanner && q.number >= 135 && q.number <= 169) {
        drewStatutoryBanner = true;
        drawSubSectionBanner(
          'विधिक अधिसूचना / STATUTORY NOTICE: प्रचलित बैच में लर्नर्स की अधिकतम संख्या की सीमा (Maximum Intake Limit)',
          [
            'NVEA के प्रत्येक सक्रिय शैक्षणिक सत्र/बैच/सेमेस्टर में अधिकतम 20 (बीस) लर्नर्स तक ही सीमित एवं आरक्षित (Strictly Restricted to a Maximum of 20 Learners) है।',
          ],
          '#FFFBEB'
        );
      }
      if (!drewClausesBanner && q.number === 170) {
        drewClausesBanner = true;
        drawSubSectionBanner(
          'विस्तृत विधिक घोषणा एवं शर्तें (Clauses 3 to 19) एवं अंतिम सहमति-पत्र (Affidavit)',
          [
            'शपथकर्ता द्वारा संस्थान के विधिक स्वरूप, बोर्ड/विश्वविद्यालय समन्वय, शुल्क संरचना, नो-रिफंड नीति, आचरण संहिता, एवं न्यायिक क्षेत्राधिकार की समस्त शर्तों को पूर्णतः पढ़कर, समझकर एवं स्वीकार कर लिया गया है।',
          ],
          '#F8FAFC'
        );
      }

      // Measure Question Block
      const isReq = isQuestionRequired(q);
      const labelText = `${q.number}. ${q.label}${isReq ? ' *' : ''}${
        q.readOnlyAutoCalc ? ' [Auto-Calculated]' : ''
      }`;
      const labelLines = wrapTextLines(
        ctx,
        labelText,
        CONTENT_W - 28,
        'bold 14.5px "Noto Sans Devanagari", "Plus Jakarta Sans", sans-serif'
      );

      const descLines = q.description
        ? wrapTextLines(
            ctx,
            q.description,
            CONTENT_W - 36,
            '500 12.5px "Noto Sans Devanagari", "Plus Jakarta Sans", sans-serif'
          )
        : [];

      const ansText = formatAnswerForPdf(q);
      const ansLines = wrapTextLines(
        ctx,
        `Answer / उत्तर:  ${ansText}`,
        CONTENT_W - 36,
        'bold 14px "Noto Sans Devanagari", "Plus Jakarta Sans", sans-serif'
      );

      // Check if Question 110 has Bank Legal Notice & QR Code
      const extraQrHeight = q.hasBankLegalNoticeAndQr ? 265 : 0;

      // Check if Question is a File Upload with visual preview images
      const loadedImgs = uploadedImgMap.get(q.id) || [];
      const validImgs = loadedImgs.filter((im): im is HTMLImageElement => im !== null);

      let filePreviewBoxH = 0;
      if (q.inputType === 'file' && validImgs.length > 0) {
        if (q.fileFrameType === 'photo' || q.fileFrameType === 'signature') {
          filePreviewBoxH = 220;
        } else if (q.fileFrameType === 'aadhaar_half') {
          filePreviewBoxH = 520;
        } else {
          // Full A4 page-style preview sized so question header + preview fit cleanly on one A4 page
          filePreviewBoxH = 1120;
        }
      }

      const textPartH =
        12 +
        labelLines.length * 20 +
        (descLines.length > 0 ? descLines.length * 17 + 6 : 0) +
        8 +
        ansLines.length * 21 +
        12;

      const totalQuestionH = textPartH + extraQrHeight + filePreviewBoxH;

      // Ensure the entire question + its answer + preview stay together on the same page
      ensureSpace(totalQuestionH + 8);

      // Draw Question Container
      ctx.fillStyle = 'rgba(252, 253, 254, 0.92)';
      ctx.fillRect(MARGIN_X, curY, CONTENT_W, totalQuestionH);
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(MARGIN_X, curY, CONTENT_W, totalQuestionH);

      // Left status stripe
      const isFilled = ansText !== '—' && ansText !== 'Not Uploaded';
      ctx.fillStyle = isFilled ? '#059669' : '#1E3A8A';
      ctx.fillRect(MARGIN_X, curY, 5, totalQuestionH);

      let innerY = curY + 22;

      // 1. Draw Question Number & Label
      ctx.textAlign = 'left';
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 14.5px "Noto Sans Devanagari", "Plus Jakarta Sans", sans-serif';
      labelLines.forEach((line) => {
        ctx.fillText(line, MARGIN_X + 14, innerY);
        innerY += 20;
      });

      // 2. Draw Description if present
      if (descLines.length > 0) {
        innerY += 2;
        ctx.fillStyle = '#475569';
        ctx.font = '500 12.5px "Noto Sans Devanagari", "Plus Jakarta Sans", sans-serif';
        descLines.forEach((line) => {
          ctx.fillText(line, MARGIN_X + 18, innerY);
          innerY += 17;
        });
        innerY += 4;
      }

      // 3. Draw Question 110 Bank Legal Notice & Official Union Bank QR Code
      if (q.hasBankLegalNoticeAndQr) {
        const qrBlockY = innerY + 2;
        const qrBlockH = 250;
        ctx.fillStyle = '#FFFBEB';
        ctx.fillRect(MARGIN_X + 14, qrBlockY, CONTENT_W - 28, qrBlockH);
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 1;
        ctx.strokeRect(MARGIN_X + 14, qrBlockY, CONTENT_W - 28, qrBlockH);

        const noticeLines = wrapTextLines(
          ctx,
          'अति-महत्वपूर्ण विधिक सूचना / LEGAL NOTICE: NAND VIDHYA EDUCATION ACADEMY (NVEA) के समस्त प्रकार के शुल्कों के हस्तांतरण हेतु केवल चालू बैंक खाता संख्या 104321010000244 (IFSC: UBIN0910431, Union Bank of India, UPI ID: 72923201@ubin) ही विधिक रूप से अधिकृत है। किसी अन्य खाते या व्यक्ति को भुगतान पर संस्थान शून्य उत्तरदायी (Zero Liable) रहेगा।',
          CONTENT_W - 260,
          '600 13px "Noto Sans Devanagari", "Plus Jakarta Sans", sans-serif'
        );
        ctx.fillStyle = '#991B1B';
        ctx.font = 'bold 14px "Noto Sans Devanagari", "Plus Jakarta Sans", sans-serif';
        ctx.fillText(
          'अधिकृत बैंक खाता एवं आधिकारिक QR कोड (Union Bank of India):',
          MARGIN_X + 26,
          qrBlockY + 26
        );

        ctx.fillStyle = '#1E293B';
        ctx.font = '600 13px "Noto Sans Devanagari", "Plus Jakarta Sans", sans-serif';
        noticeLines.forEach((nl, idx) => {
          ctx.fillText(nl, MARGIN_X + 26, qrBlockY + 52 + idx * 20);
        });

        if (qrImg) {
          const qrW = 175;
          const qrH = 228;
          ctx.drawImage(
            qrImg,
            MARGIN_X + CONTENT_W - qrW - 28,
            qrBlockY + 11,
            qrW,
            qrH
          );
        }
        innerY += extraQrHeight;
      }

      // 4. Draw Answer Box
      const ansBoxH = ansLines.length * 21 + 10;
      ctx.fillStyle = isFilled ? '#F0FDF4' : '#F8FAFC';
      ctx.fillRect(MARGIN_X + 14, innerY - 13, CONTENT_W - 28, ansBoxH);
      ctx.strokeStyle = isFilled ? '#86EFAC' : '#CBD5E1';
      ctx.lineWidth = 1;
      ctx.strokeRect(MARGIN_X + 14, innerY - 13, CONTENT_W - 28, ansBoxH);

      ctx.fillStyle = isFilled ? '#0F2942' : '#64748B';
      ctx.font = 'bold 14px "Noto Sans Devanagari", "Plus Jakarta Sans", sans-serif';
      ansLines.forEach((line) => {
        ctx.fillText(line, MARGIN_X + 22, innerY + 3);
        innerY += 21;
      });

      // 5. Draw Uncropped Visual Document Preview if uploaded
      if (q.inputType === 'file' && validImgs.length > 0 && filePreviewBoxH > 0) {
        const frameX = MARGIN_X + 14;
        const frameY = innerY + 2;
        const frameW = CONTENT_W - 28;
        const frameH = filePreviewBoxH - 12;

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(frameX, frameY, frameW, frameH);
        ctx.strokeStyle = '#0F2942';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(frameX, frameY, frameW, frameH);

        const img = validImgs[0];
        const pad = 12;
        const availW = frameW - pad * 2;
        const availH = frameH - pad * 2;
        const scale = Math.min(availW / img.width, availH / img.height);
        const drawW = img.width * scale;
        const drawH = img.height * scale;
        const drawX = frameX + (frameW - drawW) / 2;
        const drawY = frameY + (frameH - drawH) / 2;

        ctx.drawImage(img, drawX, drawY, drawW, drawH);
      }

      curY += totalQuestionH + 6;
    }

    curY += 6;
  }

  // Stamp Footer with Page X of Y on all pages and assemble PDF
  const totalPages = pageCanvases.length;
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  pageCanvases.forEach((canvas, idx) => {
    const fCtx = canvas.getContext('2d')!;
    fCtx.textAlign = 'left';
    fCtx.fillStyle = '#475569';
    fCtx.font = '600 12px "Plus Jakarta Sans", sans-serif';
    fCtx.fillText(
      `NAND VIDHYA EDUCATION ACADEMY (NVEA) • Record Ref: ${input.recordNumber}${
        input.submissionDateIso ? ` • Submitted: ${input.submissionDateIso}` : ''
      }`,
      MARGIN_X,
      PAGE_H - 30
    );

    fCtx.textAlign = 'right';
    fCtx.fillStyle = '#0F2942';
    fCtx.font = 'bold 12px "JetBrains Mono", monospace';
    fCtx.fillText(`Page ${idx + 1} of ${totalPages}`, PAGE_W - MARGIN_X, PAGE_H - 30);

    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    if (idx > 0) {
      pdf.addPage('a4', 'portrait');
    }
    pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
  });

  const fileName = `NVEA_Admission_Form_${input.recordNumber}.pdf`;
  const arrayBuffer = pdf.output('arraybuffer');
  const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
  const file = new File([blob], fileName, { type: 'application/pdf' });

  return { blob, file, fileName };
}

export async function downloadAdmissionFormPdf(
  input: PdfGenerationInput
): Promise<{ blob: Blob; file: File; fileName: string }> {
  const result = await generateAdmissionFormPdf(input);
  const url = URL.createObjectURL(result.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = result.fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return result;
}
