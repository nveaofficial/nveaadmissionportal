/**
 * Strict Automatic Fee Calculations (Requirements 4, 5, 6, 7, 8)
 *
 * Formulas:
 * 1. Point 97 (Total CLAP Payable Fee) = Point 92 + Point 93 + Point 94 + Point 95 + Point 96
 * 2. Point 103 (Concessed Fee) = Point 97 (Total CLAP Payable Fee) - Point 105 (Net Payable CLAP Fee)
 * 3. Point 106 (GST Payable Fee) = Point 105 (Net Payable CLAP Fee) * 18 / 100
 * 4. Point 107 (Final Payable Fee) = Point 105 (Net Payable CLAP Fee) + Point 106 (GST Payable Fee)
 * 5. Point 117 (Outstanding Fee) = Point 107 (Final Payable Fee) - Point 116 (Deposited Fee)
 */

/**
 * Extracts the exact numeric value from a dropdown option or text input string.
 * Examples:
 * - "1600 INR (Valid up to current Plan Validity)" -> 1600
 * - "18000 INR, NCLAP ODE solo..." -> 18000
 * - "3199 INR (Monthly)" -> 3199
 * - "₹16,000" -> 16000
 * - "₹1,295.82" -> 1295.82
 * - "Not Required" / "No Applicable" / "" -> 0
 */
export function parseFeeNumber(raw: unknown): number {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : 0;
  }
  if (typeof raw !== 'string') return 0;

  const trimmed = raw.trim();
  if (!trimmed) return 0;
  if (/^(not required|no applicable|not applicable|none|nil|-)$/i.test(trimmed)) {
    return 0;
  }

  // Remove commas and currency symbols first, then match the leading number
  const normalized = trimmed.replace(/,/g, '');
  const match = normalized.match(/[-+]?\d+(?:\.\d+)?/);
  if (!match) return 0;

  const parsed = parseFloat(match[0]);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function hasNumericInput(raw: unknown): boolean {
  if (typeof raw === 'number') return Number.isFinite(raw);
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (/^(not required|no applicable|not applicable)$/i.test(trimmed)) return true;
  return /\d/.test(trimmed);
}

/**
 * Formats a numeric amount in Indian Rupee format (₹) with exact decimals (up to 2 decimal places when fractional,
 * or exact integer when whole number) so e.g. 2880 -> "₹2,880" and 1295.82 -> "₹1,295.82".
 */
export function formatRupeeAmount(amount: number): string {
  if (!Number.isFinite(amount)) return '';
  // Avoid floating point noise like 575.8200000000001
  const rounded = Math.round((amount + Number.EPSILON) * 100) / 100;
  const isWhole = Math.abs(rounded - Math.round(rounded)) < 1e-9;

  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(rounded));

  return rounded < 0 ? `-₹${formatted}` : `₹${formatted}`;
}

export interface ComputedFeesResult {
  q97: string; // Total CLAP Payable Fee = 92 + 93 + 94 + 95 + 96
  q103: string; // Concessed Fee = 97 - 105
  q106: string; // GST Payable Fee = 105 * 18 / 100
  q107: string; // Final Payable Fee = 105 + 106
  q117: string; // Outstanding Fee = 107 - 116
  // Also compute Oath Portal mirrors (Q159, Q160, Q162, Q163, Q167)
  q159: string;
  q160: string;
  q162: string;
  q163: string;
  q167: string;
}

export function computeAllAutomaticFees(
  answers: Record<string, string | string[]>
): ComputedFeesResult {
  // 1. Point 97 = 92 + 93 + 94 + 95 + 96
  const any92to96Present =
    hasNumericInput(answers.q92) ||
    hasNumericInput(answers.q93) ||
    hasNumericInput(answers.q94) ||
    hasNumericInput(answers.q95) ||
    hasNumericInput(answers.q96);

  const val92 = parseFeeNumber(answers.q92);
  const val93 = parseFeeNumber(answers.q93);
  const val94 = parseFeeNumber(answers.q94);
  const val95 = parseFeeNumber(answers.q95);
  const val96 = parseFeeNumber(answers.q96);

  const rawSum97 = Math.round((val92 + val93 + val94 + val95 + val96) * 100) / 100;
  const q97Str = any92to96Present ? formatRupeeAmount(rawSum97) : '';
  const val97 = any92to96Present ? rawSum97 : parseFeeNumber(answers.q97);

  // 2. Point 105 (Net Payable CLAP Fee) -> Point 106 (18% GST) & Point 107 (Final Payable Fee = 105 + 106)
  const has105 = hasNumericInput(answers.q105);
  const val105 = parseFeeNumber(answers.q105);

  // Exact arithmetic: GST = 105 * 18 / 100
  const val106 = has105 ? Math.round(val105 * 18) / 100 : 0;
  const q106Str = has105 ? formatRupeeAmount(val106) : '';

  // Final Payable Fee (107) = 105 + 106
  const val107 = has105 ? Math.round((val105 + val106) * 100) / 100 : 0;
  const q107Str = has105 ? formatRupeeAmount(val107) : '';

  // 3. Point 103 (Concessed Fee) = Point 97 (Total Claim Payable Fees) - Point 105 (Net Payable Fees)
  const has97Or105 = (any92to96Present || hasNumericInput(answers.q97)) && has105;
  const val103 = has97Or105 ? Math.round((val97 - val105) * 100) / 100 : 0;
  const q103Str = has97Or105 ? formatRupeeAmount(val103) : '';

  // 4. Point 117 (Outstanding Fee) = Point 107 (Final Payable Fee) - Point 116 (Deposited Fee)
  const has116 = hasNumericInput(answers.q116);
  const val116 = parseFeeNumber(answers.q116);
  const canCompute117 = has105 || has116;
  const val117 = canCompute117 ? Math.round((val107 - val116) * 100) / 100 : 0;
  const q117Str = canCompute117 ? formatRupeeAmount(val117) : '';

  // 5. Oath Portal Mirrors (Q159, Q160, Q161->Q162->Q163, Q166->Q167)
  const has161 = hasNumericInput(answers.q161);
  const val161 = has161 ? parseFeeNumber(answers.q161) : val105;
  const effectiveHas161 = has161 || has105;
  const val162 = effectiveHas161 ? Math.round(val161 * 18) / 100 : 0;
  const val163 = effectiveHas161 ? Math.round((val161 + val162) * 100) / 100 : 0;
  const has166 = hasNumericInput(answers.q166);
  const val166 = has166 ? parseFeeNumber(answers.q166) : val116;
  const val167 =
    effectiveHas161 || has166 || has116
      ? Math.round((val163 - val166) * 100) / 100
      : 0;

  return {
    q97: q97Str,
    q103: q103Str,
    q106: q106Str,
    q107: q107Str,
    q117: q117Str,
    q159: q97Str,
    q160: q103Str,
    q162: effectiveHas161 ? formatRupeeAmount(val162) : '',
    q163: effectiveHas161 ? formatRupeeAmount(val163) : '',
    q167: effectiveHas161 || has166 || has116 ? formatRupeeAmount(val167) : '',
  };
}
