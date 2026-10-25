// Apple Game Center: sign-in and achievements. The game's trophies (CS.ACH) are the achievements; their ids are the
// Game Center ids too, so App Store Connect must use exactly the ids in docs/store/game-center.md.
// Everything here is a quiet no-op without Game Center (Android, Expo Go, player signed out or never signed in).
import GC, { GcPlayer } from '../modules/game-center';
import { GameState } from './game';
import { trophyProgress } from './trophies';
import type { GcProofData } from './api';

export const gcAvailable = !!GC;
let player: GcPlayer = { authenticated: false };
const listeners = new Set<(p: GcPlayer) => void>();
/** Highest percent Game Center has accepted per achievement this launch (it never goes down, so we only send rises). */
const sent: Record<string, number> = {};
let sending = false;

function setPlayer(p: GcPlayer) {
  player = p;
  listeners.forEach((fn) => fn(p));
}
export const gcPlayer = () => player;
export function onGcPlayer(fn: (p: GcPlayer) => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Sign in at launch (Apple shows its own sheet or a "Welcome back" banner). */
export async function gcStart() {
  if (!GC) return;
  GC.addListener('onAuthChange', (p) => {
    if (!p.authenticated) for (const k in sent) delete sent[k]; // another player may sign in: resend everything
    setPlayer(p);
  });
  try { setPlayer(await GC.authenticate()); } catch { /* no Game Center on this device */ }
}

/** Report whatever rose since the last report. Cheap to call often; one request at a time. */
export async function gcReport(s: GameState) {
  if (!GC || !player.authenticated || sending || !s) return;
  const all = trophyProgress(s), rise: Record<string, number> = {};
  for (const id in all) if (all[id] > (sent[id] ?? 0)) rise[id] = all[id];
  if (!Object.keys(rise).length) return;
  sending = true;
  try {
    await GC.report(rise);
    Object.assign(sent, rise);
  } catch { /* offline or not set up in App Store Connect yet: try again next time */ }
  sending = false;
}

/** A signed proof of the Game Center player for the server (Sign in with Game Center), or { error }. */
export async function gcProof(): Promise<{ proof: GcProofData; name: string } | { error: string; message?: string }> {
  if (!GC) return { error: 'gc_unavailable' };
  try {
    // Ask the OS, not our memory of the launch sign-in: it is the one that has to hand over the proof.
    if (!GC.isAuthenticated()) {
      const st = await GC.authenticate();
      if (!st.authenticated) return { error: 'gc_unavailable' };
    }
    const p = await GC.identityProof();
    if ('error' in p) {
      // signed in, but Apple would not sign our identity request (e.g. the app is not set up for Game Center yet)
      return p.error === 'not_signed_in' ? { error: 'gc_unavailable' } : { error: 'gc_failed', message: "Game Center couldn't confirm who you are (" + p.error + ')' };
    }
    const { name, ...proof } = p;
    return { proof, name };
  } catch (e: any) {
    return { error: 'gc_failed', message: "Game Center couldn't confirm who you are (" + (e?.message || 'unknown error') + ')' };
  }
}

/** Open Game Center's achievements screen. False if the player isn't signed in. */
export async function gcShowAchievements(): Promise<boolean> {
  if (!GC) return false;
  try { return await GC.showAchievements(); } catch { return false; }
}
