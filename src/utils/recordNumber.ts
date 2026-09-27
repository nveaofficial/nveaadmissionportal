/**
 * Automatic Record Number Generation Utility (Requirement 13)
 * Format: NVEA + YY + MM + DD + Sequential Number (e.g., NVEA260911001)
 */

const ACTIVE_RECORD_KEY = 'nvea_active_record_v1';
const SUBMITTED_RECORDS_KEY = 'nvea_submitted_records_v1';

export interface ActiveRecordState {
  recordNumber: string;
  dateKey: string; // YYMMDD
  sequence: number;
  createdAt: string;
  submitted: boolean;
  submittedAt?: string;
}

export function getTodayDateKey(date: Date = new Date()): {
  yy: string;
  mm: string;
  dd: string;
  dateKey: string;
  formattedDate: string;
} {
  const year = date.getFullYear();
  const yy = String(year).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const dateKey = `${yy}${mm}${dd}`;
  const formattedDate = `${dd}/${mm}/${year}`;
  return { yy, mm, dd, dateKey, formattedDate };
}

export function formatRecordNumber(dateKey: string, seq: number): string {
  const seqStr = String(seq).padStart(3, '0');
  return `NVEA${dateKey}${seqStr}`;
}

export function getOrInitActiveRecord(): ActiveRecordState {
  const { dateKey } = getTodayDateKey();
  const dailyCounterKey = `nvea_seq_${dateKey}`;

  try {
    const existingRaw = localStorage.getItem(ACTIVE_RECORD_KEY);
    if (existingRaw) {
      const parsed: ActiveRecordState = JSON.parse(existingRaw);
      // If the active unsubmitted record belongs to today's date, retain it throughout the session
      if (parsed && parsed.dateKey === dateKey && parsed.recordNumber) {
        return parsed;
      }
    }

    // Otherwise generate a new record number for today
    const currentSeqStr = localStorage.getItem(dailyCounterKey);
    const nextSeq = currentSeqStr ? parseInt(currentSeqStr, 10) + 1 : 1;
    localStorage.setItem(dailyCounterKey, String(nextSeq));

    const newState: ActiveRecordState = {
      recordNumber: formatRecordNumber(dateKey, nextSeq),
      dateKey,
      sequence: nextSeq,
      createdAt: new Date().toISOString(),
      submitted: false,
    };

    localStorage.setItem(ACTIVE_RECORD_KEY, JSON.stringify(newState));
    return newState;
  } catch {
    return {
      recordNumber: formatRecordNumber(dateKey, 1),
      dateKey,
      sequence: 1,
      createdAt: new Date().toISOString(),
      submitted: false,
    };
  }
}

export function generateNextApplicationRecord(): ActiveRecordState {
  const { dateKey } = getTodayDateKey();
  const dailyCounterKey = `nvea_seq_${dateKey}`;

  try {
    const currentSeqStr = localStorage.getItem(dailyCounterKey);
    const nextSeq = currentSeqStr ? parseInt(currentSeqStr, 10) + 1 : 1;
    localStorage.setItem(dailyCounterKey, String(nextSeq));

    const newState: ActiveRecordState = {
      recordNumber: formatRecordNumber(dateKey, nextSeq),
      dateKey,
      sequence: nextSeq,
      createdAt: new Date().toISOString(),
      submitted: false,
    };

    localStorage.setItem(ACTIVE_RECORD_KEY, JSON.stringify(newState));
    return newState;
  } catch {
    return {
      recordNumber: formatRecordNumber(dateKey, 1),
      dateKey,
      sequence: 1,
      createdAt: new Date().toISOString(),
      submitted: false,
    };
  }
}

export function markRecordSubmitted(
  record: ActiveRecordState,
  isoTimestamp?: string
): ActiveRecordState {
  const updated: ActiveRecordState = {
    ...record,
    submitted: true,
    submittedAt: isoTimestamp || new Date().toISOString(),
  };
  try {
    localStorage.setItem(ACTIVE_RECORD_KEY, JSON.stringify(updated));
    const historyRaw = localStorage.getItem(SUBMITTED_RECORDS_KEY);
    const history: ActiveRecordState[] = historyRaw ? JSON.parse(historyRaw) : [];
    if (!history.some((r) => r.recordNumber === updated.recordNumber)) {
      history.unshift(updated);
      localStorage.setItem(SUBMITTED_RECORDS_KEY, JSON.stringify(history.slice(0, 50)));
    }
  } catch {
    // Ignore storage errors
  }
  return updated;
}
