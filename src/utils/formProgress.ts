import {
  QUESTIONS,
  QuestionItem,
  SOURCE_TO_TARGET_MAP,
  PRESELECTED_DROPDOWN_DEFAULTS,
} from '../data/formSchema';
import { FormAnswers, FormUploadedFiles, checkQuestionComplete } from '../components/PortalRenderer';
import { hasNumericInput } from './feeCalculations';

export type FormProgressStatusText =
  | 'Form not started'
  | 'Form in progress'
  | 'Almost complete'
  | 'Form completed';

export interface LiveFormProgressResult {
  percentage: number;
  completedCount: number;
  totalTrackedCount: number;
  statusText: FormProgressStatusText;
  documentsVerified: boolean;
  uploadedMandatoryDocsCount: number;
  totalMandatoryDocsCount: number;
  paymentConfirmed: boolean;
  otpVerified: boolean;
  preselectedActiveCount: number;
}

const AUTO_MIRROR_TARGET_IDS = new Set<string>([
  ...Object.values(SOURCE_TO_TARGET_MAP),
  'q150', // Package Mode -> CLAP Segment mirror
]);

const PRESELECTED_QUESTION_IDS = new Set<string>(Object.keys(PRESELECTED_DROPDOWN_DEFAULTS));

// Explicitly optional questions (Rule 7):
// - Q.11 (q11 Spouse Name - labeled Optional)
// - Q.36-38 (q33-q35 Latitude, Longitude, Google Plus Code)
// - Q.47-49 (q44-q46 APAR ID, DEB ID, NIC ID)
// - Q.77-78 (q74-q75 CLAP Name & Subject - labeled Optional)
// - Q.82-92 (q79-q89 Optional Document Uploads)
// - Q.98-99 (q95-q96 Board/University Enrolment & Exam Non-Refundable Fees)
// - Q.144 (q141 JanAadhar Number in Oath Portal)
const EXPLICIT_OPTIONAL_IDS = new Set<string>([
  'q11',
  'q33',
  'q34',
  'q35',
  'q44',
  'q45',
  'q46',
  'q74',
  'q75',
  'q79',
  'q80',
  'q81',
  'q82',
  'q83',
  'q84',
  'q85',
  'q86',
  'q87',
  'q88',
  'q89',
  'q95',
  'q96',
  'q141',
]);

const MANDATORY_DOC_IDS = ['q76', 'q77', 'q78', 'q170'] as const;

function isNonEmptyString(val: unknown): boolean {
  return typeof val === 'string' && val.trim().length > 0;
}

/**
 * Evaluates whether a question is currently active and applicable for user completion
 * based on Rules 7, 8, 9, 10, and 11.
 */
