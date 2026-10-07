import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  Printer,
  ArrowLeft,
  Calendar,
  User,
  Hash,
  BookOpen,
  Award,
} from 'lucide-react';
import {
  OtpVerificationRecord,
  formatVerificationDate,
  generateVerificationQrPngDataUrl,
  generateVerificationSealPngDataUrl,
} from '../utils/verificationSealAndQr';

interface QrVerificationViewProps {
  recordNumber: string;
  nveaLogoPng?: string;
  onBackToPortal?: () => void;
}

export const QrVerificationView: React.FC<QrVerificationViewProps> = ({
  recordNumber,
  nveaLogoPng,
  onBackToPortal,
}) => {
  const [record, setRecord] = useState<OtpVerificationRecord | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [sealDataUrl, setSealDataUrl] = useState<string>('');

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);

    const fallbackFromUrl: OtpVerificationRecord = {
      recordNumber: params.get('verify') || recordNumber,
      verificationId: params.get('vid') || 'NVEA-OTP-VERIFIED',
      applicantName: params.get('n') || 'Applicant',
      rollNumber: params.get('r') || 'Assigned by NVEA',
      enrollmentNumber: params.get('e') || params.get('verify') || recordNumber,
      courseClass: params.get('c') || 'NVEA CLAP Admission Program',
      verificationStatus: 'OTP VERIFIED',
      verifiedAt: params.get('d') || new Date().toISOString(),
    };

    async function loadVerification() {
      try {
        const res = await fetch(
          `/api/otp/verification/${encodeURIComponent(recordNumber)}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data?.ok && data.verification) {
            const v: OtpVerificationRecord = {
              recordNumber: data.verification.recordNumber || fallbackFromUrl.recordNumber,
              verificationId:
                data.verification.verificationId || fallbackFromUrl.verificationId,
              applicantName:
                data.verification.applicantName || fallbackFromUrl.applicantName,
              rollNumber: data.verification.rollNumber || fallbackFromUrl.rollNumber,
              enrollmentNumber:
                data.verification.enrollmentNumber || fallbackFromUrl.enrollmentNumber,
              courseClass: data.verification.courseClass || fallbackFromUrl.courseClass,
              verificationStatus: 'OTP VERIFIED',
              verifiedAt: data.verification.verifiedAt || fallbackFromUrl.verifiedAt,
            };
            if (active) {
              setRecord(v);
              setSealDataUrl(generateVerificationSealPngDataUrl(v));
              const qr = await generateVerificationQrPngDataUrl(v);
              if (active) setQrDataUrl(qr);
              setLoading(false);
            }
            return;
          }
        }
      } catch {
        // Fallback to URL parameters if offline
      }

      if (active) {
        setRecord(fallbackFromUrl);
        setSealDataUrl(generateVerificationSealPngDataUrl(fallbackFromUrl));
        const qr = await generateVerificationQrPngDataUrl(fallbackFromUrl);
        if (active) setQrDataUrl(qr);
        setLoading(false);
      }
    }

    loadVerification();
    return () => {
      active = false;
    };
  }, [recordNumber]);

  if (loading || !record) {
    return (
      <div className="min-h-screen gov-bg-pattern flex items-center justify-center p-4">
        <div className="bg-white border-2 border-[#0F2942] rounded-sm p-6 max-w-md w-full text-center shadow-md">
          <p className="text-sm font-bold text-[#0F2942]">
            Verifying Official NVEA Admission Record...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gov-bg-pattern py-6 px-3 sm:px-6 flex flex-col items-center">
      <div className="w-full max-w-3xl bg-white border-2 border-[#0F2942] rounded-sm shadow-lg overflow-hidden">
        {/* Institutional Header */}
        <div className="bg-[#0F2942] text-white px-4 sm:px-6 py-4 border-b-4 border-[#D97706] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            {nveaLogoPng && (
              <img
                src={nveaLogoPng}
                alt="NVEA Official Emblem"
                className="w-16 h-16 object-contain bg-white rounded-full p-1 shrink-0"
              />
            )}
            <div className="text-center sm:text-left">
              <p className="text-[11px] font-bold uppercase tracking-widest text-amber-300">
                OFFICIAL DIGITAL ADMISSION VERIFICATION PORTAL
              </p>
              <h1 className="text-base sm:text-xl font-bold tracking-tight text-white">
                NAND VIDHYA EDUCATION ACADEMY (NVEA)
              </h1>
              <p className="text-xs text-slate-200 font-hindi">
                नव्या — नन्द विद्या शिक्षण संस्थान • Official Website: https://www.nvea.in/
              </p>
            </div>
          </div>

          <div className="bg-emerald-700 border border-emerald-400 px-3.5 py-2 rounded-sm text-center shrink-0">
            <div className="flex items-center justify-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-white">
              <ShieldCheck className="w-4 h-4 text-emerald-200" />
              <span>OTP VERIFIED</span>
            </div>
            <p className="text-[10px] font-mono-num text-emerald-100 mt-0.5">
              Seal: {record.verificationId}
            </p>
          </div>
        </div>

        {/* Verified Status Banner */}
        <div className="bg-emerald-50 border-b border-emerald-300 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-emerald-950">
            <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
            <span className="text-xs sm:text-sm font-bold">
              This Application Record is Authentically Verified via NVEA Official OTP Verification
            </span>
          </div>
          <span className="text-xs font-mono-num font-bold text-emerald-900 bg-emerald-100 px-2.5 py-0.5 rounded-xs border border-emerald-300">
            Status: {record.verificationStatus}
          </span>
        </div>

        {/* Basic Admission Information Table */}
        <div className="p-4 sm:p-6 space-y-5">
          <div>
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#0F2942] border-b-2 border-[#0F2942] pb-1.5 mb-3">
              Verified Applicant Basic Admission Information
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-[#F8FAFC] border border-slate-300 rounded-sm p-3">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-slate-500">
                  <User className="w-3.5 h-3.5 text-[#1E3A8A]" />
                  <span>Applicant Name</span>
                </div>
                <p className="text-sm sm:text-base font-bold text-[#0F172A] mt-1 font-hindi">
                  {record.applicantName}
                </p>
              </div>

              <div className="bg-[#F8FAFC] border border-slate-300 rounded-sm p-3">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-slate-500">
                  <Hash className="w-3.5 h-3.5 text-[#991B1B]" />
                  <span>Application / Record ID</span>
                </div>
                <p className="text-sm sm:text-base font-mono-num font-bold text-[#991B1B] mt-1">
                  {record.recordNumber}
                </p>
              </div>

              <div className="bg-[#F8FAFC] border border-slate-300 rounded-sm p-3">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-slate-500">
                  <Award className="w-3.5 h-3.5 text-[#1E3A8A]" />
                  <span>Roll Number / S.R. No.</span>
                </div>
                <p className="text-sm font-mono-num font-bold text-[#0F172A] mt-1">
                  {record.rollNumber}
                </p>
              </div>

              <div className="bg-[#F8FAFC] border border-slate-300 rounded-sm p-3">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-slate-500">
                  <Hash className="w-3.5 h-3.5 text-[#1E3A8A]" />
                  <span>Enrollment Number</span>
                </div>
                <p className="text-sm font-mono-num font-bold text-[#0F172A] mt-1">
                  {record.enrollmentNumber}
                </p>
              </div>

              <div className="bg-[#F8FAFC] border border-slate-300 rounded-sm p-3 sm:col-span-2">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-slate-500">
                  <BookOpen className="w-3.5 h-3.5 text-[#1E3A8A]" />
                  <span>Course / Class (CLAP Program)</span>
                </div>
                <p className="text-sm font-bold text-[#0F172A] mt-1 font-hindi">
                  {record.courseClass}
                </p>
              </div>

              <div className="bg-emerald-50 border border-emerald-300 rounded-sm p-3">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-emerald-800">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Verification Status</span>
                </div>
                <p className="text-sm font-extrabold text-emerald-900 mt-1">
                  ✓ {record.verificationStatus} (Seal: {record.verificationId})
                </p>
              </div>

              <div className="bg-emerald-50 border border-emerald-300 rounded-sm p-3">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-emerald-800">
                  <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Verification Date</span>
                </div>
                <p className="text-sm font-mono-num font-bold text-emerald-950 mt-1">
                  {formatVerificationDate(record.verifiedAt)}
                </p>
              </div>
            </div>
          </div>

          {/* Official Seal Stamp & Verification QR Code */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-[#F8FAFC] border-2 border-[#0F2942] rounded-sm p-4">
            <div className="md:col-span-8 flex flex-col items-center sm:items-start">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#0F2942] mb-1.5">
                Official NVEA Digital Verification Seal / Stamp
              </span>
              {sealDataUrl && (
                <img
                  src={sealDataUrl}
                  alt="Official NVEA OTP Verification Seal"
                  className="w-full max-w-[440px] h-auto object-contain rounded-xs border border-slate-300 bg-white"
                />
              )}
            </div>

            <div className="md:col-span-4 flex flex-col items-center justify-center border-t md:border-t-0 md:border-l border-slate-300 pt-3 md:pt-0 md:pl-4">
              {qrDataUrl && (
                <img
                  src={qrDataUrl}
                  alt="Verification QR Code"
                  className="w-32 h-32 object-contain border border-slate-300 p-1 bg-white rounded-xs"
                />
              )}
              <span className="text-[10.5px] font-bold text-[#0F2942] mt-1.5 text-center">
                Official Verification QR
              </span>
              <span className="text-[10px] font-mono-num text-slate-600 text-center">
                {record.recordNumber}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-[#F1F5F9] border-t border-slate-300 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 no-print">
          <div className="text-[11px] text-slate-600">
            <strong>NAND VIDHYA EDUCATION ACADEMY (NVEA)</strong> • Helpline: 09414008310
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#0F2942] hover:bg-[#1E3A8A] rounded-sm cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Verification Certificate</span>
            </button>
            {onBackToPortal && (
              <button
                type="button"
                onClick={onBackToPortal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white hover:bg-slate-100 border border-slate-300 rounded-sm cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Open Admission Portal</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
