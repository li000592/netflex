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

// -------------------------------------------------------------
// Related Series & Franchise Recommendations
// -------------------------------------------------------------

const relatedCache = new Map<string, MediaItem[]>();

export function cleanTitle(t?: string): string {
  if (!t) return '';
  return t
    .replace(/\[[^\]]+\]|\([^)]+\)|【[^】]+】|4K|1080P|720P|HD|BD|国语|粤语|中字|未删减|完整版|公映版|重制版|修复版/gi, '')
    .trim();
}

export function normalizeTitle(t?: string): string {
  return (t || '')
    .toLowerCase()
    .replace(/[·\s:：\-—_.,/()（）\[\]【】]/g, '');
}

export function extractFranchiseTerms(rawTitle: string): string[] {
  const cleaned = cleanTitle(rawTitle);
  const terms = new Set<string>();

  const stripNumbersAndSubtitles = (str: string) => {
    return str
      .replace(/(第[0-9一二三四五六七八九十]+[季部集期卷篇章]|season\s*\d+|s\d+|part\s*\d+|\s*\d+$|[一二三四五六七八九十]+$)/i, '')
      .replace(/[·\s]/g, '')
      .trim();
  };

  // Subtitle splitters
  const splitters = ['：', ':', ' - ', '—', '之'];
  for (const s of splitters) {
    if (cleaned.includes(s)) {
      const prefix = cleaned.split(s)[0].trim();
      if (prefix.length >= 2) {
        terms.add(stripNumbersAndSubtitles(prefix));
        terms.add(prefix.replace(/[·\s]/g, ''));
        terms.add(prefix);
      }
    }
  }

  // Handle "与" (e.g. 哈利·波特与魔法石, 波西·杰克逊与神火之盗, but preserve 速度与激情)
  if (cleaned.includes('与') && !cleaned.startsWith('速度与激情')) {
    const prefix = cleaned.split('与')[0].trim();
    if (prefix.length >= 3) {
      terms.add(stripNumbersAndSubtitles(prefix));
      terms.add(prefix.replace(/[·\s]/g, ''));
      terms.add(prefix);
    }
  }

  // Strip trailing numbers/seasons from the main title
  const noNum = stripNumbersAndSubtitles(cleaned);
  if (noNum.length >= 2) {
    terms.add(noNum);
  }

  terms.add(cleaned.replace(/[·\s]/g, ''));
  terms.add(cleaned);

  return Array.from(terms)
    .filter((t) => t && t.length >= 2)
    .sort((a, b) => a.length - b.length);
}

const SUBTITLE_SEQUEL_MAP: Array<{ pattern: RegExp; order: number }> = [
  // Harry Potter
  { pattern: /(魔法石|神秘的魔法石|Sorcerer|Philosopher)/i, order: 1 },
  { pattern: /(密室|消失的密室|Chamber of Secrets)/i, order: 2 },
  { pattern: /(阿兹卡班|Azkaban)/i, order: 3 },
  { pattern: /(火焰杯|火杯的考验|Goblet of Fire)/i, order: 4 },
  { pattern: /(凤凰社|凤凰令|Order of the Phoenix)/i, order: 5 },
  { pattern: /(混血王子|混血王子的背叛|Half-Blood Prince)/i, order: 6 },
  { pattern: /(死亡圣器.*(上|1)|死神的圣物.*(上|1)|Deathly Hallows.*(Part 1|1))/i, order: 7.1 },
  { pattern: /(死亡圣器.*(下|2)|死神的圣物.*(下|2)|Deathly Hallows.*(Part 2|2))/i, order: 7.2 },
  { pattern: /(死亡圣器|死神的圣物|Deathly Hallows)/i, order: 7 },
  // Fantastic Beasts
  { pattern: /(神奇动物在哪里|怪兽与它们的产地)/i, order: 8.1 },
  { pattern: /(格林德沃之罪|葛林戴华德的罪行)/i, order: 8.2 },
  { pattern: /(邓布利多之谜|邓不利多的秘密)/i, order: 8.3 },

  // Lord of the Rings
  { pattern: /(护戒使者|魔戒现身|Fellowship of the Ring)/i, order: 1 },
  { pattern: /(双塔奇兵|双城奇谋|Two Towers)/i, order: 2 },
  { pattern: /(王者无敌|王者归来|王者再临|Return of the King)/i, order: 3 },

  // Hobbit
  { pattern: /(意外之旅|Unexpected Journey)/i, order: 1 },
  { pattern: /(史矛革之战|荒谷恶龙|Desolation of Smaug)/i, order: 2 },
  { pattern: /(五军之战|Battle of the Five Armies)/i, order: 3 },

  // MCU Spider-Man
  { pattern: /(英雄归来|返校日|Homecoming)/i, order: 1 },
  { pattern: /(英雄远征|离家日|Far From Home)/i, order: 2 },
  { pattern: /(英雄无归|无回之战|No Way Home)/i, order: 3 },

  // Dark Knight
  { pattern: /(侠影之谜|开战时刻|Batman Begins)/i, order: 1 },
  { pattern: /(黑暗骑士(?!崛起)|The Dark Knight(?! Rises))/i, order: 2 },
  { pattern: /(黑暗骑士崛起|黎明升起|Dark Knight Rises)/i, order: 3 },

  // Avengers
  { pattern: /(复仇者联盟(?!2|3|4|：|:|\d)|The Avengers(?!:))/i, order: 1 },
  { pattern: /(奥创纪元|Age of Ultron)/i, order: 2 },
  { pattern: /(无限战争|Infinity War)/i, order: 3 },
  { pattern: /(终局之战|Endgame)/i, order: 4 },
];

