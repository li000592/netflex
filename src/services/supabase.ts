import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { WatchHistoryItem, WatchlistItem } from '../types';

const STORAGE_URL_KEY = 'netflex_supabase_url';
const STORAGE_KEY_KEY = 'netflex_supabase_anon_key';

// Default project configuration fallback
const DEFAULT_SUPABASE_URL = 'https://aibykoswmoyclmuotbra.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_jhuj2TVjw0F4vK3WzJEuFg_iFjFmXlI';

let cachedClient: SupabaseClient | null = null;

export function getSupabaseConfig(): { url: string; anonKey: string } {
  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

  const localUrl = localStorage.getItem(STORAGE_URL_KEY) || '';
  const localKey = localStorage.getItem(STORAGE_KEY_KEY) || '';

  return {
    url: localUrl || envUrl || DEFAULT_SUPABASE_URL,
    anonKey: localKey || envKey || DEFAULT_SUPABASE_ANON_KEY,
  };
}

export function saveSupabaseConfig(url: string, anonKey: string): void {
  localStorage.setItem(STORAGE_URL_KEY, url.trim());
  localStorage.setItem(STORAGE_KEY_KEY, anonKey.trim());
  cachedClient = null; // Reset client
}

export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = getSupabaseConfig();
  return Boolean(url && anonKey && url.startsWith('http'));
}

export function getSupabase(): SupabaseClient | null {
  if (cachedClient) return cachedClient;

  const { url, anonKey } = getSupabaseConfig();
  if (url && anonKey && url.startsWith('http')) {
    try {
      cachedClient = createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      });
      return cachedClient;
    } catch (err) {
      console.warn('Failed to initialize Supabase client:', err);
      return null;
    }
  }
  return null;
}

// Cloud Watchlist Operations
export async function cloudFetchWatchlist(userId: string, profileId: string): Promise<WatchlistItem[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('netflex_watchlist')
      .select('data')
      .eq('user_id', userId)
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase fetch watchlist error:', error.message);
      return [];
    }
    return (data || []).map((row) => row.data as WatchlistItem);
  } catch (err) {
    console.error('Supabase fetch watchlist failed:', err);
    return [];
  }
}

export async function cloudSaveWatchlist(
  userId: string,
  profileId: string,
  item: WatchlistItem,
  action: 'add' | 'remove'
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    if (action === 'add') {
      await supabase.from('netflex_watchlist').upsert(
        {
          user_id: userId,
          profile_id: profileId,
          item_id: item.id,
          data: item,
        },
        { onConflict: 'user_id,profile_id,item_id' }
      );
    } else {
      await supabase
        .from('netflex_watchlist')
        .delete()
        .eq('user_id', userId)
        .eq('profile_id', profileId)
        .eq('item_id', item.id);
    }
  } catch (err) {
    console.warn('Supabase save watchlist failed:', err);
  }
}

// Cloud Watch History Operations
export async function cloudFetchWatchHistory(userId: string, profileId: string): Promise<WatchHistoryItem[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('netflex_watch_history')
      .select('data')
      .eq('user_id', userId)
      .eq('profile_id', profileId)
      .order('updated_at', { ascending: false })
      .limit(60);

    if (error) {
      console.warn('Supabase fetch history error:', error.message);
      return [];
    }
    return (data || []).map((row) => row.data as WatchHistoryItem);
  } catch (err) {
    console.error('Supabase fetch history failed:', err);
    return [];
  }
}

export async function cloudSaveWatchHistory(
  userId: string,
  profileId: string,
  item: WatchHistoryItem
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    await supabase.from('netflex_watch_history').upsert(
      {
        user_id: userId,
        profile_id: profileId,
        item_id: item.id,
        data: item,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,profile_id,item_id' }
    );
  } catch (err) {
    console.warn('Supabase save watch history failed:', err);
  }
}

export async function cloudClearWatchHistory(userId: string, profileId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    await supabase
      .from('netflex_watch_history')
      .delete()
      .eq('user_id', userId)
      .eq('profile_id', profileId);
  } catch (err) {
    console.warn('Supabase clear watch history failed:', err);
  }
}
