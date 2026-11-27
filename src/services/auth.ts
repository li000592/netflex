import { User, UserProfile } from '../types';
import { getSupabase, isSupabaseConfigured } from './supabase';

const AUTH_USER_KEY = 'netflex_current_user';
const USERS_DB_KEY = 'netflex_registered_users';

export const AVATAR_PRESETS = [
  {
    id: 'avatar_red',
    name: 'Classic Red',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=faces',
  },
  {
    id: 'avatar_blue',
    name: 'Deep Blue',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=faces',
  },
  {
    id: 'avatar_yellow',
    name: 'Vibrant Yellow',
    url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=faces',
  },
  {
    id: 'avatar_green',
    name: 'Fresh Green',
    url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=faces',
  },
  {
    id: 'avatar_kids',
    name: 'Kids Zone',
    url: 'https://images.unsplash.com/photo-1543610892-0b1f7e6d8ac1?w=150&h=150&fit=crop&crop=faces',
  },
];

export function getCurrentUser(): User | null {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getCurrentProfile(user?: User | null): UserProfile | null {
  const u = user || getCurrentUser();
  if (!u || !u.profiles || u.profiles.length === 0) return null;
  return u.profiles.find((p) => p.id === u.currentProfileId) || u.profiles[0];
}

export function getRegisteredUsers(): Record<string, { user: User; passwordHash: string }> {
  try {
    const raw = localStorage.getItem(USERS_DB_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveRegisteredUsers(users: Record<string, { user: User; passwordHash: string }>): void {
  try {
    localStorage.setItem(USERS_DB_KEY, JSON.stringify(users));
  } catch {}
}

export function saveCurrentUser(user: User | null): void {
  try {
    if (user) {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
      const db = getRegisteredUsers();
      if (db[user.email]) {
        db[user.email].user = user;
        saveRegisteredUsers(db);
      }
    } else {
      localStorage.removeItem(AUTH_USER_KEY);
    }
  } catch {}
}

export async function login(
  account: string,
  password: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  const cleanAccount = account.trim().toLowerCase();

  // 1. Try Netflex Native Cloud Login (/api/auth/login)
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account: cleanAccount, password }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.user) {
        saveCurrentUser(data.user);

        // Inherit & merge local guest watchlist/history into this cloud account
        const guestWatchlistRaw = localStorage.getItem('netflex_watchlist_guest');
        const guestHistoryRaw = localStorage.getItem('netflex_watch_history_guest');
        let guestWatchlist: any[] = [];
        let guestHistory: any[] = [];
        try { if (guestWatchlistRaw) guestWatchlist = JSON.parse(guestWatchlistRaw); } catch {}
        try { if (guestHistoryRaw) guestHistory = JSON.parse(guestHistoryRaw); } catch {}

        const profileKeyList = `netflex_watchlist_${data.user.id}_${data.user.currentProfileId}`;
        const profileKeyHist = `netflex_watch_history_${data.user.id}_${data.user.currentProfileId}`;

        const cloudWatchlist: any[] = data.watchlist || [];
        const cloudHistory: any[] = data.history || [];

        const mergedWatchlist = [...cloudWatchlist];
        for (const item of guestWatchlist) {
          if (!mergedWatchlist.some((w) => w.id === item.id)) {
            mergedWatchlist.push(item);
          }
        }

        const mergedHistory = [...cloudHistory];
        for (const item of guestHistory) {
          if (!mergedHistory.some((h) => h.id === item.id)) {
            mergedHistory.push(item);
          }
        }

        localStorage.setItem(profileKeyList, JSON.stringify(mergedWatchlist));
        localStorage.setItem(profileKeyHist, JSON.stringify(mergedHistory));

        // Push merged state back to cloud if guest items were added
        if (guestWatchlist.length > 0 || guestHistory.length > 0) {
          fetch('/api/user/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: data.user.id,
              profileId: data.user.currentProfileId,
              watchlist: mergedWatchlist,
              history: mergedHistory,
            }),
          }).catch(() => {});
        }

        return { success: true, user: data.user };
      } else if (data.error) {
        return { success: false, error: data.error };
      }
    } else if (res.status === 401 || res.status === 404 || res.status === 400) {
      const data = await res.json().catch(() => ({}));
      if (data.error) {
        return { success: false, error: data.error };
      }
    }
  } catch (err) {
    console.warn('[Auth] Cloud login fetch error, falling back:', err);
  }

  // 2. Try Supabase Cloud Login if configured
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('netflex_accounts')
        .select('*')
        .or(`email.ilike.${cleanAccount},username.ilike.${cleanAccount}`)
        .limit(1);

      if (!error && data && data.length > 0) {
        const record = data[0];
        if (record.password_hash === password) {
          const user: User = {
            id: record.id,
            email: record.email,
            username: record.username,
            profiles: record.profiles || [],
            currentProfileId: record.current_profile_id || 'profile_main',
          };
          saveCurrentUser(user);
          return { success: true, user };
        } else {
          return { success: false, error: 'Password incorrect' };
        }
      }
    } catch (err) {
      console.warn('Supabase cloud login error:', err);
    }
  }

  // 3. Fallback to LocalStorage (Offline only)
  const db = getRegisteredUsers();
  const entry = Object.values(db).find(
    (e) => e.user.email.toLowerCase() === cleanAccount || e.user.username.toLowerCase() === cleanAccount
  );

  if (!entry) {
    return { success: false, error: 'Account not found. Please register below.' };
  }

  if (entry.passwordHash !== password) {
    return { success: false, error: 'Password incorrect' };
  }

  saveCurrentUser(entry.user);
  return { success: true, user: entry.user };
}