const CHN_NUM_MAP: Record<string, number> = {
  一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5,
  六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
  十一: 11, 十二: 12, 十三: 13, 十四: 14, 十五: 15,
};

export function getSequelNumber(title: string, franchise?: string): number | null {
  if (!title) return null;

  // 1. Check known subtitle mapping
  for (const item of SUBTITLE_SEQUEL_MAP) {
    if (item.pattern.test(title)) {
      return item.order;
    }
  }

  // 2. Explicit "第X部" / "第X季" / "第X集"
  const chnMatch = title.match(/第([0-9一二三四五六七八九十]+)[部季集期卷篇章]/);
  if (chnMatch) {
    const rawNum = chnMatch[1];
    if (CHN_NUM_MAP[rawNum]) return CHN_NUM_MAP[rawNum];
    const n = parseInt(rawNum, 10);
    if (!isNaN(n)) return n;
  }

  // 3. Season / S / Part / Vol patterns
  const seasonMatch = title.match(/(?:season|s|part|vol|volume)\s*(\d+)/i);
  if (seasonMatch) {
    return parseInt(seasonMatch[1], 10);
  }

  // 4. Roman numerals
  const romanMap: Record<string, number> = {
    i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10,
  };
  const romanMatch = title.match(/[\s:：_\-]([ivx]{1,4})(?:[\s:：_\-]|$)/i);
  if (romanMatch) {
    const r = romanMatch[1].toLowerCase();
    if (romanMap[r]) return romanMap[r];
  }

  // 5. Trailing digits after franchise or name, e.g. "流浪地球2", "唐人街探案3", "叶问4"
  const trailingMatch = title.match(/(\d+)(?:[：:\s\-—]|完结|终结|大结局|$)/);
  if (trailingMatch) {
    const n = parseInt(trailingMatch[1], 10);
    if (n > 0 && n < 100) return n;
  }

  // 6. Trailing single Chinese numeral: e.g. "封神第一部" or "封神一"
  const chnTrailing = title.match(/([一二三四五六七八九十])(?:[：:\s\-—]|完结|终结|$)/);
  if (chnTrailing && CHN_NUM_MAP[chnTrailing[1]]) {
    return CHN_NUM_MAP[chnTrailing[1]];
  }

  // 7. Base franchise match (Part 1)
  if (franchise && normalizeTitle(cleanTitle(title)) === normalizeTitle(cleanTitle(franchise))) {
    return 1;
  }

  return null;
}

export function getSequelBadge(
  item: { title: string; year?: string; remarks?: string },
  sequelOrder: number | null
): string {
  if (sequelOrder !== null) {
    if (sequelOrder === 7.1) return '第 7 部(上)';
    if (sequelOrder === 7.2) return '第 7 部(下)';
    if (sequelOrder === 8.1) return '前传 1';
    if (sequelOrder === 8.2) return '前传 2';
    if (sequelOrder === 8.3) return '前传 3';

    const isSeason = /(季|season|s\d+)/i.test(item.title);
    return isSeason ? `第 ${sequelOrder} 季` : `第 ${sequelOrder} 部`;
  }

  if (item.remarks && /^(4K|HD|1080P|完结|全集)$/i.test(item.remarks.trim())) {
    return item.remarks.trim();
  }

  return item.year ? `${item.year}` : '';
}

