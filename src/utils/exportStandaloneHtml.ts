/**
 * Exports the current NVEA Admission Form (including all 10 portals, 171 questions,
 * current filled values, uploaded document previews, watermarks, and print styling)
 * into a standalone, lightweight, self-contained .html file.
 */
export function downloadStandaloneHtmlSnapshot(recordNumber: string): void {
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

  // Collect active stylesheets from the document
  let stylesText = '';
  Array.from(document.styleSheets).forEach((sheet) => {
    try {
      Array.from(sheet.cssRules).forEach((rule) => {
        stylesText += rule.cssText + '\n';
      });
    } catch {
      // Cross-origin font stylesheet ignored; link tag handles it
    }
  });

  const htmlContent = `<!doctype html>
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