export async function register(
  email: string,
  username: string,
  password: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanUsername = username.trim();

  if (!cleanEmail || !cleanUsername || !password) {
    return { success: false, error: 'Please fill in all registration fields' };
  }

  // 1. Try Netflex Native Cloud Register (/api/auth/register)
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, username: cleanUsername, password }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.user) {
        saveCurrentUser(data.user);

        // Inherit guest watchlist/history
        const guestWatchlistRaw = localStorage.getItem('netflex_watchlist_guest');
        const guestHistoryRaw = localStorage.getItem('netflex_watch_history_guest');
        let guestWatchlist: any[] = [];
        let guestHistory: any[] = [];
        try { if (guestWatchlistRaw) guestWatchlist = JSON.parse(guestWatchlistRaw); } catch {}
        try { if (guestHistoryRaw) guestHistory = JSON.parse(guestHistoryRaw); } catch {}

        const profileKeyList = `netflex_watchlist_${data.user.id}_${data.user.currentProfileId}`;
        const profileKeyHist = `netflex_watch_history_${data.user.id}_${data.user.currentProfileId}`;
        localStorage.setItem(profileKeyList, JSON.stringify(guestWatchlist));
        localStorage.setItem(profileKeyHist, JSON.stringify(guestHistory));

        if (guestWatchlist.length > 0 || guestHistory.length > 0) {
          fetch('/api/user/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: data.user.id,
              profileId: data.user.currentProfileId,
              watchlist: guestWatchlist,
              history: guestHistory,
            }),
          }).catch(() => {});
        }

        return { success: true, user: data.user };
      } else if (data.error) {
        return { success: false, error: data.error };
      }
    } else if (res.status === 400 || res.status === 409) {
      const data = await res.json().catch(() => ({}));
      if (data.error) {
        return { success: false, error: data.error };
      }
    }
  } catch (err) {
    console.warn('[Auth] Cloud register fetch error, falling back:', err);
  }

  const newUser: User = {
    id: `user_${Date.now()}`,
    email: cleanEmail,
    username: cleanUsername,
    currentProfileId: 'profile_main',
    profiles: [
      {
        id: 'profile_main',
        name: cleanUsername,
        avatar: AVATAR_PRESETS[0].url,
      },
      {
        id: 'profile_kids',
        name: 'Kids',
        avatar: AVATAR_PRESETS[4].url,
        isKids: true,
      },
    ],
  };

  // 2. Save to Supabase Cloud if configured
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { error } = await supabase.from('netflex_accounts').insert([
        {
          id: newUser.id,
          email: cleanEmail,
          username: cleanUsername,
          password_hash: password,
          profiles: newUser.profiles,
          current_profile_id: newUser.currentProfileId,
        },
      ]);
      if (error && error.code === '23505') {
        return { success: false, error: 'This email is already registered in cloud. Please sign in.' };
      }
    } catch (err) {
      console.warn('Supabase cloud register error:', err);
    }
  }

  // 3. Save to LocalStorage
  const db = getRegisteredUsers();
  db[cleanEmail] = {
    user: newUser,
    passwordHash: password,
  };
  saveRegisteredUsers(db);
  saveCurrentUser(newUser);

  return { success: true, user: newUser };
}