export function isQuestionTrackedForProgress(
  q: QuestionItem,
  answers: FormAnswers
): boolean {
  // 1. Exclude read-only auto-calculated fee fields (Rule 10)
  if (q.readOnlyAutoCalc) return false;

  // 2. Exclude automatic 1-way mirror target fields in Portal 10 to avoid double-counting (Rule 10)
  if (AUTO_MIRROR_TARGET_IDS.has(q.id)) return false;

  // 3. Exclude explicitly optional fields (Rule 7)
  if (EXPLICIT_OPTIONAL_IDS.has(q.id)) return false;

  // 4. Rule 8: Do not count the 3 automatically preselected dropdowns (q90, q92, q110) as
  // manually completed user inputs when they hold their preselected value, so an untouched form
  // starts at 0% ("Form not started"). However, if the user clears one of them to empty,
  // include it as an incomplete required dropdown so completion cannot reach 100% while empty.
  if (PRESELECTED_QUESTION_IDS.has(q.id)) {
    const currentVal = answers[q.id];
    const isCleared = typeof currentVal !== 'string' || currentVal.trim() === '';
    return isCleared;
  }

  // 5. Rule 10 & 11: Conditional Spouse UID & Mobile (Q.12 q12, Q.13 q13)
  // Only applicable when Marital Status (Q.19 q16) is 'Married' or Spouse Name (Q.11 q11) is filled
  if (q.id === 'q12' || q.id === 'q13') {
    const maritalStatus = typeof answers.q16 === 'string' ? answers.q16.trim() : '';
    const hasSpouseName = isNonEmptyString(answers.q11);
    return maritalStatus === 'Married' || hasSpouseName;
  }

  // 6. Rule 10 & 11: Conditional Guardian fields (Q.14-16)
  // Only required when Oath Certified By (Q.121 q118) is Legal Guardian (minor applicant)
  // or when the user has started filling guardian details
  if (
    q.id === 'q14_guardian_name' ||
    q.id === 'q15_guardian_uid' ||
    q.id === 'q16_guardian_mobile'
  ) {
    const oathBy = typeof answers.q118 === 'string' ? answers.q118.trim() : '';
    const isGuardianOath = oathBy.includes('अभिभावक');
    const anyGuardianFilled =
      isNonEmptyString(answers.q14_guardian_name) ||
      isNonEmptyString(answers.q15_guardian_uid) ||
      isNonEmptyString(answers.q16_guardian_mobile);
    return isGuardianOath || anyGuardianFilled;
  }

  // 7. Rule 10 & 11: Conditional Concession fields (Q.102 q99, Q.103 q100, Q.104 q101, Q.105 q102, Q.107 q104)
  // Excluded when CLAP Scheme (Q.94 q91) is 'General (Refundable)' OR Concession reason (Q.101 q98) is 'Not Required' (or not yet chosen as a concession)
  if (q.id === 'q99' || q.id === 'q100' || q.id === 'q101' || q.id === 'q102') {
    const scheme = typeof answers.q91 === 'string' ? answers.q91.trim() : '';
    const concessionWhen = typeof answers.q98 === 'string' ? answers.q98.trim() : '';
    if (scheme === 'General (Refundable)' || concessionWhen === 'Not Required') {
      return false;
    }
    const isConcessionActive =
      scheme === 'Concession (Refundable)' ||
      scheme === 'Free of cost (Rewarded)' ||
      (concessionWhen !== '' && concessionWhen !== 'Not Required');
    return isConcessionActive;
  }

  if (q.id === 'q104') {
    // Free Package description (Q.107 q104) is only applicable when Free of cost / Free Education / Gifts & Packages is selected
    const scheme = typeof answers.q91 === 'string' ? answers.q91.trim() : '';
    const category = typeof answers.q101 === 'string' ? answers.q101.trim() : '';
    return (
      scheme === 'Free of cost (Rewarded)' ||
      category === 'Free Education' ||
      category === 'Gifts & Packages'
    );
  }

  // 8. Rule 10 & 11: Conditional Online vs Offline Payment Details (Q.116 q113 vs Q.117 q114)
  // Pay Type (Q.112 q109) has options: 'Cash' | 'Online (Digital Payment)'
  if (q.id === 'q113') {
    const payType = typeof answers.q109 === 'string' ? answers.q109.trim() : '';
    if (payType === 'Cash') return false; // Offline payment selected -> Online details not applicable
    return true;
  }
  if (q.id === 'q114') {
    const payType = typeof answers.q109 === 'string' ? answers.q109.trim() : '';
    if (payType === 'Online (Digital Payment)') return false; // Online payment selected -> Offline details not applicable
    if (payType === '') {
      // Before Pay Type is chosen, don't count both q113 and q114 simultaneously unless q114 is filled
      return isNonEmptyString(answers.q114);
    }
    return true;
  }

  // 9. Rule 10: Disabled Question 175 (q172 Enrolment Status)
  // Q.175 is disabled in the UI until Q.174 (q171 OTP Verification) is verified
  if (q.id === 'q172') {
    const isOtpVerified =
      typeof answers.q171 === 'string' &&
      answers.q171.startsWith('Consent Verified / Approved');
    return isOtpVerified;
  }

  return true;
}

/**
 * Computes live form completion progress percentage, counts, milestone statuses,
 * and status message in strict compliance with Update 4 (Rules 1-13).
 */
