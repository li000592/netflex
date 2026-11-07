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

export function hasValidCover(cover?: string | null): boolean {
  if (!cover || typeof cover !== 'string') return false;
  const trimmed = cover.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (
    lower === 'nopic' ||
    lower === 'no_pic' ||
    lower === 'default' ||
    lower === 'null' ||
    lower === 'undefined' ||
    lower.includes('nopic') ||
    lower.includes('no_pic') ||
    lower.includes('default.jpg') ||
    lower.includes('default.png')
  ) {
    return false;
  }
  return /^https?:\/\//i.test(trimmed) || trimmed.startsWith('/api/proxy/image');
}

export function sortMediaByCover(items: MediaItem[]): MediaItem[] {
  return [...items].sort((a, b) => {
    const aHas = hasValidCover(a.cover) ? 1 : 0;
    const bHas = hasValidCover(b.cover) ? 1 : 0;
    return bHas - aHas;
  });
}

export interface HomeCatalogCache {
  movies: MediaItem[];
  tv: MediaItem[];
  bangumi: { day: string; items: MediaItem[] }[];
  variety: MediaItem[];
  huakai?: MediaItem[];
  timestamp: number;
}

const HOME_CACHE_KEY = 'netflex_home_catalog_cache_v2';

export function getLocalHomeCache(): HomeCatalogCache | null {
  try {
    const raw = localStorage.getItem(HOME_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed;
  } catch {
    return null;
  }
}

export function saveLocalHomeCache(data: Omit<HomeCatalogCache, 'timestamp'>): void {
  try {
    localStorage.setItem(
      HOME_CACHE_KEY,
      JSON.stringify({ ...data, timestamp: Date.now() })
    );
  } catch {}
}

// Client-side cache for Douban & Bangumi
const doubanMemoryCache = new Map<string, { data: MediaItem[]; time: number }>();
let bangumiMemoryCache: { data: { day: string; items: MediaItem[] }[]; time: number } | null = null;

function getStorageKey(baseKey: string): string {
  const user = getCurrentUser();
  if (user) {
    return `${baseKey}_${user.id}_${user.currentProfileId}`;
  }
  return `${baseKey}_guest`;
}

export async function fetchDoubanCatalog(
  type: 'movie' | 'tv',
  tag: string = '热门',
  limit: number = 24,
  start: number = 0
): Promise<MediaItem[]> {
  const cacheKey = `douban_${type}_${tag}_${limit}_${start}`;
  const now = Date.now();

  // Check in-memory cache (15 min TTL)
  const cached = doubanMemoryCache.get(cacheKey);
  if (cached && now - cached.time < 900000) {
    return cached.data;
  }

  // Check sessionStorage cache
  try {
    const sessionRaw = sessionStorage.getItem(`netflex_cache_${cacheKey}`);
    if (sessionRaw) {
      const parsed = JSON.parse(sessionRaw);
      if (parsed && now - parsed.time < 900000) {
        doubanMemoryCache.set(cacheKey, parsed);
        return parsed.data;
      }
    }
  } catch {}

  try {
    const res = await fetch(
      `${API_BASE}/api/douban?type=${encodeURIComponent(type)}&tag=${encodeURIComponent(tag)}&limit=${limit}&start=${start}`
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const subjects = data.subjects || [];
    const list: MediaItem[] = subjects.map((item: any) => {
      // Upgrade Douban cover to high-definition large poster
      const hdCover = item.cover
        ? item.cover
            .replace('/s_ratio_poster/', '/l_ratio_poster/')
            .replace('/m_ratio_poster/', '/l_ratio_poster/')
        : '';

      const coverUrl = hdCover ? `${API_BASE}/api/proxy/image?url=${encodeURIComponent(hdCover)}` : '';

      return {
        id: `douban_${item.id}`,
        title: item.title,
        rate: item.rate,
        cover: hasValidCover(coverUrl) ? coverUrl : '',
        isNew: item.is_new,
        category: type === 'movie' ? '电影' : '剧集',
      };
    });

    const sorted = sortMediaByCover(list);
    doubanMemoryCache.set(cacheKey, { data: sorted, time: now });
    try {
      sessionStorage.setItem(`netflex_cache_${cacheKey}`, JSON.stringify({ data: sorted, time: now }));
    } catch {}

    return sorted;
  } catch (err) {
    console.error('Failed to fetch Douban catalog:', err);
    // Return stale cache if available
    if (cached) return cached.data;
    return [];
  }
}

export async function fetchBangumiCalendar(): Promise<{ day: string; items: MediaItem[] }[]> {
  const now = Date.now();
  if (bangumiMemoryCache && now - bangumiMemoryCache.time < 1800000) {
    return bangumiMemoryCache.data;
  }

  try {
    const sessionRaw = sessionStorage.getItem('netflex_cache_bangumi');
    if (sessionRaw) {
      const parsed = JSON.parse(sessionRaw);
      if (parsed && now - parsed.time < 1800000) {
        bangumiMemoryCache = parsed;
        return parsed.data;
      }
    }
  } catch {}

  try {
    const res = await fetch(`${API_BASE}/api/bangumi`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const list = await res.json();
    if (!Array.isArray(list)) return [];
    
    const parsedCalendar = list.map((group: any) => {
      const weekdayName = group.weekday?.cn || group.weekday?.en || '每日更新';
      const items: MediaItem[] = (group.items || []).map((anime: any) => {
        const cover = anime.images?.large || anime.images?.common || '';
        return {
          id: `bangumi_${anime.id}`,
          title: anime.name_cn || anime.name,
          rate: anime.rating?.score ? anime.rating.score.toFixed(1) : undefined,
          cover: hasValidCover(cover) ? cover : '',
          category: '动漫',
          overview: anime.summary || '',
          year: anime.air_date ? anime.air_date.slice(0, 4) : '',
        };
      });
      return { day: weekdayName, items: sortMediaByCover(items) };
    });

    bangumiMemoryCache = { data: parsedCalendar, time: now };
    try {
      sessionStorage.setItem('netflex_cache_bangumi', JSON.stringify({ data: parsedCalendar, time: now }));
    } catch {}

    return parsedCalendar;
  } catch (err) {
    console.error('Failed to fetch Bangumi calendar:', err);
    if (bangumiMemoryCache) return bangumiMemoryCache.data;
    return [];
  }
}

// Client-side in-memory cache for instant subsequent clicks
const searchCache = new Map<string, MediaItem[]>();
const detailCache = new Map<string, VideoDetail>();

export function prefetchVideo(keyword: string, huakaiEnabled: boolean = false): void {
  if (!keyword || !keyword.trim()) return;
  const key = `${keyword.trim().toLowerCase()}_all_all_${huakaiEnabled ? 'hk1' : 'hk0'}`;
  if (searchCache.has(key)) return;
  searchVideos(keyword, undefined, undefined, huakaiEnabled).catch(() => {});
}

export async function searchVideos(
  keyword: string,
  sourceId?: string,
  category?: string,
  huakaiEnabled: boolean = false
): Promise<MediaItem[]> {
  if (!keyword.trim()) return [];
  const cacheKey = `${keyword.trim().toLowerCase()}_${sourceId || 'all'}_${category || 'all'}_${huakaiEnabled ? 'hk1' : 'hk0'}`;
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
    if (huakaiEnabled) {
      url += `&huakai=true`;
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const list = data.list || [];
    let parsed: MediaItem[] = list.map((item: any) => ({
      id: item.id,
      title: item.title,
      cover: hasValidCover(item.pic) ? item.pic.trim() : '',
      vod_id: item.vod_id,
      sourceId: item.sourceId,
      sourceName: item.sourceName,
      sourceUrl: item.sourceUrl,
      sourceCategory: item.sourceCategory,
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

    // Strict client-side Huakai barrier when mode is OFF
    if (!huakaiEnabled) {
      const adultRegex = /(伦理|倫理|理论片|情色|三级|福利|里番|无码|有码|麻豆|自拍|人妻|乱伦|性爱|色情|福利姬|调教|偷拍|探花|主播秀色|巨乳|萝莉|av解说|换脸|91制片|蜜桃影像|天美传媒|精东影业|星空无限|swag|糖心|写真|写真热舞|成人|做爱|内射|高潮|潮吹|迷奸|强暴|强奸|轮奸|操逼|肉棒|大胸|情趣|女优|淫乱|春药|野战|车震|黑料|门事件|SM调教|叫床|出轨约炮|私房写真|极度诱惑)/i;
      const avCodeRegex = /\b(fc2|ppv)[-_]?\d+|\b(ssni|ipx|mide|midv|abp|snis|wanz|pred|star|stars|jul|jufe|atid|adn|hnd|dasd|cawd|fsdss|miae|ssis|juq|dldss|sone|pppd|ebod|meyd|mey|das|stars|tek|soe)[-_]?\d+/i;
      parsed = parsed.filter(
        (item) =>
          item.sourceCategory !== 'huakai' &&
          item.category !== 'huakai' &&
          item.sourceId !== '155zy' &&
          item.sourceId !== 'didi' &&
          item.sourceId !== 'yutu' &&
          item.sourceId !== 'lebo' &&
          !adultRegex.test(item.type_name || '') &&
          !adultRegex.test(item.title || '') &&
          !avCodeRegex.test(item.title || '')
      );
    }

    // Sort: titles without covers are moved to the back
    parsed = sortMediaByCover(parsed);

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
    const items: MediaItem[] = sortMediaByCover(
      list.map((item: any) => ({
        id: item.id,
        title: item.title,
        cover: hasValidCover(item.pic) ? item.pic.trim() : '',
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
      }))
    );

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
    const itemTitle = item.title?.trim().toLowerCase();
    const history = getWatchHistory().filter((h) => {
      if (h.id === item.id) return false;
      if (itemTitle && h.title && h.title.trim().toLowerCase() === itemTitle) return false;
      return true;
    });
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
