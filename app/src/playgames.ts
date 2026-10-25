// Google Play Games Services (Android): sign-in state, achievements, and a server auth code for "Continue with Google
// Play Games". The trophies (CS.ACH) are the achievements; the Play Console gives each one its own id, listed in
// playgames-ids.json ({ trophyId: playId }, written by tools/pg-ids.js from the Play Console's "Get resources").
// Until that file has ids (and the Game Services project exists) everything here is a quiet no-op.
import Constants from 'expo-constants';
import PG, { PgPlayer } from '../modules/play-games';
import { GameState } from './game';
import { trophyProgress } from './trophies';
import ids from './playgames-ids.json';

const PLAY_IDS = ids as Record<string, string>;
const extra = (Constants.expoConfig?.extra ?? {}) as { playGamesWebClientId?: string };

export const pgAvailable = !!PG;
let player: PgPlayer = { authenticated: false };
const listeners = new Set<(p: PgPlayer) => void>();
/** Highest percent Play Games has accepted per achievement this launch (progress only goes up). */
const sent: Record<string, number> = {};
let sending = false;

function setPlayer(p: PgPlayer) {
  player = p;
  listeners.forEach((fn) => fn(p));
}
export const pgPlayer = () => player;
export function onPgPlayer(fn: (p: PgPlayer) => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Is the player signed in to Play Games? (Play Games signs them in by itself at launch, when it is set up.) */
export async function pgStart() {
  if (!PG) return;
  try { setPlayer(await PG.authenticate(false)); } catch { /* no Play Games on this device */ }
}

/** Report whatever rose since the last report (only trophies that have a Play Console id). */
export async function pgReport(s: GameState) {
  if (!PG || !player.authenticated || sending || !s) return;
  const all = trophyProgress(s), rise: Record<string, number> = {}, risen: Record<string, number> = {};
  for (const t in all) {
    const id = PLAY_IDS[t];
    if (id && all[t] > (sent[id] ?? 0)) { rise[id] = all[t]; risen[id] = all[t]; }
  }
  if (!Object.keys(rise).length) return;
  sending = true;
  try { if (await PG.report(rise)) Object.assign(sent, risen); } catch { /* try again next time */ }
  sending = false;
}

export async function pgShowAchievements(): Promise<boolean> {
  if (!PG) return false;
  try { return await PG.showAchievements(); } catch { return false; }
}

/** A single-use server auth code for api/auth_playgames.php, or { error }. Signs the player in first if needed. */
export async function pgCode(): Promise<{ code: string; name: string } | { error: string; message?: string }> {
  if (!PG) return { error: 'gs_unavailable' };
  if (!extra.playGamesWebClientId) return { error: 'pg_not_configured', message: 'Google Play Games sign-in is not set up in this build yet.' };
  try {
    let p = player;
    if (!p.authenticated) { p = await PG.authenticate(true); setPlayer(p); }
    if (!p.authenticated) return { error: 'gs_unavailable' };
    const r = await PG.serverAuthCode(extra.playGamesWebClientId);
    if (!r.code && /^4\b/.test(r.error || '')) return { error: 'gs_unavailable' }; // 4 = sign-in required
    if (!r.code) return { error: 'pg_failed', message: "Google Play Games couldn't confirm who you are (" + (r.error || 'no code') + ')' };
    return { code: r.code, name: p.name || '' };
  } catch (e: any) {
    return { error: 'pg_failed', message: "Google Play Games couldn't confirm who you are (" + (e?.message || 'unknown error') + ')' };
  }
}