export function quickDemoLogin(): User {
  const demoEmail = 'guest@netflex.com';
  const db = getRegisteredUsers();

  if (db[demoEmail]) {
    saveCurrentUser(db[demoEmail].user);
    return db[demoEmail].user;
  }

  const demoUser: User = {
    id: 'user_guest_demo',
    email: demoEmail,
    username: 'Netflix Member',
    currentProfileId: 'profile_1',
    profiles: [
      {
        id: 'profile_1',
        name: 'Primary',
        avatar: AVATAR_PRESETS[0].url,
      },
      {
        id: 'profile_2',
        name: 'Friend',
        avatar: AVATAR_PRESETS[1].url,
      },
      {
        id: 'profile_3',
        name: 'Living Room',
        avatar: AVATAR_PRESETS[2].url,
      },
      {
        id: 'profile_4',
        name: 'Kids',
        avatar: AVATAR_PRESETS[4].url,
        isKids: true,
      },
    ],
  };

  db[demoEmail] = {
    user: demoUser,
    passwordHash: '123456',
  };
  saveRegisteredUsers(db);
  saveCurrentUser(demoUser);

  return demoUser;
}

export function switchProfile(profileId: string): User | null {
  const user = getCurrentUser();
  if (!user) return null;
  const target = user.profiles.find((p) => p.id === profileId);
  if (!target) return null;

  user.currentProfileId = profileId;
  saveCurrentUser(user);

  // Sync to Supabase Cloud if configured (background fire-and-forget)
  const supabase = getSupabase();
  if (supabase) {
    supabase
      .from('netflex_accounts')
      .update({ current_profile_id: profileId })
      .eq('id', user.id)
      .then(
        () => {},
        (err: any) => console.warn('Supabase sync profile error:', err)
      );
  }

  return user;
}

const DEFAULT_GOOGLE_CLIENT_ID = '56485990452-plmi4glnroekvn57tkqd7anvv1prbqcn.apps.googleusercontent.com';
const GOOGLE_CLIENT_ID_KEY = 'netflex_google_client_id';

export function getGoogleClientId(): string {
  const envId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '';
  const localId = localStorage.getItem(GOOGLE_CLIENT_ID_KEY) || '';
  return localId || envId || DEFAULT_GOOGLE_CLIENT_ID;
}

export function saveGoogleClientId(clientId: string): void {
  localStorage.setItem(GOOGLE_CLIENT_ID_KEY, clientId.trim());
}

export async function fetchGoogleUserInfo(accessToken: string): Promise<User | null> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const profile = await res.json();
    if (!profile || !profile.sub) return null;

    const email = profile.email || `${profile.sub}@gmail.com`;
    const name = profile.name || profile.given_name || email.split('@')[0] || 'Google User';
    const avatar = profile.picture || AVATAR_PRESETS[0].url;

    const user: User = {
      id: `google_${profile.sub}`,
      email,
      username: name,
      currentProfileId: 'profile_main',
      profiles: [
        {
          id: 'profile_main',
          name,
          avatar,
        },
        {
          id: 'profile_kids',
          name: 'Kids',
          avatar: AVATAR_PRESETS[4].url,
          isKids: true,
        },
      ],
    };

    saveCurrentUser(user);
    return user;
  } catch (err) {
    console.warn('Failed to fetch Google userinfo:', err);
    return null;
  }
}

export function parseGoogleJwt(token: string): { email?: string; name?: string; picture?: string; sub?: string } | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export function loginWithGoogleCredential(credential: string): User | null {
  const payload = parseGoogleJwt(credential);
  if (!payload || !payload.sub) return null;

  const email = payload.email || `${payload.sub}@google.user`;
  const name = payload.name || email.split('@')[0] || 'Google User';
  const avatar = payload.picture || AVATAR_PRESETS[0].url;

  const user: User = {
    id: `google_${payload.sub}`,
    email,
    username: name,
    currentProfileId: 'profile_main',
    profiles: [
      {
        id: 'profile_main',
        name,
        avatar,
      },
      {
        id: 'profile_kids',
        name: 'Kids',
        avatar: AVATAR_PRESETS[4].url,
        isKids: true,
      },
    ],
  };

  saveCurrentUser(user);
  return user;
}

