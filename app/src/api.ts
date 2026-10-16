// Thin client for the PHP backend (api/*.php). Every call returns a result object instead of throwing, so the
// game can keep running when the network is down. See README "Native app API" for the endpoints.
import { API_BASE } from './config';

export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = { ok: false; error: string; status: number; network: boolean };
export type ApiResult<T> = ApiOk<T> | ApiErr;

export type ApiUser = { id: number; username: string };
export type AuthReply = { token: string; user: ApiUser };
export type LoadReply = { state: any | null; rev: number; elapsed: number };
export type SaveReply = { rev: number; server_time: number };

async function post<T>(path: string, body: object, token?: string | null, timeoutMs = 12000): Promise<ApiResult<T>> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (token) {
      headers.authorization = 'Bearer ' + token;
      // Some shared hosts (IONOS included) drop the Authorization header before PHP sees it. X-Api-Token gets through,
      // and the server accepts either, so we send both.
      headers['x-api-token'] = token;
    }
    const r = await fetch(`${API_BASE}/api/${path}`, { method: 'POST', headers, body: JSON.stringify(body), signal: ctl.signal });
    let j: any = null;
    try { j = await r.json(); } catch { /* not JSON (a proxy error page, say) */ }
    if (r.ok && j && j.ok) return { ok: true, data: j as T };
    return { ok: false, error: (j && j.error) || 'server_error', status: r.status, network: false };
  } catch {
    return { ok: false, error: 'network', status: 0, network: true }; // offline, DNS failure, timeout…
  } finally {
    clearTimeout(timer);
  }
}

export const register = (username: string, password: string, label: string) => post<AuthReply>('auth_register.php', { username, password, label });
export const login = (username: string, password: string, label: string) => post<AuthReply>('auth_login.php', { username, password, label });
export const logout = (token: string) => post<{}>('auth_logout.php', {}, token);
export const deleteAccount = (token: string, password: string) => post<{}>('auth_delete.php', { password, confirm: 'DELETE' }, token);
export const loadSave = (token: string, timeoutMs = 8000) => post<LoadReply>('load.php', {}, token, timeoutMs);
export const saveToServer = (token: string, body: { state: string; rev: number; tab: string; force?: boolean }) => post<SaveReply>('save.php', body, token);
export const resetServer = (token: string) => post<{}>('reset.php', {}, token);

/** Human wording for an error code from the server (or 'network'). */
export function errorText(code: string): string {
  switch (code) {
    case 'network': return "Can't reach the server. Check your connection and try again.";
    case 'bad_credentials': return 'Wrong username or password.';
    case 'too_many_attempts': return 'Too many attempts. Wait a few minutes and try again.';
    case 'bad_username': return 'Username must be 3–20 characters: letters, numbers, _ or -.';
    case 'bad_password': return 'Password must be 8–200 characters.';
    case 'username_taken': return 'That username is taken.';
    case 'registration_closed': return 'New accounts are closed right now.';
    case 'bad_confirm': return 'Type DELETE to confirm.';
    case 'bad_token': return 'Your session has expired. Please sign in again.';
    default: return 'Something went wrong on the server. Please try again.';
  }
}
