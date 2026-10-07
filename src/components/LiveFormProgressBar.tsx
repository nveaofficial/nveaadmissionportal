import React from 'react';
import { CheckCircle2, Clock, FileCheck2, CreditCard, ShieldCheck } from 'lucide-react';
import { LiveFormProgressResult } from '../utils/formProgress';

interface LiveFormProgressBarProps {
  progress: LiveFormProgressResult;
}

export const LiveFormProgressBar: React.FC<LiveFormProgressBarProps> = ({ progress }) => {
  const {
    percentage,
    completedCount,
    totalTrackedCount,
    statusText,
    documentsVerified,
    uploadedMandatoryDocsCount,
    totalMandatoryDocsCount,
    paymentConfirmed,
    otpVerified,
  } = progress;

  // Subtle color transition based on completion stage
  const getBarColorClass = () => {
    if (percentage === 0) return 'bg-slate-400';
    if (percentage < 50) return 'bg-[#1E3A8A]';
    if (percentage < 75) return 'bg-[#0284C7]';
    if (percentage < 100) return 'bg-[#D97706]';
    return 'bg-emerald-600';
  };

  const getStatusBadgeClass = () => {
    if (percentage === 0) {
      return 'bg-slate-100 text-slate-700 border-slate-300';
    }
    if (percentage < 75) {
      return 'bg-blue-50 text-[#1E3A8A] border-blue-300';
    }
    if (percentage < 100) {
      return 'bg-amber-50 text-amber-900 border-amber-400';
    }
    return 'bg-emerald-50 text-emerald-900 border-emerald-500';
  };

  return (
    <div
      id="live-form-completion-progress"
      role="region"
      aria-label="Live Form Completion Progress"
      className="mb-3 bg-white border-2 border-[#0F2942] rounded-sm px-3 py-2.5 shadow-xs no-print"
    >
      {/* Top Row: Title + Status Badge + Live Percentage */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-[#0F2942]">
            Live Form Completion Progress
          </span>
          <span
            id="live-progress-status-text"
            className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold border rounded-xs transition-colors duration-200 ${getStatusBadgeClass()}`}
          >
            {percentage === 100 ? (
              <CheckCircle2 className="w-3 h-3 text-emerald-700 shrink-0" />
            ) : (
              <Clock className="w-3 h-3 shrink-0" />
            )}
            <span>{statusText}</span>
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="text-[11px] font-mono-num font-semibold text-slate-600">
            Active Fields: <strong className="text-[#0F2942]">{completedCount}</strong> /{' '}
            {totalTrackedCount}
          </span>
          <span
            id="live-progress-percentage"
            className={`text-sm sm:text-base font-mono-num font-extrabold px-2 py-0.5 rounded-xs border transition-colors duration-200 ${
              percentage === 100
                ? 'bg-emerald-700 text-white border-emerald-800'
                : percentage >= 75
                ? 'bg-[#D97706] text-white border-amber-700'
                : 'bg-[#0F2942] text-white border-[#0F2942]'
            }`}
          >
            {percentage}%
          </span>
        </div>
      </div>

      {/* Progress Bar Track */}
      <div
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Form completion ${percentage}% - ${statusText}`}
        className="w-full h-2.5 bg-slate-200 rounded-xs overflow-hidden border border-slate-300"
      >
        <div
          id="live-progress-bar-fill"
          style={{ width: `${percentage}%` }}
          className={`h-full transition-all duration-300 ease-out ${getBarColorClass()}`}
        />
      </div>

      {/* Bottom Row: Scale Markers (0%, 25%, 50%, 75%, 100%) & Verification Milestones */}
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[10.5px] text-slate-600">
        <div className="flex items-center gap-3 font-mono-num">
          <span className={percentage === 0 ? 'font-bold text-[#0F2942]' : ''}>0%</span>
          <span className={percentage >= 25 ? 'font-bold text-[#1E3A8A]' : ''}>25%</span>
          <span className={percentage >= 50 ? 'font-bold text-[#0284C7]' : ''}>50%</span>
          <span className={percentage >= 75 ? 'font-bold text-[#D97706]' : ''}>75%</span>
          <span className={percentage === 100 ? 'font-bold text-emerald-700' : ''}>100%</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[10.5px]">
          <span
            className={`inline-flex items-center gap-1 font-medium ${
              documentsVerified ? 'text-emerald-800 font-bold' : 'text-slate-600'
            }`}
          >
            <FileCheck2 className="w-3 h-3 shrink-0" />
            <span>
              Mandatory Docs: {uploadedMandatoryDocsCount}/{totalMandatoryDocsCount}
            </span>
          </span>
          <span aria-hidden="true" className="text-slate-300">
            |
          </span>
          <span
            className={`inline-flex items-center gap-1 font-medium ${
              paymentConfirmed ? 'text-emerald-800 font-bold' : 'text-slate-600'
            }`}
          >
            <CreditCard className="w-3 h-3 shrink-0" />
            <span>Payment: {paymentConfirmed ? 'Confirmed' : 'Pending'}</span>
          </span>
          <span aria-hidden="true" className="text-slate-300">
            |
          </span>
          <span
            className={`inline-flex items-center gap-1 font-medium ${
              otpVerified ? 'text-emerald-800 font-bold' : 'text-slate-600'
            }`}
          >
            <ShieldCheck className="w-3 h-3 shrink-0" />
            <span>OTP: {otpVerified ? 'Verified' : 'Pending'}</span>
          </span>
        </div>
      </div>
    </div>
  );
};
