import { MediaItem, VideoDetail, WatchHistoryItem, WatchlistItem } from '../types';
import { getCurrentUser } from './auth';
import {
  cloudFetchWatchlist,
  cloudSaveWatchlist,
  cloudFetchWatchHistory,
  cloudSaveWatchHistory,
  cloudClearWatchHistory,
  isSupabaseConfigured,
} from './supabase';

const API_BASE = ''; // Relative path, works for both localhost:3000 and Netlify

function getStorageKey(baseKey: string): string {
  const user = getCurrentUser();
  if (user) {
    return `${baseKey}_${user.id}_${user.currentProfileId}`;
  }
  return `${baseKey}_guest`;
}

export async function fetchDoubanCatalog(type: 'movie' | 'tv', tag: string = '热门', limit: number = 20): Promise<MediaItem[]> {
  try {
    const res = await fetch(`${API_BASE}/api/douban?type=${encodeURIComponent(type)}&tag=${encodeURIComponent(tag)}&limit=${limit}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const subjects = data.subjects || [];
    return subjects.map((item: any) => ({
      id: `douban_${item.id}`,
      title: item.title,
      rate: item.rate,
      cover: item.cover ? `${API_BASE}/api/proxy/image?url=${encodeURIComponent(item.cover)}` : '',
      isNew: item.is_new,
      category: type === 'movie' ? '电影' : '剧集',
    }));
  } catch (err) {
    console.error('Failed to fetch Douban catalog:', err);
    return [];
  }
}

export async function fetchBangumiCalendar(): Promise<{ day: string; items: MediaItem[] }[]> {
  try {
    const res = await fetch(`${API_BASE}/api/bangumi`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const list = await res.json();
    if (!Array.isArray(list)) return [];
    
    return list.map((group: any) => {
      const weekdayName = group.weekday?.cn || group.weekday?.en || '每日更新';
      const items: MediaItem[] = (group.items || []).map((anime: any) => ({
        id: `bangumi_${anime.id}`,
        title: anime.name_cn || anime.name,
        rate: anime.rating?.score ? anime.rating.score.toFixed(1) : undefined,
        cover: anime.images?.large || anime.images?.common || '',
        category: '动漫',
        overview: anime.summary || '',
        year: anime.air_date ? anime.air_date.slice(0, 4) : '',
      }));
      return { day: weekdayName, items };
    });
  } catch (err) {
    console.error('Failed to fetch Bangumi calendar:', err);
    return [];
  }
}

// Client-side in-memory cache for instant subsequent clicks
const searchCache = new Map<string, MediaItem[]>();
const detailCache = new Map<string, VideoDetail>();

export function prefetchVideo(keyword: string): void {
  if (!keyword || !keyword.trim()) return;
  const key = `${keyword.trim().toLowerCase()}_all`;
  if (searchCache.has(key)) return;
  searchVideos(keyword).catch(() => {});
}

export async function searchVideos(keyword: string, sourceId?: string, category?: string): Promise<MediaItem[]> {
  if (!keyword.trim()) return [];
  const cacheKey = `${keyword.trim().toLowerCase()}_${sourceId || 'all'}_${category || 'all'}`;
  if (searchCache.has(cacheKey)) {
    return searchCache.get(cacheKey)!;
  }

  try {
    let url = `${API_BASE}/api/search?wd=${encodeURIComponent(keyword.trim())}&limit=60`;
    if (sourceId) {
      url += `&sourceId=${encodeURIComponent(sourceId)}`;
    } else if (category && category !== 'all') {
      url += `&category=${encodeURIComponent(category)}`;
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const list = data.list || [];
    const parsed: MediaItem[] = list.map((item: any) => ({
      id: item.id,
      title: item.title,
      cover: item.pic,
      vod_id: item.vod_id,
      sourceId: item.sourceId,
      sourceName: item.sourceName,
      sourceUrl: item.sourceUrl,
      remarks: item.remarks,
      actor: item.actor,
      director: item.director,
      year: item.year,
      area: item.area,
      type_name: item.type_name,
      overview: item.content,
      groups: item.groups,
      availableSources: item.availableSources,
    }));

    searchCache.set(cacheKey, parsed);
    if (searchCache.size > 100) {
      const first = searchCache.keys().next().value;
      if (first) searchCache.delete(first);
    }
    return parsed;
  } catch (err) {
    console.error('Search failed:', err);
    return [];
  }
}

export async function fetchHuakaiCatalog(
  page: number = 1,
  typeId?: number | string,
  keyword?: string
): Promise<{ page: number; pagecount: number; total: number; items: MediaItem[] }> {
  try {
    let url = `${API_BASE}/api/huakai?pg=${page}`;
    if (typeId) {
      url += `&t=${encodeURIComponent(typeId)}`;
    }
    if (keyword && keyword.trim()) {
      url += `&wd=${encodeURIComponent(keyword.trim())}`;
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const list = data.list || [];
    const items: MediaItem[] = list.map((item: any) => ({
      id: item.id,
      title: item.title,
      cover: item.pic,
      vod_id: item.vod_id,
      sourceId: item.sourceId,
      sourceName: item.sourceName,
      sourceUrl: item.sourceUrl,
      remarks: item.remarks,
      actor: item.actor,
      director: item.director,
      year: item.year,
      area: item.area,
      type_name: item.type_name,
      overview: item.content,
      groups: item.groups,
      category: '花开',
    }));

    return {
      page: data.page || page,
      pagecount: data.pagecount || 1,
      total: data.total || items.length,
      items,
    };
  } catch (err) {
    console.error('Failed to fetch Huakai catalog:', err);
    return { page, pagecount: 1, total: 0, items: [] };
  }
}

export async function fetchVideoDetail(sourceUrl: string, id: string | number): Promise<VideoDetail | null> {
  const cacheKey = `${sourceUrl}_${id}`;
  if (detailCache.has(cacheKey)) {
    return detailCache.get(cacheKey)!;
  }

  try {
    const res = await fetch(`${API_BASE}/api/detail?sourceUrl=${encodeURIComponent(sourceUrl)}&id=${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: VideoDetail = await res.json();
    detailCache.set(cacheKey, data);
    return data;
  } catch (err) {
    console.error('Failed to fetch detail:', err);
    return null;
  }
}

// Storage Keys with user isolation
const BASE_HISTORY_KEY = 'netflex_watch_history';
const BASE_WATCHLIST_KEY = 'netflex_watchlist';

export function getWatchHistory(): WatchHistoryItem[] {
  try {
    const raw = localStorage.getItem(getStorageKey(BASE_HISTORY_KEY));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Background sync helper from cloud
export async function syncCloudData(): Promise<{ watchlist: WatchlistItem[]; history: WatchHistoryItem[] }> {
  const user = getCurrentUser();
  if (!user || !isSupabaseConfigured()) {
    return { watchlist: getWatchlist(), history: getWatchHistory() };
  }

  const [cloudList, cloudHist] = await Promise.all([
    cloudFetchWatchlist(user.id, user.currentProfileId),
    cloudFetchWatchHistory(user.id, user.currentProfileId),
  ]);

  if (cloudList && cloudList.length > 0) {
    localStorage.setItem(getStorageKey(BASE_WATCHLIST_KEY), JSON.stringify(cloudList));
  }
  if (cloudHist && cloudHist.length > 0) {
    localStorage.setItem(getStorageKey(BASE_HISTORY_KEY), JSON.stringify(cloudHist));
  }

  return {
    watchlist: cloudList.length > 0 ? cloudList : getWatchlist(),
    history: cloudHist.length > 0 ? cloudHist : getWatchHistory(),
  };
}

export function saveWatchHistory(item: WatchHistoryItem): void {
  try {
    const key = getStorageKey(BASE_HISTORY_KEY);
    const history = getWatchHistory().filter((h) => h.id !== item.id);
    history.unshift(item);
    localStorage.setItem(key, JSON.stringify(history.slice(0, 50)));

    // Cloud sync
    const user = getCurrentUser();
    if (user && isSupabaseConfigured()) {
      cloudSaveWatchHistory(user.id, user.currentProfileId, item);
    }
  } catch (err) {
    console.error('Failed to save history:', err);
  }
}

export function clearWatchHistory(): void {
  try {
    localStorage.removeItem(getStorageKey(BASE_HISTORY_KEY));
    const user = getCurrentUser();
    if (user && isSupabaseConfigured()) {
      cloudClearWatchHistory(user.id, user.currentProfileId);
    }
  } catch {}
}

export function getWatchlist(): WatchlistItem[] {
  try {
    const raw = localStorage.getItem(getStorageKey(BASE_WATCHLIST_KEY));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function toggleWatchlist(item: WatchlistItem): boolean {
  try {
    const key = getStorageKey(BASE_WATCHLIST_KEY);
    const list = getWatchlist();
    const exists = list.some((w) => w.id === item.id);
    let updated: WatchlistItem[];
    if (exists) {
      updated = list.filter((w) => w.id !== item.id);
    } else {
      updated = [item, ...list];
    }
    localStorage.setItem(key, JSON.stringify(updated));

    // Cloud sync
    const user = getCurrentUser();
    if (user && isSupabaseConfigured()) {
      cloudSaveWatchlist(user.id, user.currentProfileId, item, exists ? 'remove' : 'add');
    }

    return !exists;
  } catch {
    return false;
  }
}

export function isInWatchlist(id: string): boolean {
  return getWatchlist().some((w) => w.id === id);
}