export async function signInWithGoogle(lang: string = 'zh'): Promise<{
  success: boolean;
  user?: User;
  error?: string;
  needConfig?: boolean;
}> {
  const googleClientId = getGoogleClientId();
  if (!googleClientId) {
    return {
      success: false,
      needConfig: true,
      error:
        lang === 'zh'
          ? '需要先配置 Google Client ID'
          : 'Google Client ID configuration is required.',
    };
  }

  return new Promise((resolve) => {
    const handleSdkLoaded = () => {
      const google = (window as any).google;
      if (!google?.accounts?.oauth2) {
        resolve({
          success: false,
          error: lang === 'zh' ? 'Google SDK 初始化失败' : 'Failed to initialize Google SDK',
        });
        return;
      }

      try {
        const client = google.accounts.oauth2.initTokenClient({
          client_id: googleClientId,
          scope: 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
          callback: async (tokenResponse: any) => {
            if (tokenResponse?.error) {
              resolve({
                success: false,
                error: tokenResponse.error_description || tokenResponse.error,
              });
              return;
            }
            if (tokenResponse?.access_token) {
              const user = await fetchGoogleUserInfo(tokenResponse.access_token);
              if (user) {
                resolve({ success: true, user });
              } else {
                resolve({
                  success: false,
                  error: lang === 'zh' ? '获取 Google 个人信息失败' : 'Failed to get Google profile',
                });
              }
            } else {
              resolve({
                success: false,
                error: lang === 'zh' ? '授权未返回令牌' : 'No token received',
              });
            }
          },
          error_callback: (err: any) => {
            resolve({
              success: false,
              error: err?.message || (lang === 'zh' ? 'Google 登录窗口已关闭' : 'Google login popup closed'),
            });
          },
        });

        // Trigger Google Login Popup
        client.requestAccessToken({ prompt: 'consent' });
      } catch (err: any) {
        // Fallback to direct URL redirect
        const redirectUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
          googleClientId
        )}&redirect_uri=${encodeURIComponent(
          window.location.origin
        )}&response_type=token&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.profile%20https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.email&hl=${
          lang === 'zh' ? 'zh-CN' : 'en'
        }&nonce=${Date.now()}`;
        window.location.href = redirectUrl;
      }
    };

    if ((window as any).google?.accounts?.oauth2) {
      handleSdkLoaded();
    } else {
      const existing = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
      if (existing) {
        existing.addEventListener('load', handleSdkLoaded);
      } else {
        const script = document.createElement('script');
        const hl = lang === 'zh' ? 'zh-CN' : 'en';
        script.src = `https://accounts.google.com/gsi/client?hl=${hl}`;
        script.async = true;
        script.defer = true;
        script.onload = handleSdkLoaded;
        script.onerror = () =>
          resolve({
            success: false,
            error: lang === 'zh' ? '加载 Google 认证服务失败，请检查网络' : 'Failed to load Google SDK',
          });
        document.head.appendChild(script);
      }
    }
  });
}

export function convertSupabaseUser(sbUser: any): User {
  const email = sbUser.email || '';
  const meta = sbUser.user_metadata || {};
  const name =
    meta.full_name ||
    meta.name ||
    meta.user_name ||
    (email ? email.split('@')[0] : 'Google User');
  const avatar = meta.avatar_url || meta.picture || AVATAR_PRESETS[0].url;

  const user: User = {
    id: sbUser.id,
    email: email || `${sbUser.id}@google.user`,
    username: name,
    currentProfileId: 'profile_main',
    profiles: [
      {
        id: 'profile_main',
        name: name,
        avatar: avatar,
      },
      {
        id: 'profile_kids',
        name: 'Kids',
        avatar: AVATAR_PRESETS[4].url,
        isKids: true,
      },
    ],
  };

  saveCurrentUser(user);
  return user;
}

export function logout(): void {
  saveCurrentUser(null);
  const supabase = getSupabase();
  if (supabase) {
    supabase.auth.signOut().catch(() => {});
  }
}
