import React, { useRef, useState } from 'react';
import {
  X,
  Save,
  Share2,
  FileDown,
  FolderOpen,
  Upload,
  Copy,
  Check,
  Trash2,
  ExternalLink,
  Mail,
  RefreshCw,
  Cloud,
} from 'lucide-react';
import { User } from 'firebase/auth';

export interface SavedFormSummary {
  formId: string;
  recordNumber: string;
  applicantName: string;
  savedAt: string;
  submitted: boolean;
  submittedAt?: string;
}

interface SaveShareModalProps {
  mode: 'save' | 'share' | null;
  onClose: () => void;
  recordNumber: string;
  applicantName: string;
  finalPayableFee: string;
  savedForms: SavedFormSummary[];
  onSaveCurrentForm: () => Promise<string>;
  onReopenSavedForm: (formId: string) => void;
  onDeleteSavedForm: (formId: string) => void;
  onExportJsonFile: () => void;
  onImportJsonFile: (file: File) => void;
  onDownloadStandaloneHtml: () => void;
  onDownloadPdf: () => Promise<void>;
  onSharePdfOrLinkWhatsApp: () => Promise<void>;
  isGeneratingPdf: boolean;
  firebaseUser?: User | null;
  onSignInWithGoogle?: () => Promise<User | null>;
}

