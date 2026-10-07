import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already installed and running standalone, suppress button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-[#0F2942] bg-amber-400 hover:bg-amber-300 rounded-sm shadow-xs transition-colors cursor-pointer whitespace-nowrap"
        title="Install NVEA Admission Portal app to your device for offline use"
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span>Install App</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-100 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-sm transition-colors cursor-pointer whitespace-nowrap"
          title="Install app to your iPhone / iPad home screen"
        >
          <Smartphone className="w-3.5 h-3.5 shrink-0" />
          <span>Install on iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 no-print">
            <div className="w-full max-w-sm rounded-sm bg-white p-5 shadow-2xl border-2 border-[#0F2942] text-slate-900">
              <div className="flex items-center justify-between border-b pb-2 mb-3">
                <h3 className="text-sm font-bold text-[#0F2942] flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-amber-600" />
                  Install on iPhone / iPad
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed space-y-2">
                1. Tap the <strong>Share</strong> button (box with upward arrow) at the bottom of Safari.<br />
                2. Scroll down and tap <strong>Add to Home Screen</strong>.<br />
                3. The NVEA Admission Portal will be available directly from your home screen with offline capability.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full rounded-sm bg-[#0F2942] py-2 text-xs font-bold text-white hover:bg-[#1E3A8A] transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