export function computeLiveFormProgress(
  answers: FormAnswers,
  uploadedFiles: FormUploadedFiles
): LiveFormProgressResult {
  // Rule 9: Check genuine Document Verification (all 4 mandatory document uploads have valid uploaded files)
  let uploadedMandatoryDocsCount = 0;
  for (const docId of MANDATORY_DOC_IDS) {
    const files = uploadedFiles[docId];
    if (Array.isArray(files) && files.length > 0 && Boolean(files[0]?.dataUrl)) {
      uploadedMandatoryDocsCount++;
    }
  }
  const documentsVerified = uploadedMandatoryDocsCount === MANDATORY_DOC_IDS.length;

  // Rule 9: Check genuine Payment Confirmation (never considered complete merely because Beneficiary Bank q110 is preselected)
  const payType = typeof answers.q109 === 'string' ? answers.q109.trim() : '';
  const hasPaymentRef =
    payType === 'Cash'
      ? isNonEmptyString(answers.q114)
      : payType === 'Online (Digital Payment)'
      ? isNonEmptyString(answers.q113)
      : isNonEmptyString(answers.q113) || isNonEmptyString(answers.q114);

  const paymentConfirmed =
    isNonEmptyString(answers.q108) &&
    isNonEmptyString(answers.q109) &&
    isNonEmptyString(answers.q110) &&
    isNonEmptyString(answers.q111) &&
    isNonEmptyString(answers.q112) &&
    hasPaymentRef &&
    isNonEmptyString(answers.q115) &&
    hasNumericInput(answers.q116);

  // Rule 9: Check genuine OTP Verification (only true when cryptographically verified via OTP)
  const otpVerified =
    typeof answers.q171 === 'string' &&
    answers.q171.startsWith('Consent Verified / Approved');

  // Count active preselected dropdowns
  let preselectedActiveCount = 0;
  for (const preId of PRESELECTED_QUESTION_IDS) {
    if (isNonEmptyString(answers[preId])) {
      preselectedActiveCount++;
    }
  }

  // Evaluate all tracked questions
  let completedCount = 0;
  let totalTrackedCount = 0;

  for (const q of QUESTIONS) {
    if (!isQuestionTrackedForProgress(q, answers)) continue;
    totalTrackedCount++;

    // Special strictness for Q.116/117 payment details & Q.119 deposited fee (Rule 9)
    if (q.id === 'q116') {
      if (hasNumericInput(answers.q116)) {
        completedCount++;
      }
      continue;
    }

    if (checkQuestionComplete(q, answers, uploadedFiles)) {
      completedCount++;
    }
  }

  let rawPercentage =
    totalTrackedCount > 0 ? Math.round((completedCount / totalTrackedCount) * 100) : 0;

  // Ensure if at least 1 manual field is completed, percentage is at least 1%
  if (completedCount > 0 && rawPercentage === 0) {
    rawPercentage = 1;
  }

  // Rule 9 Gate: Cannot reach 100% ("Form completed") unless all tracked fields AND
  // Document Verification, Payment Confirmation, and OTP Verification are genuinely completed
  const allMilestonesComplete =
    completedCount === totalTrackedCount &&
    documentsVerified &&
    paymentConfirmed &&
    otpVerified &&
    preselectedActiveCount === PRESELECTED_QUESTION_IDS.size;

  if (rawPercentage >= 100 && !allMilestonesComplete) {
    rawPercentage = 99;
  }

  const percentage = Math.max(0, Math.min(100, rawPercentage));

  let statusText: FormProgressStatusText = 'Form not started';
  if (percentage === 0) {
    statusText = 'Form not started';
  } else if (percentage < 75) {
    statusText = 'Form in progress';
  } else if (percentage < 100) {
    statusText = 'Almost complete';
  } else {
    statusText = 'Form completed';
  }

  return {
    percentage,
    completedCount,
    totalTrackedCount,
    statusText,
    documentsVerified,
    uploadedMandatoryDocsCount,
    totalMandatoryDocsCount: MANDATORY_DOC_IDS.length,
    paymentConfirmed,
    otpVerified,
    preselectedActiveCount,
  };
}
