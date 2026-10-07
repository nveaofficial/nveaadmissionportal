import React, { useEffect, useState, useRef } from 'react';
import { WifiOff, CheckCircle2, RefreshCw, X, Database } from 'lucide-react';

interface NetworkStatusToastProps {
  isOnline: boolean;
  pendingSyncCount?: number;
  onTriggerSync?: () => Promise<void>;
  lastSyncSummary?: string | null;
}

export const NetworkStatusToast: React.FC<NetworkStatusToastProps> = ({
  isOnline,
  pendingSyncCount = 0,
  onTriggerSync,
  lastSyncSummary,
}) => {
  const [toast, setToast] = useState<{
    type: 'offline' | 'reconnected' | 'syncing' | 'synced';
    title: string;
    description: string;
  } | null>(null);

  const wasOffline = useRef(false);
  const autoDismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (autoDismissTimer.current) {
      clearTimeout(autoDismissTimer.current);
      autoDismissTimer.current = null;
    }

    if (!isOnline) {
      wasOffline.current = true;
      const countDesc =
        pendingSyncCount > 0
          ? ` (${pendingSyncCount} submission${pendingSyncCount > 1 ? 's' : ''} queued in IndexedDB for automatic background sync).`
          : '.';
      setToast({
        type: 'offline',
        title: 'Offline Mode Active',
        description: `You are currently working offline. All form inputs, documents, and submissions are safely preserved in browser local storage & IndexedDB${countDesc}`,
      });
    } else {
      // If returning online after being offline
      if (wasOffline.current) {
        setToast({
          type: 'reconnected',
          title: 'Internet Connection Restored',
          description:
            lastSyncSummary ||
            (pendingSyncCount > 0
              ? `Reconnected! Processing ${pendingSyncCount} queued submission(s) in background...`
              : 'You are back online. All features are running with active network connectivity.'),
        });
        wasOffline.current = false;
        autoDismissTimer.current = setTimeout(() => {
          setToast(null);
        }, 5000);
      } else if (lastSyncSummary) {
        // Notification for background sync completion
        setToast({
          type: 'synced',
          title: 'Background Sync Complete',
          description: lastSyncSummary,
        });
        autoDismissTimer.current = setTimeout(() => {
          setToast(null);
        }, 4500);
      }
    }

    return () => {
      if (autoDismissTimer.current) {
        clearTimeout(autoDismissTimer.current);
      }
    };
  }, [isOnline, pendingSyncCount, lastSyncSummary]);

  const handleManualSync = async () => {
    if (!onTriggerSync || isSyncing) return;
    setIsSyncing(true);
    try {
      await onTriggerSync();
    } finally {
      setIsSyncing(false);
    }
  };

  if (!toast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 max-w-sm sm:max-w-md w-full px-3 no-print pointer-events-auto"
    >
      <div
        className={`flex items-start gap-3 p-3.5 rounded-sm shadow-xl border backdrop-blur-xs text-xs sm:text-sm transition-all duration-300 ${
          toast.type === 'offline'
            ? 'bg-slate-900/95 border-amber-500/80 text-amber-100 shadow-amber-950/20'
            : 'bg-[#0F2942]/95 border-emerald-500/80 text-emerald-100 shadow-emerald-950/20'
        }`}
      >
        <div className="shrink-0 mt-0.5">
          {toast.type === 'offline' ? (
            <div className="relative flex items-center justify-center">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping absolute" />
              <WifiOff className="w-4 h-4 text-amber-400 relative z-10" />
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold tracking-tight text-white text-xs sm:text-sm">
              {toast.title}
            </p>
            <span
              className={`text-[10px] uppercase font-bold px-1.5 py-0.2 rounded-xs border ${
                toast.type === 'offline'
                  ? 'bg-amber-950/80 text-amber-300 border-amber-600/40'
                  : 'bg-emerald-950/80 text-emerald-300 border-emerald-600/40'
              }`}
            >
              {toast.type === 'offline' ? 'Local Only' : 'Connected'}
            </span>
            {pendingSyncCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.2 rounded-xs bg-blue-950/80 text-blue-300 border border-blue-500/40">
                <Database className="w-2.5 h-2.5" />
                <span>{pendingSyncCount} Queued</span>
              </span>
            )}
          </div>
          <p className="text-[11px] sm:text-xs text-slate-300 mt-1 leading-relaxed">
            {toast.description}
          </p>

          {isOnline && pendingSyncCount > 0 && onTriggerSync && (
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                disabled={isSyncing}
                onClick={handleManualSync}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-600 disabled:opacity-60 rounded-xs cursor-pointer shadow-xs transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Syncing...' : 'Sync Queue Now'}</span>
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setToast(null)}
          className="text-slate-400 hover:text-white p-1 rounded-xs transition-colors shrink-0 -mr-1 -mt-1 cursor-pointer"
          title="Dismiss notification"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
