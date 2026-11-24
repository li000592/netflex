import { OfflineDownloadItem } from '../types';

const DB_NAME = 'netflex_offline_db_v1';
const DB_VERSION = 1;
const STORE_NAME = 'downloads';

let dbPromise: Promise<IDBDatabase> | null = null;

export function initOfflineDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported in this environment'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('movieId', 'movieId', { unique: false });
        store.createIndex('downloadedAt', 'downloadedAt', { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      console.error('IndexedDB open error:', request.error);
      reject(request.error);
    };
  });

  return dbPromise;
}

export async function getAllDownloads(): Promise<OfflineDownloadItem[]> {
  try {
    const db = await initOfflineDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const items = req.result as OfflineDownloadItem[];
        // Sort descending by downloadedAt
        items.sort((a, b) => (b.downloadedAt || 0) - (a.downloadedAt || 0));
        resolve(items);
      };

      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to get all downloads:', err);
    return [];
  }
}

export async function getDownload(id: string): Promise<OfflineDownloadItem | null> {
  try {
    const db = await initOfflineDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);

      req.onsuccess = () => resolve((req.result as OfflineDownloadItem) || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to get download by ID:', err);
    return null;
  }
}

export async function saveDownload(item: OfflineDownloadItem): Promise<void> {
  const db = await initOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(item);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteDownload(id: string): Promise<void> {
  const db = await initOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function clearAllDownloads(): Promise<void> {
  const db = await initOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes <= 0) return '0 MB';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export async function getStorageUsage(): Promise<{
  usedBytes: number;
  quotaBytes: number;
  formattedUsed: string;
  formattedQuota: string;
  percent: number;
}> {
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      const used = estimate.usage || 0;
      const quota = estimate.quota || 1024 * 1024 * 1024 * 10; // Default 10GB if unknown
      const percent = Math.min(100, Math.round((used / quota) * 100));

      return {
        usedBytes: used,
        quotaBytes: quota,
        formattedUsed: formatBytes(used),
        formattedQuota: formatBytes(quota),
        percent,
      };
    }
  } catch (err) {
    console.warn('Storage estimate failed:', err);
  }

  // Fallback calculation by summing all downloaded items
  const downloads = await getAllDownloads();
  const total = downloads.reduce((acc, d) => acc + (d.downloadedBytes || 0), 0);
  return {
    usedBytes: total,
    quotaBytes: 1024 * 1024 * 1024 * 10,
    formattedUsed: formatBytes(total),
    formattedQuota: '10 GB',
    percent: 0,
  };
}
