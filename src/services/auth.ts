import { User, UserProfile } from '../types';

const AUTH_USER_KEY = 'netflex_current_user';
const USERS_DB_KEY = 'netflex_registered_users';

export const AVATAR_PRESETS = [
  {
    id: 'avatar_red',
    name: '经典红',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=faces',
  },
  {
    id: 'avatar_blue',
    name: '深邃蓝',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=faces',
  },
  {
    id: 'avatar_yellow',
    name: '活力黄',
    url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=faces',
  },
  {
    id: 'avatar_green',
    name: '清新绿',
    url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=faces',
  },
  {
    id: 'avatar_kids',
    name: '少儿专区',
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
      // update in users db
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

export function login(account: string, password: string): { success: boolean; user?: User; error?: string } {
  const cleanAccount = account.trim().toLowerCase();
  const db = getRegisteredUsers();

  // Find user by email or username
  const entry = Object.values(db).find(
    (e) => e.user.email.toLowerCase() === cleanAccount || e.user.username.toLowerCase() === cleanAccount
  );

  if (!entry) {
    return { success: false, error: '账号不存在，请检查或点击下方立即注册' };
  }

  if (entry.passwordHash !== password) {
    return { success: false, error: '密码错误，请重新输入' };
  }

  saveCurrentUser(entry.user);
  return { success: true, user: entry.user };
}

export function register(email: string, username: string, password: string): { success: boolean; user?: User; error?: string } {
  const cleanEmail = email.trim().toLowerCase();
  const cleanUsername = username.trim();

  if (!cleanEmail || !cleanUsername || !password) {
    return { success: false, error: '请完整填写注册信息' };
  }

  const db = getRegisteredUsers();
  if (db[cleanEmail]) {
    return { success: false, error: '该邮箱已被注册，请直接登录' };
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
        name: '少儿',
        avatar: AVATAR_PRESETS[4].url,
        isKids: true,
      },
    ],
  };

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
    username: 'Netflix 尊贵会员',
    currentProfileId: 'profile_1',
    profiles: [
      {
        id: 'profile_1',
        name: '主人',
        avatar: AVATAR_PRESETS[0].url,
      },
      {
        id: 'profile_2',
        name: '朋友',
        avatar: AVATAR_PRESETS[1].url,
      },
      {
        id: 'profile_3',
        name: '家庭影院',
        avatar: AVATAR_PRESETS[2].url,
      },
      {
        id: 'profile_4',
        name: '少儿频道',
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
  return user;
}

export function logout(): void {
  saveCurrentUser(null);
}
