import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Printer,
  FilePlus2,
  CheckCircle2,
  Layers,
  LayoutGrid,
  Settings,
  Search,
  RotateCcw,
  AlertCircle,
  ArrowRightCircle,
  Save,
  FileDown,
  Share2,
  RefreshCw,
  ExternalLink,
  Link2,
} from 'lucide-react';
import {
  PORTALS,
  QUESTIONS,
  isQuestionRequired,
  SOURCE_TO_TARGET_MAP,
  PACKAGE_MODE_TO_CLAP_SEGMENT_MAP,
  PRESELECTED_DROPDOWN_DEFAULTS,
} from './data/formSchema';
import {
  PortalRenderer,
  FormAnswers,
  FormUploadedFiles,
  checkQuestionComplete,
} from './components/PortalRenderer';
import { GlobalSearchBar, GlobalSearchResultItem } from './components/GlobalSearchBar';
import { LiveFormProgressBar } from './components/LiveFormProgressBar';
import { computeLiveFormProgress } from './utils/formProgress';
import { UploadedFileItem } from './components/DocumentUploadField';
import {
  ActiveRecordState,
  getOrInitActiveRecord,
  generateNextApplicationRecord,
  markRecordSubmitted,
  getTodayDateKey,
} from './utils/recordNumber';
import {
  OfficialAssets,
  generateNveaCircularLogoPng,
  generateUnionBankQrCardPng,
  getStoredCustomAssets,
  saveStoredCustomAssets,
} from './utils/officialAssets';
import { AssetManagerModal } from './components/AssetManagerModal';
import { downloadStandaloneHtmlSnapshot } from './utils/exportStandaloneHtml';
import { computeAllAutomaticFees, hasNumericInput } from './utils/feeCalculations';
import {
  generateAdmissionFormPdf,
  downloadAdmissionFormPdf,
} from './utils/pdfGenerator';
import { SaveShareModal, SavedFormSummary } from './components/SaveShareModal';
import { VerificationCertificatePage } from './components/VerificationCertificatePage';
import { PWAInstallButton } from './components/PWAInstallButton';
import { NetworkStatusToast } from './components/NetworkStatusToast';
import {
  enqueueSubmission,
  getPendingQueueCount,
  processBackgroundSyncQueue,
} from './utils/offlineSyncQueue';
import { playSuccessChime } from './utils/audioEffects';

const ANSWERS_STORAGE_KEY = 'nvea_current_form_answers_v1';
const UPLOADED_FILES_STORAGE_KEY = 'nvea_current_uploaded_files_v1';
const LOCAL_SAVED_FORMS_MAP_KEY = 'nvea_saved_forms_map_v1';
const LAST_AUTOSAVE_TIME_KEY = 'nvea_last_autosaved_time_v1';

interface LocalSavedFormEntry extends SavedFormSummary {
  recordState: ActiveRecordState;
  answers: FormAnswers;
  uploadedFiles: FormUploadedFiles;
}

