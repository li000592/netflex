import { getStore } from '@netlify/blobs';
import fs from 'fs';
import path from 'path';

// In-memory cache for fast response
const memoryCache = new Map();

// Helper to get Netlify Blobs store safely
function getNetlifyBlobStore(name) {
  try {
    return getStore(name);
  } catch (err) {
    return null;
  }
}

/**
 * Get an item from cloud store
 */
export async function getCloudItem(storeName, key) {
  const cacheKey = `${storeName}:${key}`;
  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey);
  }

  // 1. Try Netlify Blobs (Production)
  const store = getNetlifyBlobStore(storeName);
  if (store) {
    try {
      const data = await store.get(key, { type: 'json' });
      if (data !== undefined && data !== null) {
        memoryCache.set(cacheKey, data);
        return data;
      }
    } catch (e) {
      // Netlify blob store read fallback
    }
  }

  // 2. Local File Fallback (Development & Offline Node)
  try {
    const dir = path.join(process.cwd(), '.data');
    const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = path.join(dir, `${storeName}_${safeKey}.json`);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      memoryCache.set(cacheKey, parsed);
      return parsed;
    }
  } catch (e) {}

  return null;
}

/**
 * Save an item to cloud store
 */
export async function setCloudItem(storeName, key, value) {
  const cacheKey = `${storeName}:${key}`;
  memoryCache.set(cacheKey, value);

  // 1. Try Netlify Blobs (Production)
  const store = getNetlifyBlobStore(storeName);
  if (store) {
    try {
      await store.setJSON(key, value);
    } catch (e) {
      console.warn(`[CloudStore] Netlify Blobs set failed for ${key}:`, e.message);
    }
  }

  // 2. Local File Fallback (Development & Offline Node)
  try {
    const dir = path.join(process.cwd(), '.data');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = path.join(dir, `${storeName}_${safeKey}.json`);
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf-8');
  } catch (e) {}

  return value;
}
