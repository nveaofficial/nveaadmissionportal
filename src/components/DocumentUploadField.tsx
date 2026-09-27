import React, { useRef } from 'react';
import { Upload, Trash2, Eye, FileCheck, AlertCircle } from 'lucide-react';
import { FilePreviewFrameType } from '../data/formSchema';

export interface UploadedFileItem {
  name: string;
  type: string;
  size: number;
  dataUrl: string;
}

interface DocumentUploadFieldProps {
  questionId: string;
  questionNumber: number;
  label: string;
  frameType: FilePreviewFrameType;
  files: UploadedFileItem[];
  onChange: (files: UploadedFileItem[]) => void;
  isIncompleteRequired?: boolean;
  showValidationWarning?: boolean;
}

export const DocumentUploadField: React.FC<DocumentUploadFieldProps> = ({
  questionId,
  questionNumber,
  label,
  frameType,
  files,
  onChange,
  isIncompleteRequired = false,
  showValidationWarning = false,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    const fileArray = Array.from(selectedFiles);
    const promises = fileArray.map(
      (file) =>
        new Promise<UploadedFileItem>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            resolve({
              name: file.name,
              type: file.type || 'image/png',
              size: file.size,
              dataUrl: typeof reader.result === 'string' ? reader.result : '',
            });
          };
          reader.readAsDataURL(file);
        })
    );

    Promise.all(promises).then((newItems) => {
      onChange([...files, ...newItems]);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    });
  };

  const handleRemoveFile = (idx: number) => {
    const updated = files.filter((_, i) => i !== idx);
    onChange(updated);
  };

  // Frame sizing according to Requirement 23:
  // - Photo & Signature: Appropriately sized smaller preview areas, complete image visible without cropping
  // - Aadhaar Card (Q78): Approximately half-page size while maintaining readability
  // - All Other Documents (Q79-Q89 & Q170 Consent Certificate): Complete A4 page-style preview in full original proportion
  const getFrameConfig = () => {
    switch (frameType) {
      case 'photo':
        return {
          badge: 'Passport Photograph Frame (Full Uncropped View)',
          emptyHeight: 'min-h-[160px]',
          filledContainerClass:
            'w-full min-h-[210px] max-h-[260px] bg-white border-2 border-slate-400 p-2 flex items-center justify-center',
          imgClass: 'max-h-[235px] w-auto max-w-full object-contain mx-auto',
        };
      case 'signature':
        return {
          badge: 'Applicant Signature Frame (Full Uncropped View)',
          emptyHeight: 'min-h-[160px]',
          filledContainerClass:
            'w-full min-h-[210px] max-h-[260px] bg-white border-2 border-slate-400 p-2 flex items-center justify-center',
          imgClass: 'max-h-[220px] w-auto max-w-full object-contain mx-auto',
        };
      case 'aadhaar_half':
        return {
          badge: 'Half-Page Aadhaar Document Frame (Approx. 1/2 A4 Page Scale)',
          emptyHeight: 'min-h-[140px]',
          filledContainerClass:
            'w-full min-h-[440px] bg-white border-2 border-[#1E3A8A]/60 p-3 flex flex-col items-center justify-center doc-preview-half',
          imgClass: 'w-full max-h-[480px] object-contain mx-auto',
        };
      case 'a4_full':
      default:
        return {
          badge: 'Full A4 Page-Style Document Preview Frame (1:1.414 Original Proportion)',
          emptyHeight: 'min-h-[140px]',
          filledContainerClass:
            'w-full min-h-[820px] bg-white border-2 border-[#0F2942]/70 p-4 flex flex-col items-center justify-center doc-preview-a4 shadow-inner',
          imgClass: 'w-full max-h-[1020px] object-contain mx-auto',
        };
    }
  };

  const config = getFrameConfig();

  return (
    <div className="mt-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-700">Files submitted:</span>
          {files.length > 0 && (
            <span className="text-xs font-medium text-emerald-800 flex items-center gap-1">
              <FileCheck className="w-3.5 h-3.5 text-emerald-700" />
              {files.length} Document{files.length > 1 ? 's' : ''} Visualized
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 no-print">
          <input
            ref={inputRef}
            id={`file-${questionId}`}
            type="file"
            accept="image/*,application/pdf"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-white bg-[#0F2942] hover:bg-[#1E3A8A] rounded-sm transition-colors cursor-pointer whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5" />
            {files.length > 0 ? 'Add / Replace Document' : 'Select Document / Image'}
          </button>
          {files.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-sm transition-colors cursor-pointer whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Empty State vs Full Framed Document Visualization */}
      {files.length === 0 ? (
        <div
          onClick={() => inputRef.current?.click()}
          className={`w-full ${config.emptyHeight} border border-dashed transition-colors rounded-sm p-3 flex flex-col items-center justify-center text-center cursor-pointer ${
            isIncompleteRequired && showValidationWarning
              ? 'border-red-500 bg-red-50/40 hover:bg-red-50/70'
              : isIncompleteRequired
              ? 'border-amber-500/80 bg-amber-50/25 hover:bg-amber-50/50'
              : 'border-slate-400 bg-slate-50/70 hover:bg-slate-100/80'
          }`}
        >
          <Upload
            className={`w-5 h-5 mb-1 no-print ${
              isIncompleteRequired && showValidationWarning
                ? 'text-red-600'
                : isIncompleteRequired
                ? 'text-amber-700'
                : 'text-[#1E3A8A]'
            }`}
          />
          <p className="text-xs font-semibold text-slate-800">
            Click to upload {label} (Q.{questionNumber})
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">{config.badge}</p>
          {isIncompleteRequired && (
            <p
              className={`text-[11px] font-medium mt-1 flex items-center gap-1 no-print ${
                showValidationWarning ? 'text-red-700 font-semibold' : 'text-amber-800'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Required document upload pending</span>
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {files.map((file, idx) => {
            const isPdf =
              file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
            return (
              <div
                key={`${file.name}-${idx}`}
                className="border border-slate-300 bg-slate-50 rounded-sm overflow-hidden"
              >
                {/* Top bar inside frame */}
                <div className="flex items-center justify-between px-3 py-1 bg-[#F1F5F9] border-b border-slate-300 text-[11px] text-slate-700">
                  <div className="flex items-center gap-2 truncate">
                    <Eye className="w-3.5 h-3.5 text-[#0F2942] shrink-0" />
                    <span className="font-semibold text-[#0F2942]">
                      Q.{questionNumber} Official Document Preview
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">{file.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(idx)}
                    className="text-red-700 hover:underline font-medium no-print ml-2 shrink-0 cursor-pointer"
                  >
                    Remove
                  </button>
                </div>

                {/* Proper Uncropped Visual Preview Frame */}
                <div className={config.filledContainerClass}>
                  {isPdf ? (
                    <object
                      data={file.dataUrl}
                      type="application/pdf"
                      className={
                        frameType === 'aadhaar_half'
                          ? 'w-full h-[440px] border-0'
                          : 'w-full h-[820px] border-0'
                      }
                    >
                      <iframe
                        src={file.dataUrl}
                        title={file.name}
                        className={
                          frameType === 'aadhaar_half'
                            ? 'w-full h-[440px] border-0'
                            : 'w-full h-[820px] border-0'
                        }
                      />
                    </object>
                  ) : (
                    <img
                      src={file.dataUrl}
                      alt={`${label} - Full Preview`}
                      referrerPolicy="no-referrer"
                      className={config.imgClass}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