export const SaveShareModal: React.FC<SaveShareModalProps> = ({
  mode,
  onClose,
  recordNumber,
  applicantName,
  finalPayableFee,
  savedForms,
  onSaveCurrentForm,
  onReopenSavedForm,
  onDeleteSavedForm,
  onExportJsonFile,
  onImportJsonFile,
  onDownloadStandaloneHtml,
  onDownloadPdf,
  onSharePdfOrLinkWhatsApp,
  isGeneratingPdf,
  firebaseUser,
  onSignInWithGoogle,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [statusNote, setStatusNote] = useState('');
  const [busyAction, setBusyAction] = useState(false);

  if (!mode) return null;

  const shareableUrl = `${window.location.origin}/?formId=${encodeURIComponent(recordNumber)}`;
  const shareSummaryText = `NVEA Official Admission Form\nRecord No: ${recordNumber}\nApplicant: ${
    applicantName || 'Applicant'
  }${finalPayableFee ? `\nFinal Payable Fee: ${finalPayableFee}` : ''}\nOpen / View Form Link: ${shareableUrl}`;

  const handleCopyShareLink = async () => {
    setBusyAction(true);
    await onSaveCurrentForm();
    await navigator.clipboard.writeText(shareableUrl);
    setCopiedLink(true);
    setStatusNote('Shareable form link copied! Anyone with this link can open the saved form.');
    setBusyAction(false);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleDirectWhatsAppLinkShare = async () => {
    setBusyAction(true);
    await onSaveCurrentForm();
    setBusyAction(false);
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareSummaryText)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const handleEmailShare = async () => {
    setBusyAction(true);
    await onSaveCurrentForm();
    setBusyAction(false);
    const subject = `NVEA Official Admission Form - ${recordNumber}`;
    const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
      shareSummaryText
    )}`;
    window.location.href = mailto;
  };

  const handleNativePlatformShare = async () => {
    setBusyAction(true);
    await onSaveCurrentForm();
    setBusyAction(false);
    if (navigator.share) {
      try {
        await navigator.share({
          title: `NVEA Admission Form — ${recordNumber}`,
          text: shareSummaryText,
          url: shareableUrl,
        });
      } catch {
        // user cancelled
      }
    } else {
      handleCopyShareLink();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 no-print">
      <div className="bg-white border-2 border-[#0F2942] rounded-sm shadow-xl max-w-2xl w-full overflow-hidden">
        <div className="bg-[#0F2942] text-white px-4 py-3 border-b-2 border-[#D97706] flex items-center justify-between">
          <div className="flex items-center gap-2">
            {mode === 'save' ? (
              <Save className="w-4 h-4 text-amber-300" />
            ) : (
              <Share2 className="w-4 h-4 text-amber-300" />
            )}
            <div>
              <h3 className="text-sm font-bold tracking-wide">
                {mode === 'save'
                  ? 'Save, Backup & Reopen Saved NVEA Admission Forms'
                  : 'Share NVEA Admission Form (WhatsApp PDF / Shareable Link)'}
              </h3>
              <p className="text-xs text-slate-300">
                Active Record: <span className="font-mono-num font-bold text-amber-300">{recordNumber}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-200 hover:text-white p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
          {statusNote && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-300 rounded-sm text-xs text-emerald-900 font-medium flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{statusNote}</span>
            </div>
          )}

          {mode === 'save' ? (
            <>
              {/* Save Actions */}
              <div className="bg-[#F8FAFC] border border-slate-300 rounded-sm p-3 space-y-2.5">
                <p className="text-xs font-bold text-[#0F2942]">
                  1. Save Current Form Data (Reopen &amp; Edit Anytime)
                </p>
                <p className="text-xs text-slate-600">
                  Your form data and uploaded documents are saved both in this browser/server list below and can also be downloaded as an editable file to reopen later on any device.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={busyAction}
                    onClick={async () => {
                      setBusyAction(true);
                      await onSaveCurrentForm();
                      setBusyAction(false);
                      setStatusNote(
                        `Form ${recordNumber} saved successfully! You can reopen and edit it anytime below.`
                      );
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-700 rounded-sm cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Current Form Now</span>
                  </button>

                  <button
                    type="button"
                    onClick={onExportJsonFile}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#0F2942] bg-white hover:bg-slate-100 border border-slate-300 rounded-sm cursor-pointer"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>Download Editable Form File (.nvea.json)</span>
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        onImportJsonFile(f);
                        setStatusNote(`Loaded saved form file "${f.name}" for editing!`);
                        e.target.value = '';
                      }
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#1E3A8A] bg-[#EFF6FF] hover:bg-blue-100 border border-blue-300 rounded-sm cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Open Saved Form File (.nvea.json)</span>
                  </button>

                  <button
                    type="button"
                    onClick={onDownloadStandaloneHtml}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-sm cursor-pointer"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>Save Standalone HTML</span>
                  </button>
                </div>
              </div>

              {/* Saved Forms Directory */}
              <div className="border border-slate-300 rounded-sm overflow-hidden">
                <div className="bg-slate-100 px-3 py-2 border-b border-slate-300 flex items-center justify-between">
                  <span className="text-xs font-bold text-[#0F2942] flex items-center gap-1.5">
                    <FolderOpen className="w-3.5 h-3.5 text-[#1E3A8A]" />
                    Saved Forms History (Click &ldquo;Reopen &amp; Edit&rdquo; to resume any form)
                  </span>
                  <span className="text-[11px] font-mono-num text-slate-600">
                    {savedForms.length} Saved
                  </span>
                </div>

                {savedForms.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500">
                    No saved forms yet. Click &ldquo;Save Current Form Now&rdquo; above to store this application.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200 max-h-60 overflow-y-auto">
                    {savedForms.map((item) => (
                      <div
                        key={item.formId}
                        className="px-3 py-2.5 flex flex-wrap items-center justify-between gap-2 bg-white hover:bg-slate-50"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono-num font-bold text-[#991B1B]">
                              {item.recordNumber}
                            </span>
                            <span className="text-xs font-semibold text-slate-800">
                              {item.applicantName || 'Applicant'}
                            </span>
                            <span className="text-[10.5px] font-semibold text-slate-500">
                              • {item.submitted ? 'Submitted' : 'Editable Draft'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 font-mono-num">
                            Last Saved: {new Date(item.savedAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              onReopenSavedForm(item.formId);
                              onClose();
                            }}
                            className="px-2.5 py-1 text-xs font-bold text-white bg-[#0F2942] hover:bg-[#1E3A8A] rounded-sm cursor-pointer"
                          >
                            Reopen &amp; Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteSavedForm(item.formId)}
                            className="p-1 text-slate-500 hover:text-red-700 cursor-pointer"
                            title="Delete saved entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* WhatsApp Primary Sharing Section */}
              <div className="bg-emerald-50/70 border-2 border-emerald-700 rounded-sm p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs sm:text-sm font-bold text-emerald-950">
                    WhatsApp Direct Share (PDF Attachment or Live Shareable Form Link)
                  </h4>
                  <span className="text-[11px] font-bold text-emerald-800 uppercase">
                    Mandatory Active
                  </span>
                </div>
                <p className="text-xs text-emerald-900 leading-relaxed">
                  Click <strong>&ldquo;Share PDF / Form on WhatsApp&rdquo;</strong> to share the generated PDF file directly via WhatsApp on supported devices; if direct PDF attachment sharing is not supported by your browser, it automatically saves and shares the live Shareable Form Link directly to WhatsApp.
                </p>

                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    disabled={isGeneratingPdf || busyAction}
                    onClick={onSharePdfOrLinkWhatsApp}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 rounded-sm cursor-pointer shadow-xs"
                  >
                    {isGeneratingPdf ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Preparing PDF for WhatsApp...</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-4 h-4" />
                        <span>Share PDF / Form on WhatsApp</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={busyAction}
                    onClick={handleDirectWhatsAppLinkShare}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-emerald-950 bg-white hover:bg-emerald-100 border border-emerald-600 rounded-sm cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open WhatsApp with Shareable Form Link</span>
                  </button>
                </div>
              </div>

              {/* Other Sharing Platforms & Direct PDF Download */}
              <div className="bg-[#F8FAFC] border border-slate-300 rounded-sm p-3.5 space-y-2.5">
                <h4 className="text-xs font-bold text-[#0F2942]">
                  Share via Other Platforms &amp; Direct Link
                </h4>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleNativePlatformShare}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#0F2942] hover:bg-[#1E3A8A] rounded-sm cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share via Device Apps (Telegram / Drive / More)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleEmailShare}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white hover:bg-slate-100 border border-slate-300 rounded-sm cursor-pointer"
                  >
                    <Mail className="w-3.5 h-3.5 text-[#1E3A8A]" />
                    <span>Share via Email</span>
                  </button>

                  <button
                    type="button"
                    disabled={isGeneratingPdf}
                    onClick={onDownloadPdf}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0F2942] bg-amber-400 hover:bg-amber-300 rounded-sm cursor-pointer"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>Download PDF File</span>
                  </button>
                </div>

                {/* Shareable Link Copy Box */}
                <div className="pt-2">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Shareable Form Link (Opens this saved application on any browser):
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      readOnly
                      value={shareableUrl}
                      className="flex-1 h-8 px-2.5 text-xs font-mono-num bg-white border border-slate-300 rounded-sm text-slate-800"
                    />
                    <button
                      type="button"
                      onClick={handleCopyShareLink}
                      className="h-8 inline-flex items-center gap-1 px-3 text-xs font-bold text-white bg-[#1E3A8A] hover:bg-[#1D4ED8] rounded-sm cursor-pointer shrink-0"
                    >
                      {copiedLink ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-300" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Link</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="bg-slate-100 border-t border-slate-300 px-4 py-2.5 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold text-white bg-[#0F2942] hover:bg-[#1E3A8A] rounded-sm cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
