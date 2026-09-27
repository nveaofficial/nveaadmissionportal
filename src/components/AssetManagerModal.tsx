import React from 'react';
import { X, Upload, RotateCcw } from 'lucide-react';
import { OfficialAssets } from '../utils/officialAssets';

interface AssetManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  assets: OfficialAssets;
  onUpdateAsset: (key: keyof OfficialAssets, dataUrl: string) => void;
  onResetDefaults: () => void;
}

export const AssetManagerModal: React.FC<AssetManagerModalProps> = ({
  isOpen,
  onClose,
  assets,
  onUpdateAsset,
  onResetDefaults,
}) => {
  if (!isOpen) return null;

  const handleFileUpload = (
    key: keyof OfficialAssets,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onUpdateAsset(key, reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 no-print">
      <div className="bg-white border border-slate-300 rounded-sm shadow-xl max-w-xl w-full overflow-hidden">
        <div className="bg-[#0F2942] text-white px-4 py-3 border-b-2 border-[#D97706] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold tracking-wide">
              Official NVEA Logo &amp; Bank QR Configuration
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Single Official NVEA Circular Logo (Header &amp; Page Watermark) and Official Union Bank QR Code.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-200 hover:text-white p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 1. Single Official NVEA Circular Logo */}
          <div className="border border-slate-300 rounded-sm p-3 flex flex-col items-center justify-between bg-slate-50">
            <div className="text-center mb-2">
              <p className="text-xs font-bold text-[#0F2942]">1. Official NVEA Logo</p>
              <p className="text-[11px] text-slate-500">
                Front-Page Header &amp; Centered Watermark (HD Transparent PNG)
              </p>
            </div>
            <div className="w-32 h-32 bg-white border border-slate-200 flex items-center justify-center p-2 mb-3">
              {assets.nveaCircularLogoPng && (
                <img
                  src={assets.nveaCircularLogoPng}
                  alt="NVEA Official Logo"
                  referrerPolicy="no-referrer"
                  className="max-w-full max-h-full object-contain"
                />
              )}
            </div>
            <label className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#0F2942] hover:bg-[#1E3A8A] rounded-sm cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Official Logo PNG</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileUpload('nveaCircularLogoPng', e)}
                className="hidden"
              />
            </label>
          </div>

          {/* 2. Bank Payment QR Code */}
          <div className="border border-slate-300 rounded-sm p-3 flex flex-col items-center justify-between bg-slate-50">
            <div className="text-center mb-2">
              <p className="text-xs font-bold text-[#0F2942]">2. Official Payment / Bank QR</p>
              <p className="text-[11px] text-slate-500">Union Bank (72923201@ubin)</p>
            </div>
            <div className="w-32 h-32 bg-white border border-slate-200 flex items-center justify-center p-1 mb-3">
              {assets.bankQrCardPng && (
                <img
                  src={assets.bankQrCardPng}
                  alt="Union Bank QR Code"
                  referrerPolicy="no-referrer"
                  className="max-w-full max-h-full object-contain"
                />
              )}
            </div>
            <label className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#0F2942] hover:bg-[#1E3A8A] rounded-sm cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>Upload QR Image</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileUpload('bankQrCardPng', e)}
                className="hidden"
              />
            </label>
          </div>
        </div>

        <div className="bg-slate-100 border-t border-slate-300 px-4 py-2.5 flex items-center justify-between">
          <button
            type="button"
            onClick={onResetDefaults}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-sm cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to Default NVEA Official Graphics
          </button>
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
