import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import * as api from './api';
import { gcProof } from './gamecenter';

type User = api.ApiUser;
type Result = { ok: true } | { ok: false; message: string };
type Ctx = {
  status: 'loading' | 'out' | 'in';
  token: string | null;
  user: User | null;
  signIn: (username: string, password: string) => Promise<Result>;
  signUp: (username: string, password: string, email?: string) => Promise<Result>;
  forgot: (email: string) => Promise<Result>;
  setEmail: (email: string, password: string) => Promise<Result>;
  /** Ends this device's session. Pass `expired` when the server already rejected the token. */
  signOut: (expired?: boolean) => Promise<void>;
  /** Accounts without a password (made with Game Center) pass null and prove themselves with Game Center. */
  deleteAccount: (password: string | null) => Promise<Result>;
  signInGameCenter: () => Promise<Result & { created?: boolean }>;
  linkGameCenter: () => Promise<Result>;
  unlinkGameCenter: () => Promise<Result>;
  setPassword: (newPassword: string, password?: string) => Promise<Result>;
  /** Set when the server rejected our token on its own ("session expired"); the UI shows it once. */
  notice: string | null;
  clearNotice: () => void;
};

const TOKEN_KEY = 'csig.token';
const USER_KEY = 'csig.user';
const AuthContext = createContext<Ctx | null>(null);
export const useAuth = () => {
  const c = useContext(AuthContext);
  if (!c) throw new Error('useAuth outside AuthProvider');
  return c;
};

const label = () => (Platform.OS === 'ios' ? 'iPhone' : 'Android'); // shown if we ever list devices
const fail = (code: string): Result => ({ ok: false, message: api.errorText(code) });

/** Holds the login. The token lives in the OS keychain (SecureStore), never in AsyncStorage or the save file. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Ctx['status']>('loading');
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const t = await SecureStore.getItemAsync(TOKEN_KEY);
        const u = await SecureStore.getItemAsync(USER_KEY);
        if (!alive) return;
        if (t && u) { tokenRef.current = t; setToken(t); setUser(JSON.parse(u)); setStatus('in'); return; }
      } catch { /* keychain unavailable or unreadable: treat as signed out */ }
      if (alive) setStatus('out');
    })();
    return () => { alive = false; };
  }, []);

  const adopt = useCallback(async (t: string, u: User) => {
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, t);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(u));
    } catch { /* still signed in for this session; they will have to sign in again next launch */ }
    tokenRef.current = t; setToken(t); setUser(u); setStatus('in'); setNotice(null);
  }, []);

  const signIn = useCallback(async (username: string, password: string): Promise<Result> => {
    const r = await api.login(username.trim(), password, label());
    if (!r.ok) return fail(r.error);
    await adopt(r.data.token, r.data.user);
    return { ok: true };
  }, [adopt]);

  const signUp = useCallback(async (username: string, password: string, email?: string): Promise<Result> => {
    const r = await api.register(username.trim(), password, label(), email?.trim() || undefined);
    if (!r.ok) return fail(r.error);
    await adopt(r.data.token, r.data.user);
    return { ok: true };
  }, [adopt]);

  const forgot = useCallback(async (email: string): Promise<Result> => {
    const r = await api.forgot(email.trim());
    return r.ok ? { ok: true } : fail(r.error);
  }, []);

  const setEmail = useCallback(async (email: string, password: string): Promise<Result> => {
    const t = tokenRef.current;
    if (!t) return fail('bad_token');
    const r = await api.setEmail(t, email.trim(), password);
    if (!r.ok) return fail(r.error);
    setUser((u) => {
      if (!u) return u;
      const next = { ...u, email: r.data.email };
      SecureStore.setItemAsync(USER_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
    return { ok: true };
  }, []);

  const clear = useCallback(async () => {
    tokenRef.current = null; setToken(null); setUser(null); setStatus('out');
    try { await SecureStore.deleteItemAsync(TOKEN_KEY); await SecureStore.deleteItemAsync(USER_KEY); } catch { /* nothing to delete */ }
  }, []);

  const signOut = useCallback(async (expired?: boolean) => {
    const t = tokenRef.current;
    await clear();
    if (expired) setNotice('Your session expired, so you were signed out. Your shop is still on this device.');
    else if (t) api.logout(t); // best effort: the token also dies on its own after 180 days
  }, [clear]);

  /** Replace the stored user after the server changed it (link, unlink, password). */
  const keepUser = useCallback((u: User) => {
    setUser(u);
    SecureStore.setItemAsync(USER_KEY, JSON.stringify(u)).catch(() => {});
  }, []);

  const signInGameCenter = useCallback(async () => {
    const g = await gcProof();
    if ('error' in g) return g.message ? { ok: false, message: g.message } : fail(g.error);
    const r = await api.gcSignIn(g.proof, g.name, label());
    if (!r.ok) return fail(r.error);
    await adopt(r.data.token, r.data.user);
    return { ok: true as const, created: !!r.data.created };
  }, [adopt]);

  const linkGameCenter = useCallback(async (): Promise<Result> => {
    const t = tokenRef.current;
    if (!t) return fail('bad_token');
    const g = await gcProof();
    if ('error' in g) return g.message ? { ok: false, message: g.message } : fail(g.error);
    const r = await api.gcLink(t, g.proof);
    if (!r.ok) return fail(r.error);
    keepUser(r.data.user);
    return { ok: true };
  }, [keepUser]);

  const unlinkGameCenter = useCallback(async (): Promise<Result> => {
    const t = tokenRef.current;
    if (!t) return fail('bad_token');
    const r = await api.gcUnlink(t);
    if (!r.ok) return fail(r.error);
    keepUser(r.data.user);
    return { ok: true };
  }, [keepUser]);

  const setPassword = useCallback(async (newPassword: string, password?: string): Promise<Result> => {
    const t = tokenRef.current;
    if (!t) return fail('bad_token');
    const r = await api.setPassword(t, newPassword, password);
    if (!r.ok) return fail(r.error);
    keepUser(r.data.user);
    return { ok: true };
  }, [keepUser]);

  const deleteAccount = useCallback(async (password: string | null): Promise<Result> => {
    const t = tokenRef.current;
    if (!t) return fail('bad_token');
    let proof: api.GcProofData | undefined;
    if (password === null) {
      const g = await gcProof();
      if ('error' in g) return g.message ? { ok: false, message: g.message } : fail(g.error);
      proof = g.proof;
    }
    const r = await api.deleteAccount(t, password ?? '', proof);
    if (!r.ok) return fail(r.error);
    await clear();
    return { ok: true };
  }, [clear]);

  return (
    <AuthContext.Provider value={{ status, token, user, signIn, signUp, forgot, setEmail, signOut, deleteAccount, signInGameCenter, linkGameCenter, unlinkGameCenter, setPassword, notice, clearNotice: () => setNotice(null) }}>
      {children}
    </AuthContext.Provider>
  );
}
