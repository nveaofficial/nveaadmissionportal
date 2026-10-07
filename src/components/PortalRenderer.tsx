import React from 'react';
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Calculator,
  Lock,
} from 'lucide-react';
import { PortalDefinition, QuestionItem, isQuestionRequired } from '../data/formSchema';
import {
  ResidentInfoHeaderBlock,
  LiveFeeStatusHeaderBlock,
  BankLegalNoticeAndQrBlock,
  OathDeclarationPortalIntroBlock,
  OathSection1And2HeaderBlock,
  StatutoryNoticeIntakeLimitBlock,
  OathDetailedClausesBlock,
  Q170ConsentAffidavitDescriptionBlock,
} from './LegalBlocks';
import { DocumentUploadField, UploadedFileItem } from './DocumentUploadField';
import { ConsentVerificationField } from './ConsentVerificationField';

export type FormAnswers = Record<string, string | string[]>;
export type FormUploadedFiles = Record<string, UploadedFileItem[]>;

export function checkQuestionComplete(
  q: QuestionItem,
  answers: FormAnswers,
  uploadedFiles: FormUploadedFiles
): boolean {
  if (q.inputType === 'file') {
    return (uploadedFiles[q.id]?.length || 0) > 0;
  }
  if (q.inputType === 'otp_verification') {
    const val = answers[q.id];
    return typeof val === 'string' && val.startsWith('Consent Verified / Approved');
  }
  const val = answers[q.id];
  if (Array.isArray(val)) {
    return val.length > 0;
  }
  return typeof val === 'string' && val.trim().length > 0;
}

interface PortalRendererProps {
  portal: PortalDefinition;
  questions: QuestionItem[];
  answers: FormAnswers;
  uploadedFiles: FormUploadedFiles;
  onAnswerChange: (questionId: string, value: string | string[]) => void;
  onFileChange: (questionId: string, files: UploadedFileItem[]) => void;
  nveaWatermarkPng: string;
  bankQrCardPng: string;
  recordNumber: string;
  priorIncompleteCountForQ171: number;
  onJumpToIncomplete: () => void;
  onPrevPortal?: () => void;
  onNextPortal?: () => void;
  onSubmitForm?: () => void;
  isFirstPortal: boolean;
  isLastPortal: boolean;
  showBottomNav: boolean;
  highlightIncomplete?: boolean;
  touchedFields?: Record<string, boolean>;
  onFieldBlur?: (questionId: string) => void;
}

