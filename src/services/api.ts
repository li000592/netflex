import { MediaItem, VideoDetail, WatchHistoryItem, WatchlistItem } from '../types';

const API_BASE = ''; // Relative path, works for both localhost:3001 and Netlify

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

export async function searchVideos(keyword: string, sourceId?: string): Promise<MediaItem[]> {
  if (!keyword.trim()) return [];
  try {
    let url = `${API_BASE}/api/search?wd=${encodeURIComponent(keyword.trim())}&limit=60`;
    if (sourceId) {
      url += `&sourceId=${encodeURIComponent(sourceId)}`;
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const list = data.list || [];
    return list.map((item: any) => ({
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
      availableSources: item.availableSources,
    }));
  } catch (err) {
    console.error('Search failed:', err);
    return [];
  }
}

export async function fetchVideoDetail(sourceUrl: string, id: string | number): Promise<VideoDetail | null> {
  try {
    const res = await fetch(`${API_BASE}/api/detail?sourceUrl=${encodeURIComponent(sourceUrl)}&id=${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Failed to fetch detail:', err);
    return null;
  }
}

// Local Storage for Watch History
const HISTORY_KEY = 'netflex_watch_history';
export function getWatchHistory(): WatchHistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveWatchHistory(item: WatchHistoryItem): void {
  try {
    const history = getWatchHistory().filter((h) => h.id !== item.id);
    history.unshift(item);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 50)));
  } catch (err) {
    console.error('Failed to save history:', err);
  }
}

export function clearWatchHistory(): void {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {}
}

// Local Storage for Watchlist
const WATCHLIST_KEY = 'netflex_watchlist';
export function getWatchlist(): WatchlistItem[] {
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function toggleWatchlist(item: WatchlistItem): boolean {
  try {
    const list = getWatchlist();
    const exists = list.some((w) => w.id === item.id);
    let updated: WatchlistItem[];
    if (exists) {
      updated = list.filter((w) => w.id !== item.id);
    } else {
      updated = [item, ...list];
    }
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(updated));
    return !exists;
  } catch {
    return false;
  }
}

export function isInWatchlist(id: string): boolean {
  return getWatchlist().some((w) => w.id === id);
}
