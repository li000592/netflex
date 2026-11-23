export interface DanmakuItem {
  id?: string;
  time: number; // in seconds
  text: string;
  color: string;
  mode: 'right' | 'top' | 'bottom';
  size: number;
  isLocal?: boolean;
}

export interface DanmakuSettings {
  enabled: boolean;
  opacity: number; // 0.2 to 1.0
  fontSize: number; // e.g. 20, 25, 32
  speed: number; // 0.75, 1.0, 1.25
  area: 'all' | 'half' | 'top'; // 'all' (100%), 'half' (50%), 'top' (top 30%)
  blockTop: boolean;
  blockBottom: boolean;
  blockScroll: boolean;
}

const SETTINGS_KEY = 'netflex_danmaku_settings_v1';

export const DEFAULT_DANMAKU_SETTINGS: DanmakuSettings = {
  enabled: true,
  opacity: 0.85,
  fontSize: 24,
  speed: 1.0,
  area: 'all',
  blockTop: false,
  blockBottom: false,
  blockScroll: false,
};

export function getStoredDanmakuSettings(): DanmakuSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_DANMAKU_SETTINGS;
    return { ...DEFAULT_DANMAKU_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_DANMAKU_SETTINGS;
  }
}

export function saveStoredDanmakuSettings(settings: DanmakuSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
}

const memoryDanmakuCache = new Map<string, { time: number; data: DanmakuItem[] }>();

export async function fetchDanmakuList(
  title: string,
  episode: string | number
): Promise<DanmakuItem[]> {
  if (!title) return [];
  const cacheKey = `${title.trim().toLowerCase()}_${String(episode).trim()}`;

  const cached = memoryDanmakuCache.get(cacheKey);
  if (cached && Date.now() - cached.time < 300000) {
    return cached.data;
  }

  try {
    const params = new URLSearchParams({
      title: title.trim(),
      episode: String(episode).trim(),
    });

    const res = await fetch(`/api/danmaku?${params.toString()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const list: DanmakuItem[] = json.data || [];

    memoryDanmakuCache.set(cacheKey, {
      time: Date.now(),
      data: list,
    });
    return list;
  } catch (err) {
    console.warn('[Danmaku] Failed to fetch danmaku list:', err);
    return [];
  }
}

export async function sendDanmakuComment(payload: {
  title: string;
  episode: string | number;
  text: string;
  time: number;
  color?: string;
  mode?: 'right' | 'top' | 'bottom';
  size?: number;
}): Promise<DanmakuItem | null> {
  const item: DanmakuItem = {
    time: Math.max(0, Math.round(payload.time * 100) / 100),
    text: payload.text.trim(),
    color: payload.color || '#ffffff',
    mode: payload.mode || 'right',
    size: payload.size || 25,
    isLocal: true,
  };

  // Update memory cache immediately
  const cacheKey = `${payload.title.trim().toLowerCase()}_${String(payload.episode).trim()}`;
  const existing = memoryDanmakuCache.get(cacheKey);
  if (existing) {
    existing.data.push(item);
  } else {
    memoryDanmakuCache.set(cacheKey, { time: Date.now(), data: [item] });
  }

  // Send to server in background
  try {
    await fetch('/api/danmaku', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.warn('[Danmaku] Failed to persist user danmaku to server:', e);
  }

  return item;
}
