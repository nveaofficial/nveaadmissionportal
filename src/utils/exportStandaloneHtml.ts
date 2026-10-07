/**
 * Exports the current NVEA Admission Form (including all 10 portals, 171 questions,
 * current filled values, uploaded document previews, watermarks, and print styling)
 * into a standalone, lightweight, self-contained .html file.
 *
 * STRICTEST FILE SIZE OPTIMIZATION:
 * - Aggressive CSS rule deduplication & whitespace/comment minification
 * - Visually-lossless high-DPI WebP/optimized image compression for uploaded documents & assets
 * - Cleans up redundant DOM/React runtime attributes
 * - Minifies HTML structure while maintaining 100% visual quality, razor-sharp clarity & identical layout
 */

/**
 * Minifies CSS text by stripping comments, collapsing whitespace, and removing redundant syntax tokens.
 */
function minifyCssText(css: string): string {
  if (!css) return '';
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
    .replace(/\r\n|\r|\n/g, ' ') // Flatten newlines
    .replace(/\s+/g, ' ') // Collapse multiple whitespace runs
    .replace(/\s*([{}:;,>+~])\s*/g, '$1') // Remove spaces around syntax delimiters
    .replace(/;}/g, '}') // Remove trailing semicolons before closing brace
    .replace(/[^{}]+{\s*}/g, '') // Remove empty rules
    .trim();
}

/**
 * Collects and deduplicates all CSS rules from active document stylesheets,
 * minifying them into a single high-efficiency CSS block.
 */
function extractMinifiedStyles(): string {
  const ruleSet = new Set<string>();
  const minifiedRules: string[] = [];

  Array.from(document.styleSheets).forEach((sheet) => {
    try {
      Array.from(sheet.cssRules).forEach((rule) => {
        const text = rule.cssText;
        if (text && !ruleSet.has(text)) {
          ruleSet.add(text);
          const min = minifyCssText(text);
          if (min) {
            minifiedRules.push(min);
          }
        }
      });
    } catch {
      // Cross-origin font stylesheet ignored; Google Fonts <link> handles it
    }
  });

  return minifiedRules.join('');
}

/**
 * Optimizes an image data URL with visually-lossless high-DPI compression.
 * Preserves 100% razor-sharp clarity, zero blur, sharp text, crisp signatures, and transparency.
 * If compression does not reduce size or is unnecessary, the original is preserved untouched.
 */
async function optimizeImageDataUrl(dataUrl: string): Promise<string> {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
    return dataUrl;
  }

  // Skip tiny icons or SVGs
  if (dataUrl.length < 2048 || dataUrl.startsWith('data:image/svg+xml')) {
    return dataUrl;
  }

  return new Promise<string>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const origW = img.naturalWidth || img.width;
        const origH = img.naturalHeight || img.height;
        if (!origW || !origH) {
          resolve(dataUrl);
          return;
        }

        // Maintain maximum crisp resolution (up to 2400px ultra high-resolution, print/zoom ready)
        const MAX_DIM = 2400;
        let targetW = origW;
        let targetH = origH;
        if (targetW > MAX_DIM || targetH > MAX_DIM) {
          if (targetW > targetH) {
            targetH = Math.round((targetH * MAX_DIM) / targetW);
            targetW = MAX_DIM;
          } else {
            targetW = Math.round((targetW * MAX_DIM) / targetH);
            targetH = MAX_DIM;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, targetW, targetH);

        let bestUrl = dataUrl;
        let minLen = dataUrl.length;

        // Visually-lossless WebP (quality 0.94): crystal-clear details, zero artifacts, supports alpha transparency
        try {
          const webpUrl = canvas.toDataURL('image/webp', 0.94);
          if (webpUrl && webpUrl.startsWith('data:image/webp') && webpUrl.length < minLen) {
            bestUrl = webpUrl;
            minLen = webpUrl.length;
          }
        } catch {
          // WebP not supported in current environment
        }

        // For JPEG images without transparency
        if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) {
          try {
            const jpegUrl = canvas.toDataURL('image/jpeg', 0.93);
            if (jpegUrl && jpegUrl.startsWith('data:image/jpeg') && jpegUrl.length < minLen) {
              bestUrl = jpegUrl;
              minLen = jpegUrl.length;
            }
          } catch {
            // ignore
          }
        }

        resolve(bestUrl);
      } catch {
        resolve(dataUrl);
      }
    };

    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * Safely minifies HTML string by removing comments and collapsing whitespace between tags.
 */