export async function fetchRelatedSeries(
  movie: MediaItem,
  huakaiEnabled: boolean = false
): Promise<MediaItem[]> {
  if (!movie || !movie.title) return [];

  const rawTitle = movie.title;
  const currentNormalized = normalizeTitle(cleanTitle(rawTitle));
  const franchiseTerms = extractFranchiseTerms(rawTitle);
  const primaryFranchise = franchiseTerms[0] || rawTitle;

  const cacheKey = `related_${currentNormalized}_${huakaiEnabled ? 'hk1' : 'hk0'}`;
  if (relatedCache.has(cacheKey)) {
    return relatedCache.get(cacheKey)!;
  }

  const isJunk = (t: string) =>
    /(解说|预告|花絮|片段|盘点|回顾|混剪|讲解|吐槽|点评|特辑|访谈|纪录片)/i.test(t);

  const candidatePool: MediaItem[] = [];

  // 1. Search candidate franchise terms
  for (const term of franchiseTerms) {
    if (!term || term.length < 2) continue;
    const results = await searchVideos(term, undefined, undefined, huakaiEnabled);
    if (results.length > 0) {
      candidatePool.push(...results);
      if (candidatePool.length >= 12) break;
    }
  }

  // 2. If franchise search yields no other candidates, fallback to director search
  if (candidatePool.length <= 1 && movie.director && movie.director !== '精选导演') {
    const directorClean = movie.director.split(/[,/、\s]/)[0]?.trim();
    if (directorClean && directorClean.length >= 2) {
      const results = await searchVideos(directorClean, undefined, undefined, huakaiEnabled);
      candidatePool.push(...results);
    }
  }

  // 3. Filter candidates
  const primaryNorm = normalizeTitle(primaryFranchise);
  const filtered = candidatePool.filter((item) => {
    if (!item.title) return false;
    const itemNorm = normalizeTitle(cleanTitle(item.title));

    // Exclude current movie
    if (itemNorm === currentNormalized) return false;
    if (movie.vod_id && item.vod_id && item.vod_id === movie.vod_id && item.sourceId === movie.sourceId) {
      return false;
    }
    if (movie.id && item.id && item.id === movie.id) return false;

    // Filter junk clips
    if (isJunk(item.title)) return false;

    // Must match at least one franchise term if primaryNorm was established
    if (primaryNorm.length >= 2) {
      const matchesAny = franchiseTerms.some((f) => {
        const fn = normalizeTitle(f);
        return fn.length >= 2 && (itemNorm.includes(fn) || fn.includes(itemNorm));
      });
      if (!matchesAny && (!movie.director || !item.director?.includes(movie.director))) {
        return false;
      }
    }

    return true;
  });

  // 4. Deduplicate candidates by clean title
  const dedupedMap = new Map<string, MediaItem>();
  for (const item of filtered) {
    const key = normalizeTitle(cleanTitle(item.title));
    const existing = dedupedMap.get(key);
    if (!existing) {
      dedupedMap.set(key, item);
    } else {
      // Prefer candidate with valid cover
      if (hasValidCover(item.cover) && !hasValidCover(existing.cover)) {
        dedupedMap.set(key, item);
      }
    }
  }

  const deduped = Array.from(dedupedMap.values()).map((item) => {
    const seqOrder = getSequelNumber(item.title, primaryFranchise);
    return {
      ...item,
      sequelOrder: seqOrder,
      sequelBadge: getSequelBadge(item, seqOrder),
    };
  });

  // 5. Sort candidates
  // Order priority:
  // 1) Items with valid cover first
  // 2) Sequel number ascending (1, 2, 3...)
  // 3) Chronological release year ascending
  deduped.sort((a, b) => {
    const coverA = hasValidCover(a.cover) ? 1 : 0;
    const coverB = hasValidCover(b.cover) ? 1 : 0;
    if (coverA !== coverB) return coverB - coverA;

    const seqA = a.sequelOrder ?? null;
    const seqB = b.sequelOrder ?? null;
    if (seqA !== null && seqB !== null) {
      return seqA - seqB;
    }
    if (seqA !== null) return -1;
    if (seqB !== null) return 1;

    const yA = parseInt(a.year || '0', 10);
    const yB = parseInt(b.year || '0', 10);
    if (yA && yB) return yA - yB;

    return a.title.localeCompare(b.title);
  });

  const finalResults = deduped.slice(0, 20);
  relatedCache.set(cacheKey, finalResults);
  return finalResults;
}
