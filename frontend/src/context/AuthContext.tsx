import React, { createContext, useContext, useEffect, useState } from 'react';
import { INITIAL_USERS } from '../data/mockData';
import { RoleName, UserAccount } from '../types';
import { StockFlowApi } from '../services/api';

interface AuthContextValue {
  user: UserAccount | null;
  isAuthenticated: boolean;
  isDemoAuthEnabled: boolean;
  apiOnline: boolean;
  loading: boolean;
  loginWithEmail: (
    email: string,
    password: string,
    usersList: UserAccount[]
  ) => Promise<{ ok: boolean; user?: UserAccount; error?: string }>;
  verifyBearerToken: (token: string) => Promise<{ ok: boolean; user?: UserAccount; error?: string }>;
  loginWithGoogleDemo: (
    email: string,
    name: string,
    usersList: UserAccount[],
    onCreatePending: (u: UserAccount) => void
  ) => Promise<{ ok: boolean; user?: UserAccount; error?: string }>;
  loginAsDemoRole: (role: RoleName, usersList: UserAccount[]) => UserAccount | null;
  syncCurrentUserFromList: (usersList: UserAccount[]) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_USER_KEY = 'stockflow_auth_user_v2';

function mapApiUser(apiUser: Record<string, unknown>): UserAccount {
  const name = String(apiUser.name || 'StockFlow User');
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return {
    id: Number(apiUser.id || 0),
    name,
    email: String(apiUser.email || ''),
    role: (apiUser.role as RoleName) || 'guest_pending',
    status: (apiUser.status as UserAccount['status']) || 'pending_approval',
    authProvider: apiUser.google_id ? 'google' : 'local',
    googleConnected: Boolean(apiUser.google_id),
    avatarInitials: initials || 'SF',
    department: String(apiUser.department || 'StockFlow Operations'),
    lastLoginAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
    createdAt: String(apiUser.created_at || '2026-01-01').slice(0, 10),
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Strictly gated: active in Vite dev server unless explicitly disabled, or explicitly opted-in via VITE_ENABLE_DEMO_AUTH=true
  const isDemoAuthEnabled =
    import.meta.env.VITE_ENABLE_DEMO_AUTH === 'true' ||
    (import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO_AUTH !== 'false');

  const [user, setUser] = useState<UserAccount | null>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_USER_KEY);
      return saved ? (JSON.parse(saved) as UserAccount) : null;
    } catch {
      return null;
    }
  });
  const [apiOnline, setApiOnline] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    StockFlowApi.checkHealth().then(setApiOnline);
  }, []);

  const persistUser = (u: UserAccount | null) => {
    setUser(u);
    if (u) {
      sessionStorage.setItem(STORAGE_USER_KEY, JSON.stringify(u));
    } else {
      sessionStorage.removeItem(STORAGE_USER_KEY);
      sessionStorage.removeItem('stockflow_token');
    }
  };

  const loginWithEmail = async (
    email: string,
    password: string,
    usersList: UserAccount[]
  ): Promise<{ ok: boolean; user?: UserAccount; error?: string }> => {
    setLoading(true);
    try {
      const normalized = email.trim().toLowerCase();
      if (!normalized || password.length < 6) {
        return { ok: false, error: 'Masukkan email valid dan kata sandi minimal 6 karakter.' };
      }

      if (apiOnline) {
        try {
          const res = await StockFlowApi.login(normalized, password);
          if (res.data?.token && res.data?.user) {
            sessionStorage.setItem('stockflow_token', res.data.token);
            const mapped = mapApiUser(res.data.user);
            persistUser(mapped);
            return { ok: true, user: mapped };
          }
        } catch {
          if (!isDemoAuthEnabled) {
            return { ok: false, error: 'Email atau kata sandi tidak valid.' };
          }
        }
      }

      if (!isDemoAuthEnabled) {
        return { ok: false, error: 'Server autentikasi tidak merespons. Hubungi Administrator.' };
      }

      const found = usersList.find((u) => u.email.toLowerCase() === normalized);
      if (!found) {
        return {
          ok: false,
          error: 'Kredensial tidak ditemukan. Gunakan akun terdaftar (contoh: admin@stockflow.local) atau Masuk dengan Google.',
        };
      }
      if (found.status === 'suspended') {
        return { ok: false, error: 'Akun dinonaktifkan oleh Administrator. Hubungi tim keamanan.' };
      }

      const active: UserAccount = {
        ...found,
        lastLoginAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
      };
      persistUser(active);
      return { ok: true, user: active };
    } finally {
      setLoading(false);
    }
  };

  const verifyBearerToken = async (
    token: string
  ): Promise<{ ok: boolean; user?: UserAccount; error?: string }> => {
    if (!token.trim()) {
      return { ok: false, error: 'Token OAuth2 tidak ditemukan.' };
    }
    setLoading(true);
    try {
      sessionStorage.setItem('stockflow_token', token.trim());
      const res = await StockFlowApi.me();
      const rawUser = res.data?.user || res.data?.data || res.data;
      if (!rawUser || !rawUser.email) {
        persistUser(null);
        return { ok: false, error: 'Verifikasi sesi Google gagal.' };
      }
      const mapped = mapApiUser(rawUser);
      persistUser(mapped);
      return { ok: true, user: mapped };
    } catch {
      persistUser(null);
      return { ok: false, error: 'Token OAuth2 tidak valid atau kedaluwarsa.' };
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogleDemo = async (
    email: string,
    name: string,
    usersList: UserAccount[],
    onCreatePending: (u: UserAccount) => void
  ): Promise<{ ok: boolean; user?: UserAccount; error?: string }> => {
    if (!isDemoAuthEnabled) {
      return {
        ok: false,
        error: 'Mode demo Google OAuth dinonaktifkan pada build produksi. Gunakan autentikasi Google resmi.',
      };
    }
    setLoading(true);
    try {
      const normalized = email.trim().toLowerCase();
      const existing = usersList.find((u) => u.email.toLowerCase() === normalized);
      if (existing) {
        const updated: UserAccount = {
          ...existing,
          googleConnected: true,
          lastLoginAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
        };
        persistUser(updated);
        return { ok: true, user: updated };
      }

      // CRITICAL SECURITY RULE: Unknown Google sign-in MUST be quarantined as guest_pending!
      const initials = name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
      const pendingUser: UserAccount = {
        id: Date.now(),
        name: name || 'Pengguna Google Baru',
        email: normalized,
        role: 'guest_pending',
        status: 'pending_approval',
        authProvider: 'google',
        googleConnected: true,
        avatarInitials: initials || 'GP',
        department: 'Menunggu Otorisasi Admin',
        lastLoginAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
        createdAt: new Date().toISOString().slice(0, 10),
      };
      onCreatePending(pendingUser);
      persistUser(pendingUser);
      return { ok: true, user: pendingUser };
    } finally {
      setLoading(false);
    }
  };

  const loginAsDemoRole = (role: RoleName, usersList: UserAccount[]): UserAccount | null => {
    if (!isDemoAuthEnabled) return null;
    const match = usersList.find((u) => u.role === role) || INITIAL_USERS.find((u) => u.role === role);
    if (!match) return null;
    const activeUser: UserAccount = {
      ...match,
      lastLoginAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
    };
    persistUser(activeUser);
    return activeUser;
  };

  const syncCurrentUserFromList = (usersList: UserAccount[]) => {
    if (!user) return;
    const fresh = usersList.find((u) => u.email.toLowerCase() === user.email.toLowerCase());
    if (fresh && (fresh.role !== user.role || fresh.status !== user.status)) {
      persistUser(fresh);
    }
  };

  const logout = async () => {
    await StockFlowApi.logout();
    persistUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        isDemoAuthEnabled,
        apiOnline,
        loading,
        loginWithEmail,
        verifyBearerToken,
        loginWithGoogleDemo,
        loginAsDemoRole,
        syncCurrentUserFromList,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