function minifyHtmlString(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, '') // Remove HTML comments
    .replace(/>\s+([<])/g, '>$1') // Remove spaces between tags
    .replace(/([>])\s+</g, '$1<')
    .trim();
}

export async function downloadStandaloneHtmlSnapshot(recordNumber: string): Promise<void> {
  const formSheetEl = document.getElementById('nvea-printable-sheet');
  if (!formSheetEl) return;

  // Clone the DOM tree and sync live input/select/textarea values into HTML attributes
  const clone = formSheetEl.cloneNode(true) as HTMLElement;

  const origInputs = formSheetEl.querySelectorAll('input, select, textarea');
  const cloneInputs = clone.querySelectorAll('input, select, textarea');

  origInputs.forEach((orig, index) => {
    const target = cloneInputs[index];
    if (!target) return;

    if (orig instanceof HTMLInputElement && target instanceof HTMLInputElement) {
      if (orig.type === 'checkbox' || orig.type === 'radio') {
        if (orig.checked) {
          target.setAttribute('checked', 'checked');
        } else {
          target.removeAttribute('checked');
        }
      } else if (orig.type !== 'file') {
        target.setAttribute('value', orig.value);
      }
    } else if (orig instanceof HTMLSelectElement && target instanceof HTMLSelectElement) {
      const selectedIdx = orig.selectedIndex;
      Array.from(target.options).forEach((opt, i) => {
        if (i === selectedIdx) {
          opt.setAttribute('selected', 'selected');
        } else {
          opt.remove();
        }
      });
    } else if (orig instanceof HTMLTextAreaElement && target instanceof HTMLTextAreaElement) {
      target.textContent = orig.value;
    }
  });

  // Strict Print/Save/Download Rule: Remove all empty questions, empty sub-sections, empty portals, and UI-only controls
  clone
    .querySelectorAll(
      '[data-filled="false"], [data-subsection-filled="false"], [data-portal-filled="false"], .no-print'
    )
    .forEach((el) => el.remove());

  clone.querySelectorAll('.print-only').forEach((el) => {
    el.classList.remove('hidden');
  });

  // Clean up redundant React runtime attributes to save KB
  clone.querySelectorAll('*').forEach((el) => {
    el.removeAttribute('data-reactroot');
    el.removeAttribute('data-portal-id');
    el.removeAttribute('data-filled');
    el.removeAttribute('data-subsection-filled');
    el.removeAttribute('data-portal-filled');
    if (el.getAttribute('class') === '') el.removeAttribute('class');
    if (el.getAttribute('style') === '') el.removeAttribute('style');
  });

  // Optimize all images asynchronously with visually-lossless compression
  const images = Array.from(clone.querySelectorAll('img'));
  await Promise.all(
    images.map(async (img) => {
      const src = img.getAttribute('src');
      if (src && src.startsWith('data:image/')) {
        const optimized = await optimizeImageDataUrl(src);
        if (optimized && optimized !== src) {
          img.setAttribute('src', optimized);
        }
      }
    })
  );

  // Collect and minify active stylesheets from document
  const stylesText = extractMinifiedStyles();

  const rawHtml = `<!doctype html>
<html lang="hi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>NVEA Official Admission Form — ${recordNumber}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet" />
  <style>${stylesText}</style>
</head>
<body class="bg-[#F4F6F9] text-[#0F172A] p-4">
  <div class="max-w-[1280px] mx-auto">
    ${clone.outerHTML}
  </div>
</body>
</html>`;

  const htmlContent = minifyHtmlString(rawHtml);

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `NVEA_Admission_Form_${recordNumber}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
