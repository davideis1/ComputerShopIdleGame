// Thin client for the PHP backend (api/*.php). Every call returns a result object instead of throwing, so the
// game can keep running when the network is down. See README "Native app API" for the endpoints.
import { API_BASE } from './config';

export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = { ok: false; error: string; status: number; network: boolean };
export type ApiResult<T> = ApiOk<T> | ApiErr;

export type ApiUser = { id: number; username: string; email?: string | null; gameCenter?: boolean; playGames?: boolean; hasPassword?: boolean }; // email is masked (d***@example.com)
export type AuthReply = { token: string; user: ApiUser; created?: boolean };
export type GcProofData = { playerId: string; bundleId: string; publicKeyUrl: string; signature: string; salt: string; timestamp: string };
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

export const register = (username: string, password: string, label: string, email?: string) => post<AuthReply>('auth_register.php', { username, password, label, ...(email ? { email } : {}) });
export const login = (username: string, password: string, label: string) => post<AuthReply>('auth_login.php', { username, password, label });
export const forgot = (email: string) => post<{}>('auth_forgot.php', { email });
export const setEmail = (token: string, email: string, password: string) => post<{ email: string | null }>('auth_set_email.php', { email, password }, token);
export const logout = (token: string) => post<{}>('auth_logout.php', {}, token);
export const deleteAccount = (token: string, password: string, proof?: GcProofData, pgCode?: string) =>
  post<{}>('auth_delete.php', proof ? { proof, confirm: 'DELETE' } : pgCode ? { pg_code: pgCode, confirm: 'DELETE' } : { password, confirm: 'DELETE' }, token);
// Sign in with Game Center (api/auth_gamecenter.php): the proof comes from the native module (identityProof)
export const gcSignIn = (proof: GcProofData, name: string, label: string) => post<AuthReply>('auth_gamecenter.php', { proof, name, label });
export const gcLink = (token: string, proof: GcProofData) => post<{ user: ApiUser }>('auth_gc_link.php', { proof }, token);
export const gcUnlink = (token: string) => post<{ user: ApiUser }>('auth_gc_link.php', { unlink: true }, token);
// Sign in with Google Play Games (api/auth_playgames.php): `code` is the server auth code from the native module
export const pgSignIn = (code: string, name: string, label: string) => post<AuthReply>('auth_playgames.php', { code, name, label });
export const pgLink = (token: string, code: string) => post<{ user: ApiUser }>('auth_pg_link.php', { code }, token);
export const pgUnlink = (token: string) => post<{ user: ApiUser }>('auth_pg_link.php', { unlink: true }, token);
export const setPassword = (token: string, newPassword: string, password?: string) => post<{ user: ApiUser }>('auth_set_password.php', { new_password: newPassword, ...(password ? { password } : {}) }, token);
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
    case 'bad_password': return 'That password is wrong (or, for a new one, not 8–200 characters).';
    case 'username_taken': return 'That username is taken.';
    case 'registration_closed': return 'New accounts are closed right now.';
    case 'bad_email': return 'That email address does not look right.';
    case 'email_taken': return 'That email address is already used by another account.';
    case 'bad_confirm': return 'Type DELETE to confirm.';
    case 'bad_token': return 'Your session has expired. Please sign in again.';
    case 'gc_unavailable': return 'Game Center is not signed in on this phone. Sign in under Settings → Game Center, then try again.';
    case 'gc_failed': return "Game Center couldn't confirm who you are. Please try again.";
    case 'gc_bad_proof': case 'gc_bad_key': case 'gc_replay': case 'gc_expired': return "Game Center couldn't confirm who you are. Please try again.";
    case 'gc_taken': return 'That Game Center player is already linked to another account.';
    case 'gs_unavailable': return 'Google Play Games is not signed in on this phone. Open the Play Games app, sign in, then try again.';
    case 'pg_bad_code': case 'pg_failed': return "Google Play Games couldn't confirm who you are. Please try again.";
    case 'pg_taken': return 'That Google Play Games player is already linked to another account.';
    case 'pg_unreachable': return "Couldn't reach Google to confirm who you are. Check your connection and try again.";
    case 'pg_not_configured': return 'Google Play Games sign-in is not set up yet.';
    case 'needs_password': return 'Set a password first, or you could no longer sign in to this account.';
    case 'weak_password': return 'Passwords need 8–200 characters.';
    default: return 'Something went wrong on the server. Please try again.';
  }
}
