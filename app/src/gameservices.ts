// The platform's game service behind one API: Game Center on iPhone, Google Play Games on Android. Everything is a quiet
// no-op where there is none (web, Expo Go, player signed out). The UI only talks to this file.
import { Platform } from 'react-native';
import { GameState } from './game';
import * as gc from './gamecenter';
import * as pg from './playgames';

export type GsPlayer = { authenticated: boolean; name?: string; error?: string };
/** What the server needs to know who the player is: Game Center's signed proof, or Play Games' server auth code. */
export type GsLogin =
  | { kind: 'gc'; proof: import('./api').GcProofData; name: string }
  | { kind: 'pg'; code: string; name: string };

const ios = Platform.OS === 'ios';
export const SERVICE_NAME = ios ? 'Game Center' : 'Google Play Games';
export const PHONE_NAME = ios ? 'iPhone' : 'Android phone';
export const gsAvailable = ios ? gc.gcAvailable : pg.pgAvailable;
export const gsPlayer = (): GsPlayer => (ios ? gc.gcPlayer() : pg.pgPlayer());
export const onGsPlayer = (fn: (p: GsPlayer) => void) => (ios ? gc.onGcPlayer(fn) : pg.onPgPlayer(fn));
export const gsStart = () => (ios ? gc.gcStart() : pg.pgStart());
export const gsReport = (s: GameState) => (ios ? gc.gcReport(s) : pg.pgReport(s));
export const gsShowAchievements = () => (ios ? gc.gcShowAchievements() : pg.pgShowAchievements());

/** Proof of who the player is for the server, or { error } (with a human message when we have one). */
export async function gsLogin(): Promise<GsLogin | { error: string; message?: string }> {
  if (ios) {
    const g = await gc.gcProof();
    return 'error' in g ? g : { kind: 'gc', proof: g.proof, name: g.name };
  }
  const p = await pg.pgCode();
  return 'error' in p ? p : { kind: 'pg', code: p.code, name: p.name };
}
/** Does this account have the current platform's service linked? */
export const gsLinked = (u: { gameCenter?: boolean; playGames?: boolean } | null | undefined) => !!u && (ios ? !!u.gameCenter : !!u.playGames);
