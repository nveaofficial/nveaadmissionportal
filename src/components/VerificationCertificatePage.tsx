import React, { useEffect, useState } from 'react';
import { ShieldCheck, CheckCircle2, Printer, ArrowLeft, Award, QrCode } from 'lucide-react';
import {
  AdmissionVerificationPayload,
  extractVerificationPayload,
  formatIstDateTime,
  generateAdmissionConfirmedSealPng,
  generateAdmissionQrDataUrl,
} from '../utils/verificationUtils';

interface VerificationCertificatePageProps {
  verifyRecordParam: string;
  encodedDataParam: string | null;
  nveaLogoPng: string;
}

export const VerificationCertificatePage: React.FC<VerificationCertificatePageProps> = ({
  verifyRecordParam,
  encodedDataParam,
  nveaLogoPng,
}) => {
  const [record, setRecord] = useState<AdmissionVerificationPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [sealUrl, setSealUrl] = useState<string>('');
  const [qrUrl, setQrUrl] = useState<string>('');

  useEffect(() => {
    let active = true;

    const buildPayloadFromServer = (srv: Record<string, unknown>): AdmissionVerificationPayload => {
      const recNo = String(srv.recordNumber || verifyRecordParam);
      const verId = String(srv.verificationId || `NVEA-OTP-${recNo.replace(/[^A-Z0-9]/gi, '')}`);
      const verifiedAtRaw = String(srv.verifiedAt || new Date().toISOString());
      const { dateIst, timeIst } = formatIstDateTime(verifiedAtRaw);

      const base = extractVerificationPayload(
        recNo,
        {
          q2: String(srv.applicantName || '—'),
          q38: String(srv.admissionDate || dateIst),
          q41: String(srv.srNumber || '—'),
          q42: String(srv.registrationNumber || recNo),
          q43: String(srv.enrollmentNumber || recNo),
          q40: String(srv.interviewSerialNumber || '—'),
          q74: String(srv.courseClass || '—'),
          q171: `Consent Verified / Approved (${String(srv.verifiedContact || '')} • ${verId})`,
        },
        verifiedAtRaw,
        String(srv.verifiedContact || '')
      );

      if (srv.interviewSerialNumber) {
        base.interviewSerialNumber = String(srv.interviewSerialNumber);
      }

      if (Array.isArray(srv.seventeenPoints) && srv.seventeenPoints.length > 0) {
        base.seventeenPoints = srv.seventeenPoints as AdmissionVerificationPayload['seventeenPoints'];
      }
      if (Array.isArray(srv.summaryIdentifiers) && srv.summaryIdentifiers.length > 0) {
        base.summaryIdentifiers =
          srv.summaryIdentifiers as AdmissionVerificationPayload['summaryIdentifiers'];
      } else {
        base.verificationDateIst = dateIst;
        base.verificationTimeIst = timeIst;
      }

      return base;
    };

    const parseFallbackFromUrl = (): AdmissionVerificationPayload | null => {
      if (!encodedDataParam) return null;
      try {
        const json = decodeURIComponent(escape(atob(encodedDataParam)));
        const parsed = JSON.parse(json);
        return buildPayloadFromServer({
          recordNumber: parsed.r || verifyRecordParam,
          verificationId: parsed.v,
          applicantName: parsed.n,
          srNumber: parsed.sr,
          registrationNumber: parsed.reg,
          enrollmentNumber: parsed.enr,
          admissionDate: parsed.dt,
          courseClass: parsed.c,
          verifiedAt: parsed.dt,
        });
      } catch {
        return null;
      }
    };

    fetch(`/api/verification/${encodeURIComponent(verifyRecordParam)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        if (data?.ok && data?.record) {
          setRecord(buildPayloadFromServer(data.record));
        } else {
          setRecord(parseFallbackFromUrl());
        }
      })
      .catch(() => {
        if (active) {
          setRecord(parseFallbackFromUrl());
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [verifyRecordParam, encodedDataParam]);

  useEffect(() => {
    if (!record) return;
    setSealUrl(generateAdmissionConfirmedSealPng(record));
    generateAdmissionQrDataUrl(record).then((url) => setQrUrl(url));
  }, [record]);

  return (
    <div className="min-h-screen bg-slate-100 py-4 px-3 flex flex-col items-center justify-center print:bg-white print:p-0 print:min-h-0">
      <div className="max-w-4xl w-full bg-white border-2 border-[#0F2942] rounded-sm shadow-md overflow-hidden break-inside-avoid">
        {/* Compact Header */}
        <div className="bg-[#0F2942] text-white px-5 py-3.5 border-b-4 border-[#D97706] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {nveaLogoPng && (
              <img
                src={nveaLogoPng}
                alt="NVEA Logo"
                className="w-14 h-14 rounded-full bg-white p-1 object-contain shrink-0"
              />
            )}
            <div>
              <div className="text-[11px] font-bold tracking-widest text-amber-300 uppercase">
                Official Online Admission &amp; Consent Verification Record
              </div>
              <h1 className="text-base sm:text-lg font-extrabold tracking-wide text-white">
                NAND VIDHYA EDUCATION ACADEMY (NVEA / नव्या)
              </h1>
              <p className="text-[11px] text-slate-200">
                Registered Educational Institution • Since 2006 • Single-Page A4 Verification Certificate
              </p>
            </div>
          </div>
          <div className="hidden sm:flex flex-col items-end text-right shrink-0">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-700 text-white text-xs font-bold rounded-xs border border-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>OTP VERIFIED</span>
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {loading ? (
            <div className="py-10 text-center text-sm font-semibold text-slate-600">
              Verifying Official NVEA Admission Record ({verifyRecordParam})...
            </div>
          ) : !record ? (
            <div className="p-5 bg-red-50 border border-red-300 rounded-sm text-center space-y-1.5">
              <div className="text-sm font-bold text-red-900">
                Verification Record Not Found ({verifyRecordParam})
              </div>
              <p className="text-xs text-red-800">
                No verified admission record was found for this reference ID. Please ensure OTP verification has been completed.
              </p>
            </div>
          ) : (
            <>
              {/* Confirmation Banner */}
              <div className="bg-emerald-50 border-2 border-emerald-700 rounded-sm px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-6 h-6 text-emerald-700 shrink-0" />
                  <div>
                    <div className="text-xs sm:text-sm font-extrabold text-emerald-950 uppercase">
                      ADMISSION &amp; CONSENT CONFIRMED • OTP VERIFIED
                    </div>
                    <div className="text-[11px] text-emerald-900 font-mono-num break-words [overflow-wrap:anywhere]">
                      OTP Verification ID: {record.verificationId} • Record Ref: {record.recordNumber} • IST: {record.verificationDateIst}, {record.verificationTimeIst}
                    </div>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 text-[11px] font-bold bg-emerald-800 text-white rounded-xs uppercase">
                  ✓ Authentic Record
                </span>
              </div>

              {/* Single-Page Grid: Symmetrical Two-Column Summary with Center Round Seal + Logo + QR Code */}
              {(() => {
                const half = Math.ceil(record.summaryIdentifiers.length / 2);
                const leftRecords = record.summaryIdentifiers.slice(0, half);
                const rightRecords = record.summaryIdentifiers.slice(half);

                return (
                  <div className="border-2 border-[#0F2942] rounded-sm overflow-hidden bg-white shadow-xs">
                    {/* Top of the Verification Admission Record Summary */}
                    <div className="bg-[#0F2942] text-white px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#D97706]">
                      <div className="flex items-center gap-2 text-xs sm:text-sm font-bold uppercase tracking-wide">
                        <Award className="w-4 h-4 text-[#F59E0B] shrink-0" />
                        <span>VERIFIED ADMISSION RECORD SUMMARY</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11.5px] font-bold px-2.5 py-0.5 bg-amber-500/20 text-amber-200 border border-amber-400/40 rounded-xs font-mono-num">
                          INTERVIEW SERIAL NUMBER: {record.interviewSerialNumber}
                        </span>
                        <span className="text-[10px] font-mono-num text-emerald-200 font-semibold hidden sm:inline">
                          OFFICIAL AUTHENTICATION
                        </span>
                      </div>
                    </div>

                    <div className="p-3 grid grid-cols-1 md:grid-cols-12 gap-3 items-center bg-white">
                      {/* Left Column: First half of records in proper sequence */}
                      <div className="md:col-span-4 border border-slate-300 rounded-sm overflow-hidden bg-white">
                        <table className="w-full border-collapse text-[11px] leading-snug">
                          <tbody>
                            {leftRecords.map((item, idx) => {
                              const isStatus = item.label.includes('Status');
                              return (
                                <tr
                                  key={item.label}
                                  className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/90'}
                                >
                                  <td className="px-2.5 py-1 border-b border-r border-slate-200 font-semibold text-slate-700 w-[50%] align-top">
                                    {item.label}
                                  </td>
                                  <td
                                    className={`px-2.5 py-1 border-b border-slate-200 font-mono-num font-bold break-words [overflow-wrap:anywhere] align-top ${
                                      isStatus ? 'text-emerald-800' : 'text-[#0F2942]'
                                    }`}
                                  >
                                    {item.value}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Center Column: Existing Round Seal + Logo + QR Code */}
                      <div className="md:col-span-4 flex flex-col items-center justify-center text-center p-2.5 bg-slate-50/60 border border-dashed border-slate-300 rounded-sm gap-2">
                        {nveaLogoPng && (
                          <div className="flex flex-col items-center">
                            <img
                              src={nveaLogoPng}
                              alt="NVEA Official Circular Logo"
                              className="w-12 h-12 object-contain"
                            />
                            <span className="text-[10px] font-bold text-[#0F2942] tracking-wide mt-0.5">
                              NAND VIDHYA EDUCATION ACADEMY
                            </span>
                          </div>
                        )}
                        {sealUrl && (
                          <div className="flex flex-col items-center">
                            <img
                              src={sealUrl}
                              alt="Official NVEA Admission Confirmation Seal"
                              className="w-28 h-28 object-contain"
                            />
                            <span className="text-[10.5px] font-bold text-[#4C1D95]">
                              Official Admission Confirmation Seal
                            </span>
                            <span className="text-[9.5px] font-mono-num text-slate-600">
                              {record.sealRegistrationNumber}
                            </span>
                          </div>
                        )}
                        {qrUrl && (
                          <div className="flex flex-col items-center">
                            <img
                              src={qrUrl}
                              alt="Official Verification QR Code"
                              className="w-24 h-24 object-contain bg-white p-1 border border-slate-200 rounded-xs"
                            />
                            <span className="text-[10px] font-bold text-[#0F2942] mt-0.5">
                              17-Point Verification QR
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Right Column: Remaining half of records in proper sequence */}
                      <div className="md:col-span-4 border border-slate-300 rounded-sm overflow-hidden bg-white">
                        <table className="w-full border-collapse text-[11px] leading-snug">
                          <tbody>
                            {rightRecords.map((item, idx) => {
                              const isStatus = item.label.includes('Status');
                              return (
                                <tr
                                  key={item.label}
                                  className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/90'}
                                >
                                  <td className="px-2.5 py-1 border-b border-r border-slate-200 font-semibold text-slate-700 w-[50%] align-top">
                                    {item.label}
                                  </td>
                                  <td
                                    className={`px-2.5 py-1 border-b border-slate-200 font-mono-num font-bold break-words [overflow-wrap:anywhere] align-top ${
                                      isStatus ? 'text-emerald-800' : 'text-[#0F2942]'
                                    }`}
                                  >
                                    {item.value}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-100 border-t border-slate-300 px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 no-print">
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0F2942] hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to NVEA Online Admission Portal</span>
          </a>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-[#0F2942] hover:bg-[#1E3A8A] rounded-sm cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Single-Page A4 Verification Record</span>
          </button>
        </div>
      </div>
    </div>
  );
};