function getLocalSavedFormsMap(): Record<string, LocalSavedFormEntry> {
  try {
    const raw = localStorage.getItem(LOCAL_SAVED_FORMS_MAP_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalSavedFormsMap(map: Record<string, LocalSavedFormEntry>): void {
  try {
    localStorage.setItem(LOCAL_SAVED_FORMS_MAP_KEY, JSON.stringify(map));
  } catch {
    // ignore quota errors
  }
}

/**
 * Synchronizes all 34 One-Way SOURCE -> TARGET mappings on initialization or form load,
 * applies the 3 preselected dropdown defaults (Q.93 q90, Q.95 q92, Q.113 q110) when loading/initializing,
 * and cleans up any legacy invalid value on Q123 (Deponent's Sex).
 */
function synchronizeMappedAnswers(
  raw: FormAnswers,
  applyPreselectedDefaults = true
): FormAnswers {
  const next: FormAnswers = { ...raw };

  // Apply the 3 required preselected dropdown options on form load / reset (Updates 1, 2, 3)
  if (applyPreselectedDefaults) {
    for (const [qId, defaultOption] of Object.entries(PRESELECTED_DROPDOWN_DEFAULTS)) {
      if (typeof next[qId] !== 'string' || next[qId].trim() === '') {
        next[qId] = defaultOption;
      }
    }
  }

  // Ensure Q123 only holds valid Deponent's Sex options ('Male' | 'Female' | 'Gay' | '')
  if (
    typeof next.q123 === 'string' &&
    next.q123 !== '' &&
    !['Male', 'Female', 'Gay'].includes(next.q123)
  ) {
    next.q123 = '';
  }

  // Recompute automatic fee fields if any fee formula inputs are present and target fee field is empty
  const computed = computeAllAutomaticFees(next);
  if (computed.q97 && !next.q97) next.q97 = computed.q97;
  if (computed.q103 && !next.q103) next.q103 = computed.q103;
  if (computed.q106 && !next.q106) next.q106 = computed.q106;
  if (computed.q107 && !next.q107) next.q107 = computed.q107;
  if (computed.q117 && !next.q117) next.q117 = computed.q117;

  // Apply all SOURCE -> TARGET mappings where SOURCE has a value (or is explicitly present)
  for (const [sourceId, targetId] of Object.entries(SOURCE_TO_TARGET_MAP)) {
    if (sourceId in next) {
      next[targetId] = next[sourceId];
    }
  }

  // Apply Package Mode (id: q58) -> CLAP Segment (id: q150) mapping
  if (typeof next.q58 === 'string' && next.q58 in PACKAGE_MODE_TO_CLAP_SEGMENT_MAP) {
    next.q150 = PACKAGE_MODE_TO_CLAP_SEGMENT_MAP[next.q58];
  }

  return next;
}

/**
 * Filters answers & uploadedFiles to strictly include ONLY filled/uploaded data
 * for Save, Export, Print, and Download.
 */
function filterFilledAnswers(raw: FormAnswers): FormAnswers {
  const filtered: FormAnswers = {};
  for (const [k, v] of Object.entries(raw)) {
    if (Array.isArray(v)) {
      if (v.length > 0) filtered[k] = v;
    } else if (typeof v === 'string' && v.trim() !== '') {
      filtered[k] = v;
    }
  }
  return filtered;
}

function filterFilledUploads(raw: FormUploadedFiles): FormUploadedFiles {
  const filtered: FormUploadedFiles = {};
  for (const [k, v] of Object.entries(raw)) {
    if (Array.isArray(v) && v.length > 0) {
      filtered[k] = v;
    }
  }
  return filtered;
}

export default function App() {
  // 1. Automatic Record Number State (Requirement 13)
  const [recordState, setRecordState] = useState<ActiveRecordState>(() =>
    getOrInitActiveRecord()
  );

  // 2. Active Portal Navigation (1 to 10) & View Mode ('single' vs 'all_compact')
  const [activePortalId, setActivePortalId] = useState<number>(1);
  const [viewMode, setViewMode] = useState<'single' | 'all_compact'>('single');
  const [isPrinting, setIsPrinting] = useState<boolean>(false);

  // 3. Question Search / Jump filter (1 to 172)
  const [jumpQuery, setJumpQuery] = useState<string>('');

  // 4. Form Answers State (persisted in localStorage for current draft, with Q.93, Q.95, Q.113 preselected on load)
  const [answers, setAnswers] = useState<FormAnswers>(() => {
    try {
      const saved = localStorage.getItem(ANSWERS_STORAGE_KEY);
      if (saved) return synchronizeMappedAnswers(JSON.parse(saved), true);
    } catch {
      // ignore
    }
    return synchronizeMappedAnswers({}, true);
  });

  // 5. Uploaded Documents State (Full visual previews for Q76-Q89 & Q170)
  const [uploadedFiles, setUploadedFiles] = useState<FormUploadedFiles>(() => {
    try {
      const saved = localStorage.getItem(UPLOADED_FILES_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return {};
  });

  // 6. Visual Validation Indicators State
  const [highlightIncomplete, setHighlightIncomplete] = useState<boolean>(true);
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});
  const [showSubmitWarning, setShowSubmitWarning] = useState<boolean>(false);

  // 7. Single Official NVEA Circular Logo & Union Bank QR Code Assets
  const [assets, setAssets] = useState<OfficialAssets>({
    nveaCircularLogoPng: '',
    bankQrCardPng: '',
  });
  const [isAssetModalOpen, setIsAssetModalOpen] = useState<boolean>(false);

  // 8. Save, Download as PDF & Share State
  const [saveShareModalMode, setSaveShareModalMode] = useState<'save' | 'share' | null>(null);
  const [savedFormsList, setSavedFormsList] = useState<SavedFormSummary[]>([]);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [actionBannerMsg, setActionBannerMsg] = useState<string>('');

  // 9. Persistent Online/Offline Network Status Indicator & IndexedDB Background Sync Queue
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.navigator.onLine : true
  );
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [lastSyncSummary, setLastSyncSummary] = useState<string | null>(null);

  // 10. 30-Second Draft Auto-Save Feature
  const [lastAutoSaveTime, setLastAutoSaveTime] = useState<string>(() => {
    try {
      const savedIso = localStorage.getItem(LAST_AUTOSAVE_TIME_KEY);
      if (savedIso) {
        return new Date(savedIso).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
      }
    } catch {
      // ignore
    }
    return '';
  });
  const [isAutoSavingDraft, setIsAutoSavingDraft] = useState<boolean>(false);

  // Initialize high-definition transparent PNG NVEA circular logo & Union Bank QR code
  useEffect(() => {
    let mounted = true;
    async function initAssets() {
      const custom = getStoredCustomAssets();
      const defaultCircular = generateNveaCircularLogoPng();
      const defaultQr = await generateUnionBankQrCardPng();

      if (mounted) {
        setAssets({
          nveaCircularLogoPng: custom.nveaCircularLogoPng || defaultCircular,
          bankQrCardPng: custom.bankQrCardPng || defaultQr,
        });
      }
    }
    initAssets();
    return () => {
      mounted = false;
    };
  }, []);

  const effectiveAnswers: FormAnswers = answers;

  // Keep refs synchronized for the 30-second background interval timer
  const answersRef = useRef(effectiveAnswers);
  answersRef.current = effectiveAnswers;
  const uploadedFilesRef = useRef(uploadedFiles);
  uploadedFilesRef.current = uploadedFiles;
  const recordStateRef = useRef(recordState);
  recordStateRef.current = recordState;

  // Persist current draft answers & uploaded files in localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(ANSWERS_STORAGE_KEY, JSON.stringify(effectiveAnswers));
    } catch {
      // ignore
    }
  }, [effectiveAnswers]);

  useEffect(() => {
    try {
      localStorage.setItem(UPLOADED_FILES_STORAGE_KEY, JSON.stringify(uploadedFiles));
    } catch {
      // ignore quota errors
    }
  }, [uploadedFiles]);

  // Periodic 30-Second Draft Auto-Save Interval to prevent data loss during long sessions
  useEffect(() => {
    const AUTO_SAVE_INTERVAL_MS = 30 * 1000; // 30 seconds

    const performDraftAutoSave = () => {
      setIsAutoSavingDraft(true);
      try {
        const curAnswers = answersRef.current;
        const curUploads = uploadedFilesRef.current;
        const curRecord = recordStateRef.current;
        const now = new Date();
        const nowIso = now.toISOString();

        // 1. Snapshot form answers and uploaded files
        localStorage.setItem(ANSWERS_STORAGE_KEY, JSON.stringify(curAnswers));
        localStorage.setItem(UPLOADED_FILES_STORAGE_KEY, JSON.stringify(curUploads));
        localStorage.setItem(LAST_AUTOSAVE_TIME_KEY, nowIso);

        // 2. Also register draft in local saved forms map for session recovery
        const applicantName =
          (typeof curAnswers.q2 === 'string' && curAnswers.q2.trim()) ||
          (typeof curAnswers.q119 === 'string' && curAnswers.q119.trim()) ||
          'Draft Applicant';

        const formId = curRecord.recordNumber;
        const localMap = getLocalSavedFormsMap();
        localMap[formId] = {
          formId,
          recordNumber: curRecord.recordNumber,
          applicantName,
          savedAt: nowIso,
          submitted: curRecord.submitted,
          submittedAt: curRecord.submittedAt,
          recordState: curRecord,
          answers: filterFilledAnswers(curAnswers),
          uploadedFiles: filterFilledUploads(curUploads),
        };
        saveLocalSavedFormsMap(localMap);

        const formattedTime = now.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        setLastAutoSaveTime(formattedTime);
      } catch (err) {
        console.warn('Draft auto-save notice:', err);
      } finally {
        setTimeout(() => {
          setIsAutoSavingDraft(false);
        }, 1200);
      }
    };

    // Auto-save every 30 seconds
    const intervalTimer = setInterval(performDraftAutoSave, AUTO_SAVE_INTERVAL_MS);

    // Also auto-save on page unload
    const handleBeforeUnload = () => {
      try {
        localStorage.setItem(ANSWERS_STORAGE_KEY, JSON.stringify(answersRef.current));
        localStorage.setItem(UPLOADED_FILES_STORAGE_KEY, JSON.stringify(uploadedFilesRef.current));
        localStorage.setItem(LAST_AUTOSAVE_TIME_KEY, new Date().toISOString());
      } catch {
        // ignore
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(intervalTimer);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Refresh saved forms list from local storage + server
  const refreshSavedFormsList = useCallback(async () => {
    const localMap = getLocalSavedFormsMap();
    const mergedMap = new Map<string, SavedFormSummary>();
    Object.values(localMap).forEach((item) => {
      mergedMap.set(item.formId, {
        formId: item.formId,
        recordNumber: item.recordNumber,
        applicantName: item.applicantName,
        savedAt: item.savedAt,
        submitted: item.submitted,
        submittedAt: item.submittedAt,
      });
    });

    try {
      const res = await fetch('/api/forms/list');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.forms)) {
          data.forms.forEach((f: SavedFormSummary) => {
            mergedMap.set(f.formId, f);
          });
        }
      }
    } catch {
      // offline/standalone fallback
    }

    const sorted = Array.from(mergedMap.values()).sort((a, b) =>
      (b.savedAt || '').localeCompare(a.savedAt || '')
    );
    setSavedFormsList(sorted);
  }, []);

  useEffect(() => {
    refreshSavedFormsList();
  }, [refreshSavedFormsList]);

  // Background sync processor for IndexedDB offline queue
  const triggerBackgroundSync = useCallback(async () => {
    try {
      const res = await processBackgroundSyncQueue();
      setPendingSyncCount(res.remaining);
      if (res.synced > 0) {
        setLastSyncSummary(
          `Auto-synchronized ${res.synced} offline submission${res.synced > 1 ? 's' : ''} (${res.syncedRecords.join(', ')}) to server.`
        );
        await refreshSavedFormsList();
      }
    } catch {
      // ignore transient network errors
    }
  }, [refreshSavedFormsList]);

  // Initial check of pending queue count on app load
  useEffect(() => {
    getPendingQueueCount()
      .then((count) => {
        setPendingSyncCount(count);
        if (count > 0 && typeof window !== 'undefined' && window.navigator.onLine) {
          triggerBackgroundSync();
        }
      })
      .catch(() => {});
  }, [triggerBackgroundSync]);

  // Automatically trigger sync when 'online' event is detected
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      await triggerBackgroundSync();
    };
    const handleOffline = () => {
      setIsOnline(false);
      getPendingQueueCount().then(setPendingSyncCount).catch(() => {});
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [triggerBackgroundSync]);

  // Listen to service worker background sync messages
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const handleSwMsg = (e: MessageEvent) => {
        if (e.data?.type === 'NVEA_TRIGGER_BACKGROUND_SYNC') {
          triggerBackgroundSync();
        }
      };
      navigator.serviceWorker.addEventListener('message', handleSwMsg);
      return () => {
        navigator.serviceWorker.removeEventListener('message', handleSwMsg);
      };
    }
  }, [triggerBackgroundSync]);

  // Load shared/saved form if ?formId=... is present in the URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedFormId = params.get('formId');
    if (!sharedFormId) return;

    async function loadSharedForm(formId: string) {
      try {
        const res = await fetch(`/api/forms/${encodeURIComponent(formId)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.ok && data.form) {
            if (data.form.recordState?.recordNumber) {
              setRecordState(data.form.recordState);
            }
            if (data.form.answers) {
              setAnswers(synchronizeMappedAnswers(data.form.answers));
            }
            if (data.form.uploadedFiles) {
              setUploadedFiles(data.form.uploadedFiles);
            }
            setActionBannerMsg(`Opened shared/saved form ${data.form.recordNumber}.`);
            return;
          }
        }
      } catch {
        // fallback to local
      }

      const localMap = getLocalSavedFormsMap();
      const localFound = localMap[formId];
      if (localFound) {
        setRecordState(localFound.recordState);
        setAnswers(synchronizeMappedAnswers(localFound.answers));
        setUploadedFiles(localFound.uploadedFiles || {});
        setActionBannerMsg(`Opened saved form ${localFound.recordNumber}.`);
      }
    }

    loadSharedForm(sharedFormId);
  }, []);

  // Listen for browser print events so all 10 portals print together sequentially
  useEffect(() => {
    const handleBeforePrint = () => setIsPrinting(true);
    const handleAfterPrint = () => setIsPrinting(false);
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);

  const handleAnswerChange = (questionId: string, value: string | string[]) => {
    setAnswers((prev) => {
      const next: FormAnswers = {
        ...prev,
        [questionId]: value,
      };

      // If one of the fee formula input fields changed with numeric input (or was cleared from numeric input),
      // update its dependent fee fields and their synchronized targets
      const is92to96 =
        questionId === 'q92' ||
        questionId === 'q93' ||
        questionId === 'q94' ||
        questionId === 'q95' ||
        questionId === 'q96';

      const hadNumericBefore = hasNumericInput(prev[questionId]);
      const hasNumericNow = hasNumericInput(value);

      if (
        (is92to96 || questionId === 'q105' || questionId === 'q116') &&
        (hasNumericNow || hadNumericBefore)
      ) {
        const computed = computeAllAutomaticFees(next);
        if (is92to96) {
          next.q97 = computed.q97;
          next.q103 = computed.q103;
          next.q159 = computed.q97;
          next.q160 = computed.q103;
        }
        if (questionId === 'q105') {
          next.q103 = computed.q103;
          next.q106 = computed.q106;
          next.q107 = computed.q107;
          next.q117 = computed.q117;
          next.q160 = computed.q103;
          next.q162 = computed.q106;
          next.q163 = computed.q107;
          next.q167 = computed.q117;
        }
        if (questionId === 'q116') {
          next.q117 = computed.q117;
          next.q167 = computed.q117;
        }
      }

      // Strictly apply One-Way SOURCE -> TARGET synchronization
      const mappedTargetId = SOURCE_TO_TARGET_MAP[questionId];
      if (mappedTargetId) {
        next[mappedTargetId] = value;
      }

      // Strictly apply Package Mode (id: q58) -> CLAP Segment (id: q150) synchronization
      if (questionId === 'q58') {
        next.q150 =
          typeof value === 'string' && value
            ? PACKAGE_MODE_TO_CLAP_SEGMENT_MAP[value] || ''
            : '';
      }

      return next;
    });
  };

  const handleFileChange = (questionId: string, files: UploadedFileItem[]) => {
    setUploadedFiles((prev) => ({
      ...prev,
      [questionId]: files,
    }));
  };

  const handleFieldBlur = (questionId: string) => {
    setTouchedFields((prev) => (prev[questionId] ? prev : { ...prev, [questionId]: true }));
  };

  const handleSelectPortal = (portalId: number) => {
    setActivePortalId(portalId);
    if (viewMode === 'all_compact') {
      const el = document.getElementById(`portal-section-${portalId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const jumpToQuestionByNumber = (num: number) => {
    const q = QUESTIONS.find((item) => item.number === num);
    if (!q) return;
    setActivePortalId(q.portalId);
    setTimeout(() => {
      const boxEl = document.getElementById(`question-box-${num}`);
      if (boxEl) {
        boxEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        boxEl.classList.remove('global-search-highlight');
        void boxEl.offsetWidth;
        boxEl.classList.add('global-search-highlight');
        setTimeout(() => {
          boxEl.classList.remove('global-search-highlight');
        }, 2800);
      }
      const inputEl = document.getElementById(`input-${q.id}`);
      if (inputEl && typeof (inputEl as HTMLElement).focus === 'function') {
        (inputEl as HTMLElement).focus({ preventScroll: true });
      }
    }, 100);
  };

  const handleGlobalSearchJump = (result: GlobalSearchResultItem) => {
    if (result.questionNumber) {
      jumpToQuestionByNumber(result.questionNumber);
      return;
    }
    setActivePortalId(result.portalId);
    setTimeout(() => {
      const targetEl =
        (result.elementSelector
          ? (document.querySelector(result.elementSelector) as HTMLElement | null)
          : null) || document.getElementById(`portal-section-${result.portalId}`);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetEl.classList.remove('global-search-highlight');
        void targetEl.offsetWidth;
        targetEl.classList.add('global-search-highlight');
        setTimeout(() => {
          targetEl.classList.remove('global-search-highlight');
        }, 2800);
      }
    }, 100);
  };

  // Compute required & completed statistics across all 172 questions
  const requiredQuestions = useMemo(
    () => QUESTIONS.filter((q) => isQuestionRequired(q)),
    []
  );

  const incompleteRequiredQuestions = useMemo(
    () =>
      requiredQuestions.filter(
        (q) => !checkQuestionComplete(q, effectiveAnswers, uploadedFiles)
      ),
    [requiredQuestions, effectiveAnswers, uploadedFiles]
  );

  // Incomplete required questions prior to Point 173/174 (Questions 1 to 172)
  const priorIncompleteCountForQ171 = useMemo(
    () => incompleteRequiredQuestions.filter((q) => q.number < 173).length,
    [incompleteRequiredQuestions]
  );

  const handleJumpToNextIncomplete = () => {
    setHighlightIncomplete(true);
    if (incompleteRequiredQuestions.length === 0) return;
    const inCurrentPortal = incompleteRequiredQuestions.find(
      (q) => q.portalId === activePortalId
    );
    const target = inCurrentPortal || incompleteRequiredQuestions[0];
    jumpToQuestionByNumber(target.number);
  };

  // Save Current Form Function (Requirement 1)
  const handleSaveCurrentForm = useCallback(async (): Promise<string> => {
    const savedAt = new Date().toISOString();
    const applicantName =
      typeof effectiveAnswers.q2 === 'string' && effectiveAnswers.q2.trim()
        ? effectiveAnswers.q2.trim()
        : typeof effectiveAnswers.q119 === 'string' && effectiveAnswers.q119.trim()
        ? effectiveAnswers.q119.trim()
        : 'Applicant';

    const formId = recordState.recordNumber;
    const filledOnlyAnswers = filterFilledAnswers(effectiveAnswers);
    const filledOnlyUploads = filterFilledUploads(uploadedFiles);
    const entry: LocalSavedFormEntry = {
      formId,
      recordNumber: recordState.recordNumber,
      applicantName,
      savedAt,
      submitted: recordState.submitted,
      submittedAt:
        (typeof effectiveAnswers.submissionDate === 'string' &&
          effectiveAnswers.submissionDate) ||
        recordState.submittedAt,
      recordState,
      answers: filledOnlyAnswers,
      uploadedFiles: filledOnlyUploads,
    };

    const localMap = getLocalSavedFormsMap();
    localMap[formId] = entry;
    saveLocalSavedFormsMap(localMap);

    let serverSaved = false;
    if (typeof window !== 'undefined' && window.navigator.onLine) {
      try {
        const res = await fetch('/api/forms/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry),
        });
        serverSaved = res.ok;
      } catch {
        serverSaved = false;
      }
    }

    if (!serverSaved) {
      try {
        await enqueueSubmission(
          entry,
          typeof window !== 'undefined' && window.navigator.onLine
            ? 'Server temporarily unavailable. Queued in IndexedDB.'
            : 'Saved in offline mode. Queued in IndexedDB for auto-sync.'
        );
        const count = await getPendingQueueCount();
        setPendingSyncCount(count);
      } catch (err) {
        console.warn('Could not queue in IndexedDB:', err);
      }
    } else {
      const count = await getPendingQueueCount();
      setPendingSyncCount(count);
    }

    await refreshSavedFormsList();
    setActionBannerMsg(
      !serverSaved
        ? `Form ${recordState.recordNumber} safely stored in offline local storage & IndexedDB queue! It will automatically synchronize to the server as soon as you reconnect.`
        : `Form ${recordState.recordNumber} saved! You can reopen and edit it anytime from the "Save" menu.`
    );
    return formId;
  }, [effectiveAnswers, recordState, uploadedFiles, refreshSavedFormsList]);

  const handleReopenSavedForm = async (formId: string) => {
    try {
      const res = await fetch(`/api/forms/${encodeURIComponent(formId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.form) {
          if (data.form.recordState?.recordNumber) setRecordState(data.form.recordState);
          if (data.form.answers) setAnswers(synchronizeMappedAnswers(data.form.answers));
          if (data.form.uploadedFiles) setUploadedFiles(data.form.uploadedFiles);
          setActionBannerMsg(
            `Reopened saved form ${data.form.recordNumber} for editing.`
          );
          return;
        }
      }
    } catch {
      // fallback to local
    }

    const localMap = getLocalSavedFormsMap();
    const found = localMap[formId];
    if (found) {
      setRecordState(found.recordState);
      setAnswers(synchronizeMappedAnswers(found.answers));
      setUploadedFiles(found.uploadedFiles || {});
      setActionBannerMsg(`Reopened saved form ${found.recordNumber} for editing.`);
    }
  };

  const handleDeleteSavedForm = async (formId: string) => {
    const localMap = getLocalSavedFormsMap();
    if (localMap[formId]) {
      delete localMap[formId];
      saveLocalSavedFormsMap(localMap);
    }
    try {
      await fetch(`/api/forms/${encodeURIComponent(formId)}`, { method: 'DELETE' });
    } catch {
      // ignore
    }
    await refreshSavedFormsList();
  };

  const handleExportJsonFile = () => {
    const payload = {
      version: 2,
      savedAt: new Date().toISOString(),
      recordState,
      answers: filterFilledAnswers(effectiveAnswers),
      uploadedFiles: filterFilledUploads(uploadedFiles),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NVEA_Form_${recordState.recordNumber}.nvea.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportJsonFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        if (parsed.recordState?.recordNumber) {
          setRecordState(parsed.recordState);
        }
        if (parsed.answers) {
          setAnswers(synchronizeMappedAnswers(parsed.answers));
        }
        if (parsed.uploadedFiles) {
          setUploadedFiles(parsed.uploadedFiles);
        }
        setActionBannerMsg(
          `Imported and reopened saved form ${
            parsed.recordState?.recordNumber || file.name
          } for editing.`
        );
      } catch {
        setActionBannerMsg('Invalid saved form file.');
      }
    };
    reader.readAsText(file);
  };

  const { formattedDate } = getTodayDateKey();

  // Download as PDF Function (Requirement 1 & 2)
  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      await handleSaveCurrentForm();
      await downloadAdmissionFormPdf({
        recordNumber: recordState.recordNumber,
        formattedDate,
        submitted: recordState.submitted,
        submissionDateIso:
          (typeof effectiveAnswers.submissionDate === 'string' &&
            effectiveAnswers.submissionDate) ||
          recordState.submittedAt,
        answers: effectiveAnswers,
        uploadedFiles,
        nveaCircularLogoPng: assets.nveaCircularLogoPng,
        bankQrCardPng: assets.bankQrCardPng,
      });
      setActionBannerMsg(
        `Downloaded NVEA_Admission_Form_${recordState.recordNumber}.pdf in strict sequential order (Questions 1–175).`
      );
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Share via WhatsApp (Direct PDF Attachment or Automatic Shareable Form Link Fallback)
  const handleSharePdfOrLinkWhatsApp = async () => {
    setIsGeneratingPdf(true);
    try {
      await handleSaveCurrentForm();
      const { file } = await generateAdmissionFormPdf({
        recordNumber: recordState.recordNumber,
        formattedDate,
        submitted: recordState.submitted,
        submissionDateIso:
          (typeof effectiveAnswers.submissionDate === 'string' &&
            effectiveAnswers.submissionDate) ||
          recordState.submittedAt,
        answers: effectiveAnswers,
        uploadedFiles,
        nveaCircularLogoPng: assets.nveaCircularLogoPng,
        bankQrCardPng: assets.bankQrCardPng,
      });

      const shareableUrl = `${window.location.origin}/?formId=${encodeURIComponent(
        recordState.recordNumber
      )}`;
      const applicantName =
        typeof effectiveAnswers.q2 === 'string' && effectiveAnswers.q2.trim()
          ? effectiveAnswers.q2.trim()
          : 'Applicant';
      const summaryText = `NVEA Official Admission Form\nRecord No: ${recordState.recordNumber}\nApplicant: ${applicantName}${
        effectiveAnswers.q107 ? `\nFinal Payable Fee: ${effectiveAnswers.q107}` : ''
      }\nOpen / View Saved Form Link: ${shareableUrl}`;

      // Try direct PDF file attachment sharing via Web Share API (Mobile / Supported Browsers)
      if (
        typeof navigator !== 'undefined' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] })
      ) {
        try {
          await navigator.share({
            files: [file],
            title: `NVEA Admission Form — ${recordState.recordNumber}`,
            text: summaryText,
          });
          return;
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') {
            return;
          }
          // Fall through to direct WhatsApp link sharing
        }
      }

      // Automatic Fallback: Direct WhatsApp share with live shareable form link
      const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(summaryText)}`;
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const finalizeFormSubmission = async (capturedIso?: string) => {
    const exactIsoTimestamp =
      capturedIso ||
      (typeof answers.submissionDate === 'string' && answers.submissionDate
        ? answers.submissionDate
        : new Date().toISOString());
    setShowSubmitWarning(false);

    // Provide subtle, positive audio feedback upon successful submission
    playSuccessChime();

    const nextAnswers: FormAnswers = {
      ...answers,
      submissionDate: exactIsoTimestamp,
      q172: answers.q172 || 'Enrolment is done successfully',
    };
    setAnswers(nextAnswers);

    const updatedRecord = markRecordSubmitted(recordState, exactIsoTimestamp);
    setRecordState(updatedRecord);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Save to server/localStorage
    await handleSaveCurrentForm();
    setActionBannerMsg('');
  };

  const handleSubmitForm = () => {
    const exactIsoTimestamp = new Date().toISOString();
    setAnswers((prev) => ({
      ...prev,
      submissionDate: exactIsoTimestamp,
    }));
    setHighlightIncomplete(true);
    if (incompleteRequiredQuestions.length > 0) {
      setShowSubmitWarning(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    finalizeFormSubmission(exactIsoTimestamp);
  };

  const handleStartNewApplication = () => {
    const nextRec = generateNextApplicationRecord();
    setRecordState(nextRec);
    setAnswers(synchronizeMappedAnswers({}, true));
    setUploadedFiles({});
    setTouchedFields({});
    setShowSubmitWarning(false);
    setActivePortalId(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleClearCurrentFields = () => {
    setAnswers(synchronizeMappedAnswers({}, true));
    setUploadedFiles({});
    setTouchedFields({});
  };

  const handlePrintFullForm = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 150);
  };

  const handleDownloadStandaloneHtml = () => {
    const prevMode = viewMode;
    setViewMode('all_compact');
    setTimeout(async () => {
      await downloadStandaloneHtmlSnapshot(recordState.recordNumber);
      setViewMode(prevMode);
    }, 120);
  };

  const handleUpdateCustomAsset = (key: keyof OfficialAssets, dataUrl: string) => {
    setAssets((prev) => {
      const updated = { ...prev, [key]: dataUrl };
      const custom = getStoredCustomAssets();
      saveStoredCustomAssets({ ...custom, [key]: dataUrl });
      return updated;
    });
  };

  const handleResetDefaultAssets = async () => {
    saveStoredCustomAssets({});
    const defaultCircular = generateNveaCircularLogoPng();
    const defaultQr = await generateUnionBankQrCardPng();
    setAssets({
      nveaCircularLogoPng: defaultCircular,
      bankQrCardPng: defaultQr,
    });
  };

  const handleJumpToQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(jumpQuery.trim(), 10);
    if (!isNaN(num) && num >= 1 && num <= 175) {
      jumpToQuestionByNumber(num);
    }
  };

  // Count completed questions across all 175 questions
  const completedCount = useMemo(() => {
    let count = 0;
    QUESTIONS.forEach((q) => {
      if (checkQuestionComplete(q, effectiveAnswers, uploadedFiles)) {
        count++;
      }
    });
    return count;
  }, [effectiveAnswers, uploadedFiles]);

  // Live Form Completion Progress Indicator state (Update 4)
  const liveFormProgress = useMemo(
    () => computeLiveFormProgress(effectiveAnswers, uploadedFiles),
    [effectiveAnswers, uploadedFiles]
  );

  const portalsToRender =
    viewMode === 'all_compact' || isPrinting
      ? PORTALS
      : PORTALS.filter((p) => p.id === activePortalId);

  const searchParams =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const verifyRecordParam = searchParams?.get('verify')?.trim() || '';
  const encodedVerifyDataParam = searchParams?.get('d') || null;

  if (verifyRecordParam) {
    return (
      <VerificationCertificatePage
        verifyRecordParam={verifyRecordParam}
        encodedDataParam={encodedVerifyDataParam}
        nveaLogoPng={assets.nveaCircularLogoPng}
      />
    );
  }

  return (
    <div className="min-h-screen gov-bg-pattern flex flex-col">
      {/* Global Print Watermark (Single Official NVEA Circular Logo fixed in center of every printed A4 page) */}
      {assets.nveaCircularLogoPng && (
        <div
          aria-hidden="true"
          className="hidden print-only fixed-print-watermark pointer-events-none select-none"
        >
          <img
            src={assets.nveaCircularLogoPng}
            alt=""
            referrerPolicy="no-referrer"
            className="w-72 h-72 object-contain"
          />
        </div>
      )}

      {/* Top Bar Contract (3 Zones: Brand Title | Nav Links | Save, Download as PDF & Share Actions) */}
      <header className="bg-[#0F2942] text-white border-b-2 border-[#D97706] px-3 sm:px-4 lg:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 no-print sticky top-0 z-40 shadow-sm">
        {/* Zone 1: Single text element wordmark + Persistent Online/Offline Status Indicator */}
        <div className="flex items-center gap-2.5 shrink-0">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              handleSelectPortal(1);
            }}
            className="text-sm lg:text-base font-bold tracking-tight text-white whitespace-nowrap"
          >
            NVEA Admission Portal
          </a>
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold rounded-full select-none ${
              isOnline
                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40'
                : 'bg-rose-950/80 text-rose-300 border border-rose-500/40'
            }`}
            title={isOnline ? 'Online - Internet connected' : 'Offline - Operating in local mode'}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
              }`}
            />
            <span>{isOnline ? 'Online' : 'Offline'}</span>
            {pendingSyncCount > 0 && (
              <span
                className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500/30 text-amber-300 border border-amber-400/50"
                title={`${pendingSyncCount} offline submission(s) queued in IndexedDB for auto-sync`}
              >
                {pendingSyncCount} Queued
              </span>
            )}
          </span>
        </div>

        {/* Zone 2: 5 clean text navigation links */}
        <nav className="hidden xl:flex items-center gap-5 text-xs font-medium text-slate-200">
          <button
            type="button"
            onClick={() => {
              setViewMode('single');
              handleSelectPortal(1);
            }}
            className={`hover:text-white transition-colors cursor-pointer whitespace-nowrap ${
              viewMode === 'single' ? 'text-amber-300 underline underline-offset-4' : ''
            }`}
          >
            10-Portal Step Mode
          </button>
          <button
            type="button"
            onClick={() => setViewMode('all_compact')}
            className={`hover:text-white transition-colors cursor-pointer whitespace-nowrap ${
              viewMode === 'all_compact' ? 'text-amber-300 underline underline-offset-4' : ''
            }`}
          >
            Full Compact View (All 175 Qs)
          </button>
          <button
            type="button"
            onClick={() => handleSelectPortal(6)}
            className="hover:text-white transition-colors cursor-pointer whitespace-nowrap"
          >
            Document Portal (Q.79–92)
          </button>
          <button
            type="button"
            onClick={() => handleSelectPortal(9)}
            className="hover:text-white transition-colors cursor-pointer whitespace-nowrap"
          >
            Payment &amp; Bank QR (Q.111–120)
          </button>
          <button
            type="button"
            onClick={() => handleSelectPortal(10)}
            className="hover:text-white transition-colors cursor-pointer whitespace-nowrap"
          >
            Oath &amp; OTP Verification (Q.121–175)
          </button>
        </nav>

        {/* Zone 3: Mandatory Functional Action Buttons: Save, Download as PDF, Share & Print */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0">
          <PWAInstallButton />

          {/* 30-Second Draft Auto-Save Status Indicator */}
          <div
            className="hidden md:inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium text-slate-300 bg-slate-800/80 border border-slate-700/60 rounded-xs select-none"
            title="Draft Auto-Save: Form state is automatically saved to local storage every 30 seconds"
          >
            {isAutoSavingDraft ? (
              <RefreshCw className="w-3 h-3 text-amber-400 animate-spin shrink-0" />
            ) : (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
            )}
            <span className="whitespace-nowrap">
              {isAutoSavingDraft
                ? 'Auto-saving...'
                : lastAutoSaveTime
                ? `Saved ${lastAutoSaveTime}`
                : 'Auto-save (30s)'}
            </span>
          </div>

          <button
            type="button"
            onClick={async () => {
              await handleSaveCurrentForm();
              setSaveShareModalMode('save');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-600 rounded-sm transition-colors cursor-pointer whitespace-nowrap"
            title="Save form data to reopen and edit later"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save</span>
          </button>

          <button
            type="button"
            disabled={isGeneratingPdf}
            onClick={handleDownloadPdf}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#0F2942] bg-[#F59E0B] hover:bg-[#FBBF24] disabled:opacity-60 rounded-sm transition-colors cursor-pointer whitespace-nowrap"
            title="Generate and download properly formatted sequential PDF"
          >
            {isGeneratingPdf ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FileDown className="w-3.5 h-3.5" />
            )}
            <span>Download as PDF</span>
          </button>

          <button
            type="button"
            onClick={() => setSaveShareModalMode('share')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#1E3A8A] hover:bg-[#1D4ED8] border border-blue-400/30 rounded-sm transition-colors cursor-pointer whitespace-nowrap"
            title="Share form via WhatsApp (PDF or Shareable Link) & other platforms"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share</span>
          </button>

          <button
            type="button"
            onClick={handlePrintFullForm}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-100 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-sm transition-colors cursor-pointer whitespace-nowrap"
            title="Print complete sequential form"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Print</span>
          </button>
        </div>
      </header>

      {/* Main Institutional Sheet Container */}
      <main className="flex-1 w-full max-w-[1360px] mx-auto px-2 sm:px-4 lg:px-6 py-4">
        <div
          id="nvea-printable-sheet"
          className="gov-sheet bg-white border-2 border-[#0F2942] rounded-sm p-3 sm:p-4 lg:p-5 shadow-sm"
        >
          {/* Hidden 'Submission Date' field capturing the exact ISO timestamp when 'Submit' is clicked */}
          <input
            type="hidden"
            id="submission-date-field"
            name="Submission Date"
            value={
              (typeof effectiveAnswers.submissionDate === 'string' &&
                effectiveAnswers.submissionDate) ||
              recordState.submittedAt ||
              ''
            }
            readOnly
          />

          {/* Action Feedback Notification Toast */}
          {actionBannerMsg && (
            <div className="mb-3 bg-emerald-50 border border-emerald-400 rounded-sm px-3 py-2 flex items-center justify-between gap-2 text-xs text-emerald-950 no-print">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span className="font-medium">{actionBannerMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setActionBannerMsg('')}
                className="text-emerald-800 hover:underline font-semibold cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* =====================================================================
              OFFICIAL INDIAN GOVERNMENT INSTITUTE-STYLE HEADER BANNER
              Incorporates ONLY the Single Official NVEA Circular Logo (Left),
              Institutional Identity (Center), and Automatic Record Number Box (Right)
             ===================================================================== */}
          <div className="border-b-2 border-[#0F2942] pb-3 mb-3">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
              {/* Left: Single Official Circular NVEA Emblem */}
              <div className="lg:col-span-2 flex items-center justify-center lg:justify-start gap-3">
                {assets.nveaCircularLogoPng && (
                  <img
                    src={assets.nveaCircularLogoPng}
                    alt="NVEA Official Circular Logo"
                    referrerPolicy="no-referrer"
                    className="w-20 h-20 sm:w-24 sm:h-24 object-contain shrink-0"
                  />
                )}
              </div>

              {/* Center: Official Institutional Heading */}
              <div className="lg:col-span-6 text-center space-y-0.5">
                <p className="text-[11px] font-bold tracking-widest uppercase text-[#991B1B]">
                  ONLINE ADMISSION &amp; ENROLMENT FORM PORTAL • SINCE 2006
                </p>
                <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-[#0F2942] tracking-tight">
                  NAND VIDHYA EDUCATION ACADEMY (NVEA)
                </h1>
                <p className="text-xs sm:text-sm font-bold text-[#1E3A8A] font-hindi">
                  नव्या — नन्द विद्या शिक्षण संस्थान (स्वतंत्र, वैधानिक रूप से शैक्षिक संस्थान)
                </p>
                <p className="text-[11px] text-slate-700 font-hindi leading-snug">
                  Creative Learning Activity Program (CLAP) • Official Website:{' '}
                  <span className="font-semibold underline">https://www.nvea.in/</span> · Helpline:{' '}
                  <span className="font-mono-num font-bold">09414008310</span>
                </p>
              </div>

              {/* Right: Automatic Record Number Box (Requirement 13) */}
              <div className="lg:col-span-4 flex items-center justify-end">
                <div className="w-full bg-[#F8FAFC] border-2 border-[#0F2942] rounded-sm p-2.5 text-left">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-300 pb-1 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#0F2942]">
                      {recordState.submitted
                        ? 'Final Submission / Reference No.'
                        : 'Automatic Record Number'}
                    </span>
                    <span className="text-[10px] font-mono-num text-slate-600">
                      Date: {formattedDate}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      id="official-record-number"
                      className="text-base sm:text-lg font-mono-num font-bold tracking-wider text-[#991B1B]"
                    >
                      {recordState.recordNumber}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-700">
                      {recordState.submitted
                        ? 'Submitted'
                        : `Seq #${String(recordState.sequence).padStart(3, '0')}`}
                    </span>
                  </div>
                  {((typeof effectiveAnswers.submissionDate === 'string' &&
                    effectiveAnswers.submissionDate) ||
                    recordState.submittedAt) && (
                    <div className="mt-1 pt-1 border-t border-slate-200 text-[10px] font-mono-num text-slate-700">
                      <span className="font-bold text-[#0F2942]">Submission Date (ISO): </span>
                      <span>
                        {(typeof effectiveAnswers.submissionDate === 'string' &&
                          effectiveAnswers.submissionDate) ||
                          recordState.submittedAt}
                      </span>
                    </div>
                  )}
                  <div className="mt-1.5 pt-1 border-t border-slate-200 flex flex-wrap items-center justify-between gap-1.5 no-print">
                    <button
                      type="button"
                      onClick={handleStartNewApplication}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[10.5px] font-semibold text-[#0F2942] bg-white hover:bg-slate-100 border border-slate-300 rounded-xs cursor-pointer whitespace-nowrap"
                      title="Generate next sequential application number for today"
                    >
                      <FilePlus2 className="w-3 h-3" />
                      <span>New App (+Seq)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSaveShareModalMode('save')}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xs cursor-pointer whitespace-nowrap"
                      title="View or reopen saved forms"
                    >
                      <Save className="w-3 h-3" />
                      <span>Saved Forms ({savedFormsList.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAssetModalOpen(true)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[10.5px] font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xs cursor-pointer whitespace-nowrap"
                      title="Configure Official Logo & Bank QR Code"
                    >
                      <Settings className="w-3 h-3" />
                      <span>Logo/QR</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* =====================================================================
              SUBMISSION CONFIRMATION BANNER (Requirement 13)
             ===================================================================== */}
          {recordState.submitted && (
            <div className="mb-3 bg-emerald-50 border-2 border-emerald-700 rounded-sm p-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-emerald-950">
                    Application Successfully Submitted — Final Reference Number:{' '}
                    <span className="font-mono-num text-[#991B1B] underline">
                      {recordState.recordNumber}
                    </span>
                  </h3>
                  <p className="text-xs text-emerald-900 font-hindi mt-0.5">
                    आपका ऑनलाइन नामांकन आवेदन सफलतापूर्वक दर्ज हो चुका है। आपकी अंतिम संदर्भ/रिकॉर्ड
                    संख्या <strong className="font-mono-num">{recordState.recordNumber}</strong>{' '}
                    सुरक्षित रखी गई है। (Enrolment Status: Enrolment is done successfully)
                  </p>
                  {((typeof effectiveAnswers.submissionDate === 'string' &&
                    effectiveAnswers.submissionDate) ||
                    recordState.submittedAt) && (
                    <p className="text-[11px] font-mono-num font-semibold text-emerald-950 mt-1">
                      Submission Date (ISO Timestamp):{' '}
                      {(typeof effectiveAnswers.submissionDate === 'string' &&
                        effectiveAnswers.submissionDate) ||
                        recordState.submittedAt}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 no-print">
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#0F2942] bg-[#F59E0B] hover:bg-[#FBBF24] rounded-sm cursor-pointer whitespace-nowrap"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>Download as PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSaveShareModalMode('share')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-700 rounded-sm cursor-pointer whitespace-nowrap"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share on WhatsApp</span>
                </button>
                <button
                  type="button"
                  onClick={handleStartNewApplication}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-900 bg-white hover:bg-emerald-100 border border-emerald-400 rounded-sm cursor-pointer whitespace-nowrap"
                >
                  <FilePlus2 className="w-3.5 h-3.5" />
                  <span>Start Next Application</span>
                </button>
              </div>
            </div>
          )}

          {/* =====================================================================
              INCOMPLETE REQUIRED FIELDS ALERT BANNER (Shown on Submit Attempt)
             ===================================================================== */}
          {showSubmitWarning && incompleteRequiredQuestions.length > 0 && (
            <div className="mb-3 bg-red-50 border-2 border-red-600 rounded-sm p-3 no-print">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-red-950">
                      {incompleteRequiredQuestions.length} Required Question
                      {incompleteRequiredQuestions.length > 1 ? 's Are' : ' Is'} Still Incomplete
                    </h3>
                    <p className="text-xs text-red-900 mt-0.5">
                      Please review the highlighted incomplete fields below or click any question
                      number to jump directly to it before final submission.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleJumpToNextIncomplete}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-red-700 hover:bg-red-800 rounded-sm cursor-pointer whitespace-nowrap"
                  >
                    <ArrowRightCircle className="w-3.5 h-3.5" />
                    <span>
                      Jump to First Incomplete Mandatory Field (Q.{incompleteRequiredQuestions[0].number})
                    </span>
                  </button>
                </div>
              </div>

              <div className="mt-2 pt-2 border-t border-red-200 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold text-red-900 mr-1">
                  Incomplete Required Q#:
                </span>
                {incompleteRequiredQuestions.slice(0, 18).map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => jumpToQuestionByNumber(q.number)}
                    className="px-2 py-0.5 text-[11px] font-mono-num font-semibold text-red-800 bg-white hover:bg-red-100 border border-red-300 rounded-xs cursor-pointer"
                    title={q.label}
                  >
                    Q.{q.number}
                  </button>
                ))}
                {incompleteRequiredQuestions.length > 18 && (
                  <span className="text-[11px] text-red-800 font-medium">
                    +{incompleteRequiredQuestions.length - 18} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* =====================================================================
              GLOBAL FORM SEARCH INTERFACE (Requirement 4 — Top/Front Area)
             ===================================================================== */}
          <GlobalSearchBar
            answers={effectiveAnswers}
            uploadedFiles={uploadedFiles}
            onJumpToResult={handleGlobalSearchJump}
          />

          {/* =====================================================================
              LIVE FORM COMPLETION PROGRESS INDICATOR (Update 4)
             ===================================================================== */}
          <LiveFormProgressBar progress={liveFormProgress} />

          {/* =====================================================================
              10-PORTAL NAVIGATION DIRECTORY & OPERATIONAL UTILITY BAR (Requirement 12)
             ===================================================================== */}
          <div className="bg-[#F1F5F9] border border-slate-300 rounded-sm p-2.5 mb-3 no-print">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-300">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-700">
                <span className="font-bold text-[#0F2942]">
                  10-Portal Direct Navigation Menu:
                </span>
                <span className="font-mono-num font-semibold text-[#1E3A8A]">
                  Filled: {completedCount} / 175
                </span>
                <span aria-hidden="true">·</span>
                {incompleteRequiredQuestions.length > 0 ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-red-700">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{incompleteRequiredQuestions.length} Required Incomplete</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>All Required Complete</span>
                  </span>
                )}
              </div>

              {/* Validation Controls, View Mode Switcher & Quick Question Finder */}
              <div className="flex flex-wrap items-center gap-2">
                {incompleteRequiredQuestions.length > 0 && (
                  <button
                    type="button"
                    onClick={handleJumpToNextIncomplete}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-[#991B1B] hover:bg-red-800 rounded-sm cursor-pointer whitespace-nowrap"
                    title="Jump directly to the next incomplete required question"
                  >
                    <ArrowRightCircle className="w-3.5 h-3.5" />
                    <span>Next Incomplete (Q.{incompleteRequiredQuestions[0].number})</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setHighlightIncomplete((prev) => !prev)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold border rounded-sm cursor-pointer whitespace-nowrap transition-colors ${
                    highlightIncomplete
                      ? 'bg-red-50 text-red-800 border-red-300 hover:bg-red-100'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                  title="Toggle visual validation highlighting on incomplete required fields"
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Highlight Incomplete: {highlightIncomplete ? 'ON' : 'OFF'}</span>
                </button>

                <form onSubmit={handleJumpToQuestion} className="flex items-center">
                  <input
                    type="number"
                    min={1}
                    max={175}
                    value={jumpQuery}
                    onChange={(e) => setJumpQuery(e.target.value)}
                    placeholder="Jump to Q# (1-175)"
                    className="h-7 w-36 px-2 text-xs bg-white border border-slate-300 rounded-l-sm focus:outline-none focus:border-[#1E3A8A]"
                  />
                  <button
                    type="submit"
                    className="h-7 px-2 bg-[#0F2942] hover:bg-[#1E3A8A] text-white text-xs font-semibold rounded-r-sm cursor-pointer flex items-center gap-1"
                  >
                    <Search className="w-3 h-3" />
                    <span>Go</span>
                  </button>
                </form>

                <div className="flex items-center bg-white border border-slate-300 rounded-sm p-0.5">
                  <button
                    type="button"
                    onClick={() => setViewMode('single')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-xs cursor-pointer transition-colors whitespace-nowrap ${
                      viewMode === 'single'
                        ? 'bg-[#0F2942] text-white'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Step-by-Step (10 Portals)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('all_compact')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-xs cursor-pointer transition-colors whitespace-nowrap ${
                      viewMode === 'all_compact'
                        ? 'bg-[#0F2942] text-white'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>All 10 Portals Compact View</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleClearCurrentFields}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 hover:text-red-700 bg-white border border-slate-300 rounded-sm cursor-pointer whitespace-nowrap"
                  title="Clear current form fields"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Fields</span>
                </button>
              </div>
            </div>

            {/* 10 Portal Buttons Grid with Live Validation Status per Portal */}
            <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-1.5">
              {PORTALS.map((p) => {
                const isActive = activePortalId === p.id && viewMode === 'single';
                const pIncompleteCount = incompleteRequiredQuestions.filter(
                  (q) => q.portalId === p.id
                ).length;

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectPortal(p.id)}
                    className={`px-2 py-1.5 text-left rounded-sm border transition-colors cursor-pointer flex flex-col justify-between ${
                      isActive
                        ? 'bg-[#0F2942] text-white border-[#0F2942] shadow-xs'
                        : pIncompleteCount === 0
                        ? 'bg-emerald-50/60 text-slate-800 border-emerald-400 hover:bg-emerald-50'
                        : 'bg-white text-slate-800 border-slate-300 hover:border-[#1E3A8A] hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`text-[10px] font-mono-num font-bold ${
                          isActive ? 'text-amber-300' : 'text-[#1E3A8A]'
                        }`}
                      >
                        Portal {p.id}
                      </span>
                      <span
                        className={`text-[9.5px] font-mono-num font-semibold ${
                          isActive
                            ? pIncompleteCount === 0
                              ? 'text-emerald-300'
                              : 'text-amber-200'
                            : pIncompleteCount === 0
                            ? 'text-emerald-700'
                            : 'text-red-700'
                        }`}
                      >
                        {pIncompleteCount === 0 ? '✓ Done' : `${pIncompleteCount} Left`}
                      </span>
                    </div>
                    <span className="text-xs font-bold truncate mt-0.5">
                      {p.id}. {p.shortName}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* =====================================================================
              RENDER PORTALS (1 to 10) WITH EXACT QUESTIONS (1 to 172)
             ===================================================================== */}
          <div>
            {portalsToRender.map((portal) => {
              const portalQuestions = QUESTIONS.filter((q) => q.portalId === portal.id);
              return (
                <PortalRenderer
                  key={portal.id}
                  portal={portal}
                  questions={portalQuestions}
                  answers={effectiveAnswers}
                  uploadedFiles={uploadedFiles}
                  onAnswerChange={handleAnswerChange}
                  onFileChange={handleFileChange}
                  nveaWatermarkPng={assets.nveaCircularLogoPng}
                  bankQrCardPng={assets.bankQrCardPng}
                  recordNumber={recordState.recordNumber}
                  priorIncompleteCountForQ171={priorIncompleteCountForQ171}
                  onJumpToIncomplete={handleJumpToNextIncomplete}
                  isFirstPortal={portal.id === 1}
                  isLastPortal={portal.id === 10}
                  showBottomNav={viewMode === 'single' && !isPrinting}
                  highlightIncomplete={highlightIncomplete}
                  touchedFields={touchedFields}
                  onFieldBlur={handleFieldBlur}
                  onPrevPortal={() => {
                    if (portal.id > 1) handleSelectPortal(portal.id - 1);
                  }}
                  onNextPortal={() => {
                    if (portal.id < 10) handleSelectPortal(portal.id + 1);
                  }}
                  onSubmitForm={handleSubmitForm}
                />
              );
            })}
          </div>

          {/* Persistent Save, Download as PDF, Share & Submit Bar */}
          {!isPrinting && (
            <div className="mt-4 bg-[#0F2942] text-white p-3.5 rounded-sm flex flex-wrap items-center justify-between gap-3 no-print">
              <div>
                <p className="text-xs sm:text-sm font-bold">
                  NVEA Official Admission Form (Portals 1–10 • Questions 1–175)
                </p>
                <p className="text-[11px] text-slate-300 font-mono-num">
                  Record Number: {recordState.recordNumber} • Filled: {completedCount}/175
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await handleSaveCurrentForm();
                    setSaveShareModalMode('save');
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-600 rounded-sm cursor-pointer whitespace-nowrap"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save</span>
                </button>

                <button
                  type="button"
                  disabled={isGeneratingPdf}
                  onClick={handleDownloadPdf}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[#0F2942] bg-[#F59E0B] hover:bg-[#FBBF24] disabled:opacity-60 rounded-sm cursor-pointer whitespace-nowrap"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>Download as PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSaveShareModalMode('share')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#1E3A8A] hover:bg-[#1D4ED8] border border-blue-400/30 rounded-sm cursor-pointer whitespace-nowrap"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share (WhatsApp)</span>
                </button>

                {viewMode === 'all_compact' && (
                  <button
                    type="button"
                    onClick={handleSubmitForm}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-700 border border-emerald-400/40 rounded-sm cursor-pointer whitespace-nowrap"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Submit Complete Form</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Official Institutional Footer inside Printable Sheet */}
          <footer className="mt-3 pt-2 border-t border-slate-300 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
            <div>
              <span className="font-bold text-[#0F2942]">
                NAND VIDHYA EDUCATION ACADEMY (NVEA / नव्या)
              </span>
              <span aria-hidden="true"> · </span>
              <span>Official Portal: https://www.nvea.in/</span>
              <span aria-hidden="true"> · </span>
              <span>Helpline: 09414008310</span>
            </div>
            <div className="flex flex-wrap items-center gap-3 font-mono-num font-semibold text-[#0F2942]">
              {((typeof effectiveAnswers.submissionDate === 'string' &&
                effectiveAnswers.submissionDate) ||
                recordState.submittedAt) && (
                <span>
                  Submission Date:{' '}
                  {(typeof effectiveAnswers.submissionDate === 'string' &&
                    effectiveAnswers.submissionDate) ||
                    recordState.submittedAt}
                </span>
              )}
              <span>Record Ref: {recordState.recordNumber}</span>
            </div>
          </footer>
        </div>
      </main>

      {/* Modal for Save / Reopen Saved Forms & Share (WhatsApp PDF / Shareable Link) */}
      <SaveShareModal
        mode={saveShareModalMode}
        onClose={() => setSaveShareModalMode(null)}
        recordNumber={recordState.recordNumber}
        applicantName={
          typeof effectiveAnswers.q2 === 'string' && effectiveAnswers.q2.trim()
            ? effectiveAnswers.q2.trim()
            : 'Applicant'
        }
        finalPayableFee={
          typeof effectiveAnswers.q107 === 'string' ? effectiveAnswers.q107 : ''
        }
        savedForms={savedFormsList}
        onSaveCurrentForm={handleSaveCurrentForm}
        onReopenSavedForm={handleReopenSavedForm}
        onDeleteSavedForm={handleDeleteSavedForm}
        onExportJsonFile={handleExportJsonFile}
        onImportJsonFile={handleImportJsonFile}
        onDownloadStandaloneHtml={handleDownloadStandaloneHtml}
        onDownloadPdf={handleDownloadPdf}
        onSharePdfOrLinkWhatsApp={handleSharePdfOrLinkWhatsApp}
        isGeneratingPdf={isGeneratingPdf}
      />

      {/* Modal for Customizing / Uploading Single Official NVEA Logo & Bank QR */}
      <AssetManagerModal
        isOpen={isAssetModalOpen}
        onClose={() => setIsAssetModalOpen(false)}
        assets={assets}
        onUpdateAsset={handleUpdateCustomAsset}
        onResetDefaults={handleResetDefaultAssets}
      />

      {/* Subtle, non-blocking toast for Offline mode and Reconnection confirmation */}
      <NetworkStatusToast
        isOnline={isOnline}
        pendingSyncCount={pendingSyncCount}
        onTriggerSync={triggerBackgroundSync}
        lastSyncSummary={lastSyncSummary}
      />
    </div>
  );
}
