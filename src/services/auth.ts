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

  // 1. Try Supabase Cloud Login if configured
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

  // 2. Fallback to LocalStorage
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

  // 1. Save to Supabase Cloud if configured
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

  // 2. Save to LocalStorage
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

const GOOGLE_CLIENT_ID_KEY = 'netflex_google_client_id';

export function getGoogleClientId(): string {
  const envId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '';
  const localId = localStorage.getItem(GOOGLE_CLIENT_ID_KEY) || '';
  return localId || envId || '';
}

export function saveGoogleClientId(clientId: string): void {
  localStorage.setItem(GOOGLE_CLIENT_ID_KEY, clientId.trim());
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

export async function signInWithGoogle(): Promise<{
  success: boolean;
  user?: User;
  error?: string;
  needConfig?: boolean;
}> {
  const googleClientId = getGoogleClientId();
  const supabase = getSupabase();

  // 1. If Google Client ID is configured, use Google Identity Services (GSI)
  if (googleClientId) {
    return new Promise((resolve) => {
      const loadGsi = () => {
        if ((window as any).google?.accounts?.id) {
          try {
            (window as any).google.accounts.id.initialize({
              client_id: googleClientId,
              callback: (response: any) => {
                if (response?.credential) {
                  const user = loginWithGoogleCredential(response.credential);
                  if (user) {
                    resolve({ success: true, user });
                  } else {
                    resolve({ success: false, error: 'Failed to parse Google credentials' });
                  }
                } else {
                  resolve({ success: false, error: 'No credential returned from Google' });
                }
              },
            });
            (window as any).google.accounts.id.prompt((notification: any) => {
              if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                const redirectUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
                  googleClientId
                )}&redirect_uri=${encodeURIComponent(
                  window.location.origin
                )}&response_type=token%20id_token&scope=openid%20email%20profile&nonce=${Date.now()}`;
                window.location.href = redirectUrl;
              }
            });
          } catch (err: any) {
            resolve({ success: false, error: err?.message || 'Google Sign-In failed' });
          }
        } else {
          const script = document.createElement('script');
          script.src = 'https://accounts.google.com/gsi/client';
          script.async = true;
          script.defer = true;
          script.onload = loadGsi;
          script.onerror = () => resolve({ success: false, error: 'Failed to load Google SDK' });
          document.head.appendChild(script);
        }
      };
      loadGsi();
    });
  }

  // 2. If Supabase is configured with a valid custom project
  if (supabase && isSupabaseConfigured()) {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Supabase Google OAuth failed' };
    }
  }

  // 3. Neither configured: tell UI we need configuration
  return {
    success: false,
    needConfig: true,
    error: '需要先配置 Google Client ID 或 Supabase 项目',
  };
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