export const PortalRenderer: React.FC<PortalRendererProps> = ({
  portal,
  questions,
  answers,
  uploadedFiles,
  onAnswerChange,
  onFileChange,
  nveaWatermarkPng,
  bankQrCardPng,
  recordNumber,
  priorIncompleteCountForQ171,
  onJumpToIncomplete,
  onPrevPortal,
  onNextPortal,
  onSubmitForm,
  isFirstPortal,
  isLastPortal,
  showBottomNav,
  highlightIncomplete = true,
  touchedFields = {},
  onFieldBlur,
}) => {
  const handleCheckboxToggle = (questionId: string, option: string) => {
    const current = Array.isArray(answers[questionId])
      ? (answers[questionId] as string[])
      : [];
    if (current.includes(option)) {
      onAnswerChange(
        questionId,
        current.filter((item) => item !== option)
      );
    } else {
      onAnswerChange(questionId, [...current, option]);
    }
    onFieldBlur?.(questionId);
  };

  const getColSpanClass = (span?: 1 | 2 | 3 | 4) => {
    switch (span) {
      case 4:
        return 'col-span-1 md:col-span-2 lg:col-span-4';
      case 3:
        return 'col-span-1 md:col-span-2 lg:col-span-3';
      case 2:
        return 'col-span-1 md:col-span-2 lg:col-span-2';
      case 1:
      default:
        return 'col-span-1';
    }
  };

  // Compute portal validation stats
  const portalRequiredQuestions = questions.filter((q) => isQuestionRequired(q));
  const portalCompletedRequiredCount = portalRequiredQuestions.filter((q) =>
    checkQuestionComplete(q, answers, uploadedFiles)
  ).length;
  const portalIncompleteRequiredCount =
    portalRequiredQuestions.length - portalCompletedRequiredCount;

  // Sort questions strictly by ascending number so sequence is 100% deterministic
  const orderedQuestions = [...questions].sort((a, b) => a.number - b.number);

  // Check if any question in this portal or specific sub-sections is filled (for Strict Print/Save/Download Rule)
  const isRangeFilled = (startNum: number, endNum: number) =>
    orderedQuestions.some(
      (q) =>
        q.number >= startNum &&
        q.number <= endNum &&
        checkQuestionComplete(q, answers, uploadedFiles)
    );

  const isPortalAnyFilled = orderedQuestions.some((q) =>
    checkQuestionComplete(q, answers, uploadedFiles)
  );

  const isConsentVerified =
    typeof answers.q171 === 'string' &&
    answers.q171.startsWith('Consent Verified / Approved');

  return (
    <section
      id={`portal-section-${portal.id}`}
      data-portal-filled={isPortalAnyFilled ? 'true' : 'false'}
      className={`portal-section relative bg-white border border-slate-300 shadow-xs rounded-sm mb-4 ${
        !isPortalAnyFilled ? 'no-print' : ''
      }`}
    >
      {/* Centered Subtle High-Definition Transparent PNG Watermark on Every Page/Portal */}
      {nveaWatermarkPng && (
        <div
          aria-hidden="true"
          className="pointer-events-none select-none absolute inset-0 flex items-center justify-center z-0 overflow-hidden no-print"
        >
          <img
            src={nveaWatermarkPng}
            alt=""
            referrerPolicy="no-referrer"
            className="w-56 h-56 md:w-64 md:h-64 object-contain opacity-[0.075]"
          />
        </div>
      )}

      {/* Official Government-Style Portal Header Bar */}
      <div className="relative z-10 bg-[#0F2942] text-white px-4 py-2.5 border-b-2 border-[#D97706] flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm md:text-base font-bold tracking-wide text-white">
            {portal.title}
          </h2>
          {portal.subtitle && (
            <p className="text-xs text-slate-200 font-hindi mt-0.5 leading-snug">
              {portal.subtitle}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-amber-200 font-mono-num shrink-0">
          <span>
            Questions {portal.questionRange[0]}–{portal.questionRange[1]}
          </span>
          {portalRequiredQuestions.length > 0 && (
            <>
              <span aria-hidden="true" className="no-print">
                ·
              </span>
              {portalIncompleteRequiredCount === 0 ? (
                <span className="inline-flex items-center gap-1 text-emerald-300 font-sans font-semibold no-print">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  All {portalRequiredQuestions.length} Required Complete
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-amber-300 font-sans font-semibold no-print">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {portalIncompleteRequiredCount} of {portalRequiredQuestions.length} Required Incomplete
                </span>
              )}
            </>
          )}
          {portal.requiredNote && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-red-300 font-sans font-semibold">
                {portal.requiredNote}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Institutional Grid Body (Screen: 4-col grid; Print: Strictly sequential full-width vertical flow) */}
      <div className="relative z-10 p-3 md:p-4">
        <div className="print-sequential-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {orderedQuestions.map((q) => {
            const val = answers[q.id];
            const strVal = typeof val === 'string' ? val : '';
            const arrVal = Array.isArray(val) ? val : [];
            const isReq = isQuestionRequired(q);
            const isComplete = checkQuestionComplete(q, answers, uploadedFiles);
            const isIncompleteReq = isReq && !isComplete;
            const isTouched = Boolean(touchedFields[q.id]);
            const showFieldWarning = isIncompleteReq && (highlightIncomplete || isTouched);

            const cellValidationClass = isComplete
              ? 'bg-[#FCFDFE]/95 border-slate-300 border-l-4 border-l-emerald-600'
              : showFieldWarning
              ? 'bg-red-50/20 border-red-300 border-l-4 border-l-red-600'
              : isIncompleteReq
              ? 'bg-[#FCFDFE]/90 border-slate-300 border-l-4 border-l-amber-500'
              : 'bg-[#FCFDFE]/90 border-slate-300';

            const inputValidationClass = isComplete
              ? 'border-emerald-600/60 bg-white focus:ring-emerald-700 focus:border-emerald-700'
              : showFieldWarning
              ? 'border-red-500 bg-red-50/20 focus:ring-red-600 focus:border-red-600'
              : isIncompleteReq
              ? 'border-amber-500/80 bg-white focus:ring-[#1E3A8A] focus:border-[#1E3A8A]'
              : 'border-slate-300 bg-white focus:ring-[#1E3A8A] focus:border-[#1E3A8A]';

            return (
              <React.Fragment key={q.id}>
                {/* Exact Pre-Question Sub-Section Blocks (Excluded from Print/Export if their sub-section has no filled responses) */}
                {q.number === 24 && (
                  <div
                    data-subsection-filled={isRangeFilled(24, 38) ? 'true' : 'false'}
                    className={`col-span-1 md:col-span-2 lg:col-span-4 ${
                      !isRangeFilled(24, 38) ? 'no-print' : ''
                    }`}
                  >
                    <ResidentInfoHeaderBlock />
                  </div>
                )}
                {q.number === 119 && (
                  <div
                    data-subsection-filled={isRangeFilled(119, 120) ? 'true' : 'false'}
                    className={`col-span-1 md:col-span-2 lg:col-span-4 ${
                      !isRangeFilled(119, 120) ? 'no-print' : ''
                    }`}
                  >
                    <LiveFeeStatusHeaderBlock />
                  </div>
                )}
                {q.number === 121 && (
                  <div
                    data-subsection-filled={isRangeFilled(121, 131) ? 'true' : 'false'}
                    className={`col-span-1 md:col-span-2 lg:col-span-4 ${
                      !isRangeFilled(121, 131) ? 'no-print' : ''
                    }`}
                  >
                    <OathDeclarationPortalIntroBlock />
                  </div>
                )}
                {q.number === 132 && (
                  <div
                    data-subsection-filled={isRangeFilled(132, 137) ? 'true' : 'false'}
                    className={`col-span-1 md:col-span-2 lg:col-span-4 ${
                      !isRangeFilled(132, 137) ? 'no-print' : ''
                    }`}
                  >
                    <OathSection1And2HeaderBlock />
                  </div>
                )}
                {q.number === 138 && (
                  <div
                    data-subsection-filled={isRangeFilled(138, 172) ? 'true' : 'false'}
                    className={`col-span-1 md:col-span-2 lg:col-span-4 ${
                      !isRangeFilled(138, 172) ? 'no-print' : ''
                    }`}
                  >
                    <StatutoryNoticeIntakeLimitBlock />
                  </div>
                )}
                {q.number === 173 && (
                  <div
                    data-subsection-filled={isRangeFilled(173, 173) ? 'true' : 'false'}
                    className={`col-span-1 md:col-span-2 lg:col-span-4 ${
                      !isRangeFilled(173, 173) ? 'no-print' : ''
                    }`}
                  >
                    <OathDetailedClausesBlock />
                  </div>
                )}

                <div
                  id={`question-box-${q.number}`}
                  data-filled={isComplete ? 'true' : 'false'}
                  className={`question-cell ${getColSpanClass(
                    q.colSpan
                  )} ${cellValidationClass} ${
                    !isComplete ? 'no-print' : ''
                  } border rounded-sm p-2.5 flex flex-col justify-between transition-colors focus-within:border-[#1E3A8A] focus-within:bg-white`}
                >
                  <div>
                    {/* Question Header Row with Number, Verbatim Label & Visual Validation Indicator */}
                    <div className="flex items-start justify-between gap-2">
                      <label
                        htmlFor={`input-${q.id}`}
                        className="block text-xs md:text-[13px] font-semibold text-[#0F172A] leading-snug font-hindi"
                      >
                        <span className="inline-block font-mono-num font-bold text-[#1E3A8A] mr-1.5">
                          {q.number}.
                        </span>
                        <span>{q.label}</span>
                        {isReq && (
                          <span
                            className="text-red-600 font-bold ml-1"
                            title="Required Question"
                          >
                            *
                          </span>
                        )}
                      </label>

                      {/* Accessible Icon + Text Validation Status Indicator */}
                      <div className="shrink-0 no-print pt-0.5 flex items-center gap-1.5">
                        {q.readOnlyAutoCalc && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#1E3A8A]">
                            <Calculator className="w-3 h-3" />
                            <span className="hidden sm:inline">Auto</span>
                          </span>
                        )}
                        {isComplete ? (
                          <span
                            className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-emerald-700 whitespace-nowrap"
                            title="Completed"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span className="hidden sm:inline">Done</span>
                          </span>
                        ) : isIncompleteReq ? (
                          <span
                            className={`inline-flex items-center gap-1 text-[10.5px] font-semibold whitespace-nowrap ${
                              showFieldWarning ? 'text-red-700' : 'text-amber-700'
                            }`}
                            title="Required question is incomplete"
                          >
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>Incomplete</span>
                          </span>
                        ) : (
                          <span className="text-[10.5px] text-slate-400 font-medium whitespace-nowrap">
                            Optional
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Verbatim Hindi / English Question Description if present */}
                    {q.description && (
                      <p className="text-[11.5px] text-slate-700 font-hindi mt-1 leading-relaxed bg-slate-50/90 border-l-2 border-[#1E3A8A]/50 pl-2 py-0.5">
                        {q.description}
                      </p>
                    )}

                    {/* Special Feature: Question 110 Legal Notice & Union Bank Official QR Code (Pages 58-61) */}
                    {q.hasBankLegalNoticeAndQr && (
                      <BankLegalNoticeAndQrBlock bankQrCardPng={bankQrCardPng} />
                    )}

                    {/* Special Feature: Question 170 Unconditional Legal Declaration & Affidavit (Pages 93-94) */}
                    {q.hasConsentAffidavitBlock && (
                      <Q170ConsentAffidavitDescriptionBlock
                        recordNumber={recordNumber}
                        applicantName={
                          typeof answers.q2 === 'string' && answers.q2.trim()
                            ? answers.q2.trim()
                            : typeof answers.q119 === 'string' && answers.q119.trim()
                            ? answers.q119.trim()
                            : 'Applicant'
                        }
                      />
                    )}
                  </div>

                  {/* Input Control strictly matched to Question Type */}
                  <div className="mt-1.5">
                    {/* Print-only full text representation for standard inputs so nothing is truncated in Print/PDF */}
                    {q.inputType !== 'file' && q.inputType !== 'otp_verification' && isComplete && (
                      <div className="hidden print-only border border-slate-300 bg-slate-50/80 px-2.5 py-1 rounded-xs text-xs font-semibold text-[#0F172A] font-hindi">
                        <span className="text-slate-500 font-normal mr-1.5">Answer:</span>
                        <span>
                          {q.inputType === 'checkbox' ? arrVal.join(', ') : strVal}
                        </span>
                      </div>
                    )}

                    {/* Auto-Calculated / Synced Fee Field (Points 97, 103, 106, 107, 117 & Oath Mirrors) */}
                    {q.readOnlyAutoCalc ? (
                      <div className="no-print">
                        <div className="relative flex items-center">
                          <input
                            id={`input-${q.id}`}
                            type="text"
                            value={strVal}
                            onBlur={() => onFieldBlur?.(q.id)}
                            onChange={(e) => onAnswerChange(q.id, e.target.value)}
                            placeholder="Auto-calculated automatically from related fee fields"
                            className="w-full h-8 pl-2.5 pr-24 py-1 text-xs md:text-[13px] font-mono-num font-bold border border-[#1E3A8A]/50 rounded-sm bg-[#EFF6FF]/70 text-[#0F2942] focus:outline-none focus:ring-1 focus:ring-[#1E3A8A]"
                          />
                          <span className="absolute right-2 text-[10px] font-semibold text-[#1E3A8A] select-none pointer-events-none">
                            Auto-Calculated
                          </span>
                        </div>
                        {q.autoCalcFormulaHint && (
                          <p className="text-[10.5px] text-[#1E3A8A] font-medium mt-0.5">
                            {q.autoCalcFormulaHint}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div
                        className={
                          q.inputType !== 'file' && q.inputType !== 'otp_verification'
                            ? 'no-print'
                            : ''
                        }
                      >
                        {q.inputType === 'dropdown' && (
                          <div>
                            {q.number === 175 && !isConsentVerified && (
                              <div className="mb-1.5 p-2 bg-amber-50 border border-amber-300 rounded-sm text-[11px] text-amber-950 flex items-center gap-1.5">
                                <Lock className="w-3.5 h-3.5 text-amber-800 shrink-0" />
                                <span>
                                  Point 175 (Enrolment Status) is locked until Point 174 (Consent
                                  Verification &amp; Approval via OTP) is verified.
                                </span>
                              </div>
                            )}
                            <select
                              id={`input-${q.id}`}
                              value={strVal}
                              disabled={q.number === 175 && !isConsentVerified}
                              aria-invalid={showFieldWarning}
                              onBlur={() => onFieldBlur?.(q.id)}
                              onChange={(e) => {
                                onAnswerChange(q.id, e.target.value);
                                onFieldBlur?.(q.id);
                              }}
                              className={`w-full h-8 px-2 py-1 text-xs md:text-[13px] border rounded-sm text-slate-900 font-hindi focus:outline-none focus:ring-1 disabled:opacity-60 disabled:cursor-not-allowed ${inputValidationClass}`}
                            >
                              <option value="">-- Select / चुनें (Mark only one oval) --</option>
                              {q.options?.map((opt, idx) => (
                                <option key={`${q.id}-opt-${idx}`} value={opt}>
                                  {opt}
                                </option>
                              ))}
                              {strVal !== '' && !q.options?.includes(strVal) && (
                                <option value={strVal}>{strVal}</option>
                              )}
                            </select>
                          </div>
                        )}

                        {q.inputType === 'text' && (
                          <input
                            id={`input-${q.id}`}
                            type="text"
                            value={strVal}
                            aria-invalid={showFieldWarning}
                            onBlur={() => onFieldBlur?.(q.id)}
                            onChange={(e) => onAnswerChange(q.id, e.target.value)}
                            placeholder={q.placeholder || 'Enter details / विवरण दर्ज करें'}
                            className={`w-full h-8 px-2.5 py-1 text-xs md:text-[13px] border rounded-sm text-slate-900 font-hindi placeholder:text-slate-400 focus:outline-none focus:ring-1 ${inputValidationClass}`}
                          />
                        )}

                        {q.inputType === 'textarea' && (
                          <textarea
                            id={`input-${q.id}`}
                            rows={3}
                            value={strVal}
                            aria-invalid={showFieldWarning}
                            onBlur={() => onFieldBlur?.(q.id)}
                            onChange={(e) => onAnswerChange(q.id, e.target.value)}
                            placeholder={
                              q.placeholder ||
                              'Enter subject names & codes / विषयों के नाम एवं कॉड दर्ज करें'
                            }
                            className={`w-full px-2.5 py-1.5 text-xs md:text-[13px] border rounded-sm text-slate-900 font-hindi placeholder:text-slate-400 focus:outline-none focus:ring-1 ${inputValidationClass}`}
                          />
                        )}

                        {q.inputType === 'date' && (
                          <div className="flex flex-col">
                            <input
                              id={`input-${q.id}`}
                              type="date"
                              value={strVal}
                              aria-invalid={showFieldWarning}
                              onBlur={() => onFieldBlur?.(q.id)}
                              onChange={(e) => {
                                onAnswerChange(q.id, e.target.value);
                                onFieldBlur?.(q.id);
                              }}
                              className={`w-full h-8 px-2.5 py-1 text-xs md:text-[13px] border rounded-sm text-slate-900 font-mono-num focus:outline-none focus:ring-1 ${inputValidationClass}`}
                            />
                            {q.placeholder && (
                              <span className="text-[10px] text-slate-500 italic mt-0.5">
                                {q.placeholder}
                              </span>
                            )}
                          </div>
                        )}

                        {q.inputType === 'date_or_text' && (
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1">
                              <input
                                id={`input-${q.id}`}
                                type="text"
                                value={strVal}
                                aria-invalid={showFieldWarning}
                                onBlur={() => onFieldBlur?.(q.id)}
                                onChange={(e) => onAnswerChange(q.id, e.target.value)}
                                placeholder={
                                  q.placeholder || 'Example: 7 January 2019 / Male / Female'
                                }
                                className={`w-full h-8 px-2.5 py-1 text-xs md:text-[13px] border rounded-sm text-slate-900 font-hindi placeholder:text-slate-400 focus:outline-none focus:ring-1 ${inputValidationClass}`}
                              />
                              <label
                                className="relative inline-flex items-center justify-center h-8 w-8 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-sm cursor-pointer shrink-0 no-print"
                                title="Select Date from Calendar"
                              >
                                <Calendar className="w-3.5 h-3.5 text-[#0F2942]" />
                                <input
                                  type="date"
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      onAnswerChange(q.id, e.target.value);
                                      onFieldBlur?.(q.id);
                                    }
                                  }}
                                  className="absolute inset-0 opacity-0 cursor-pointer"
                                />
                              </label>
                            </div>
                            {q.placeholder && (
                              <span className="text-[10px] text-slate-500 italic mt-0.5">
                                {q.placeholder}
                              </span>
                            )}
                          </div>
                        )}

                        {q.inputType === 'checkbox' && (
                          <div
                            className={`pt-1 rounded-sm ${
                              showFieldWarning
                                ? 'p-1.5 border border-dashed border-red-400 bg-red-50/20'
                                : ''
                            }`}
                          >
                            <span className="block text-[10.5px] text-slate-500 italic mb-1">
                              Tick all that apply.
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {q.options?.map((opt, idx) => {
                                const checked = arrVal.includes(opt);
                                return (
                                  <label
                                    key={`${q.id}-chk-${idx}`}
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs border rounded-sm cursor-pointer transition-colors ${
                                      checked
                                        ? 'bg-[#EFF6FF] border-[#1E3A8A] text-[#0F2942] font-semibold'
                                        : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => handleCheckboxToggle(q.id, opt)}
                                      className="w-3.5 h-3.5 accent-[#0F2942] rounded-xs"
                                    />
                                    <span>{opt}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {q.inputType === 'file' && (
                          <DocumentUploadField
                            questionId={q.id}
                            questionNumber={q.number}
                            label={q.label}
                            frameType={q.fileFrameType || 'a4_full'}
                            files={uploadedFiles[q.id] || []}
                            onChange={(newFiles) => {
                              onFileChange(q.id, newFiles);
                              onFieldBlur?.(q.id);
                            }}
                            isIncompleteRequired={isIncompleteReq}
                            showValidationWarning={showFieldWarning}
                          />
                        )}

                        {q.inputType === 'otp_verification' && (
                          <ConsentVerificationField
                            recordNumber={recordNumber}
                            applicantName={
                              typeof answers.q2 === 'string' && answers.q2.trim()
                                ? answers.q2.trim()
                                : typeof answers.q119 === 'string'
                                ? answers.q119.trim()
                                : 'Applicant'
                            }
                            answers={answers}
                            priorIncompleteCount={priorIncompleteCountForQ171}
                            isQ170Uploaded={(uploadedFiles.q170?.length || 0) > 0}
                            onJumpToIncomplete={onJumpToIncomplete}
                            verificationValue={strVal}
                            onVerified={(statusText, details) => {
                              onAnswerChange('q171', statusText);
                              onAnswerChange('q172', 'Enrolment is done successfully');
                              if (details?.interviewSerialNumber) {
                                onAnswerChange('q40', details.interviewSerialNumber);
                              }
                              onFieldBlur?.('q171');
                            }}
                          />
                        )}
                      </div>
                    )}

                    {/* Inline validation message when incomplete required field is highlighted/touched */}
                    {showFieldWarning &&
                      q.inputType !== 'file' &&
                      q.inputType !== 'otp_verification' &&
                      !q.readOnlyAutoCalc && (
                        <p className="mt-1 text-[10.5px] font-medium text-red-700 flex items-center gap-1 no-print">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span>
                            Required field incomplete — please provide an answer before submission.
                          </span>
                        </p>
                      )}
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Bottom Portal Navigation Footer (Requirement 12: Each portal has a "Next" button at the bottom to move automatically to the next portal) */}
      {showBottomNav && (
        <div className="relative z-10 bg-[#F8FAFC] border-t border-slate-300 px-4 py-3 flex flex-wrap items-center justify-between gap-3 no-print">
          <div className="flex items-center gap-3">
            {!isFirstPortal && onPrevPortal ? (
              <button
                type="button"
                onClick={onPrevPortal}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-sm transition-colors cursor-pointer whitespace-nowrap"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Previous Portal
              </button>
            ) : (
              <span className="text-xs text-slate-500 font-medium">
                Portal 1 of 10 • Official NVEA Enrolment Form
              </span>
            )}
            <span className="text-xs text-slate-600 hidden sm:inline">
              {portalIncompleteRequiredCount > 0 ? (
                <span className="text-amber-800 font-medium">
                  {portalIncompleteRequiredCount} required field
                  {portalIncompleteRequiredCount > 1 ? 's' : ''} still incomplete in this portal
                </span>
              ) : (
                <span className="text-emerald-800 font-medium">
                  All required fields in this portal are complete
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {!isLastPortal && onNextPortal ? (
              <button
                type="button"
                onClick={onNextPortal}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs md:text-sm font-bold text-white bg-[#0F2942] hover:bg-[#1E3A8A] rounded-sm shadow-xs transition-colors cursor-pointer whitespace-nowrap"
              >
                <span>Next ({portal.id + 1}. Portal)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onSubmitForm}
                className="inline-flex items-center gap-2 px-6 py-2 text-xs md:text-sm font-bold text-white bg-emerald-800 hover:bg-emerald-700 rounded-sm shadow-xs transition-colors cursor-pointer whitespace-nowrap"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Submit Complete NVEA Admission Form</span>
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
