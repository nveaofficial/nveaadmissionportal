/**
 * IndexedDB Background Sync Queue for NVEA Online Admission Portal
 * Stores offline form submissions safely in IndexedDB and automatically
 * retries synchronization when network connectivity is restored.
 */

export interface QueuedSubmissionEntry {
  formId: string;
  recordNumber: string;
  applicantName: string;
  savedAt: string;
  submitted?: boolean;
  submittedAt?: string;
  recordState: any;
  answers: Record<string, any>;
  uploadedFiles?: Record<string, any>;
}

const DB_NAME = 'nvea_offline_sync_db_v1';
const DB_VERSION = 1;
const STORE_NAME = 'pending_submissions';

export interface QueuedSubmissionItem {
  id: string; // Unique queue task identifier
  recordNumber: string;
  applicantName: string;
  submittedAt: string;
  queuedAt: string;
  attemptCount: number;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  lastError?: string;
  entry: QueuedSubmissionEntry;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.reject(new Error('IndexedDB is not available in this environment.'));
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('recordNumber', 'recordNumber', { unique: false });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('queuedAt', 'queuedAt', { unique: false });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error || new Error('Failed to open IndexedDB.'));
      };
    });
  }

  return dbPromise;
}

/**
 * Adds or updates a form submission attempt in the IndexedDB background sync queue.
 */
export async function enqueueSubmission(
  entry: QueuedSubmissionEntry,
  errorMsg?: string
): Promise<QueuedSubmissionItem> {
  const db = await getDB();
  const id = `sync_${entry.recordNumber}_${Date.now()}`;
  const item: QueuedSubmissionItem = {
    id,
    recordNumber: entry.recordNumber,
    applicantName: entry.applicantName || 'Applicant',
    submittedAt:
      (typeof entry.submittedAt === 'string' && entry.submittedAt) ||
      new Date().toISOString(),
    queuedAt: new Date().toISOString(),
    attemptCount: 0,
    status: 'pending',
    lastError: errorMsg || 'Saved while offline. Waiting for network reconnection.',
    entry,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(item);

    request.onsuccess = () => {
      // Trigger SW background sync registration if available
      registerSWBackgroundSync();
      resolve(item);
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to queue submission in IndexedDB.'));
    };
  });
}

/**
 * Retrieves all currently queued submissions from IndexedDB.
 */
export async function getQueuedSubmissions(): Promise<QueuedSubmissionItem[]> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const results = (request.result as QueuedSubmissionItem[]) || [];
        resolve(results.sort((a, b) => (b.queuedAt || '').localeCompare(a.queuedAt || '')));
      };

      request.onerror = () => {
        reject(request.error || new Error('Failed to read from IndexedDB.'));
      };
    });
  } catch {
    return [];
  }
}

/**
 * Returns the count of pending items in the sync queue.
 */
export async function getPendingQueueCount(): Promise<number> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.count();

      request.onsuccess = () => {
        resolve(request.result || 0);
      };

      request.onerror = () => {
        reject(request.error || new Error('Failed to count queue.'));
      };
    });
  } catch {
    return 0;
  }
}

/**
 * Removes a successfully synchronized item from IndexedDB.
 */
export async function removeQueuedItem(id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Updates an item's status and attempt count in IndexedDB.
 */
async function updateQueuedItem(item: QueuedSubmissionItem): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(item);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

let isSyncRunning = false;

/**
 * Iterates through all queued submissions and pushes them to the server endpoint.
 * Called automatically when online event fires or manually triggered.
 */
export async function processBackgroundSyncQueue(): Promise<{
  synced: number;
  failed: number;
  remaining: number;
  syncedRecords: string[];
}> {
  if (isSyncRunning || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    const count = await getPendingQueueCount();
    return { synced: 0, failed: 0, remaining: count, syncedRecords: [] };
  }

  isSyncRunning = true;
  let synced = 0;
  let failed = 0;
  const syncedRecords: string[] = [];

  try {
    const items = await getQueuedSubmissions();
    if (items.length === 0) {
      return { synced: 0, failed: 0, remaining: 0, syncedRecords: [] };
    }

    for (const item of items) {
      try {
        item.status = 'syncing';
        item.attemptCount += 1;
        await updateQueuedItem(item);

        const res = await fetch('/api/forms/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.entry),
        });

        if (res.ok) {
          await removeQueuedItem(item.id);
          synced += 1;
          syncedRecords.push(item.recordNumber);
        } else {
          item.status = 'failed';
          item.lastError = `Server responded with HTTP ${res.status}`;
          await updateQueuedItem(item);
          failed += 1;
        }
      } catch (networkError) {
        item.status = 'pending';
        item.lastError =
          networkError instanceof Error ? networkError.message : 'Network failure during sync retry';
        await updateQueuedItem(item);
        failed += 1;
      }
    }
  } finally {
    isSyncRunning = false;
  }

  const remaining = await getPendingQueueCount();
  return { synced, failed, remaining, syncedRecords };
}

/**
 * Registers with Service Worker SyncManager if supported by the browser.
 */
function registerSWBackgroundSync() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.ready
      .then((reg) => {
        // @ts-expect-error SyncManager is standard in Chromium
        if (reg.sync) {
          // @ts-expect-error SyncManager sync registration
          return reg.sync.register('nvea-sync-submissions');
        }
      })
      .catch(() => {
        // Fallback to window 'online' event listeners
      });
  }
}
