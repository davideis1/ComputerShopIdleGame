// Cloud-save reconciliation: given the save on this device, what we remember about our last sync, and what the server
// holds, decide what to do. Pure logic (no network, no React) so every case can be tested headless.
import { E, GameState } from './game';

/** What we remember about the last successful sync of this device with an account. */
export type SyncMeta = { userId: number; rev: number; at: number }; // at = device time (ms) of that sync
export type ServerSave = { state: any | null; rev: number; elapsed: number }; // elapsed = server-measured seconds since the last save

/** A one-line description of a save, for the "which one do you want?" prompt. */
export type Brief = { name: string; date: string; cash: number; saved: number };
export const brief = (s: GameState): Brief => ({ name: s.name || '', date: E.dateStr(E.derive(s).y), cash: s.cash, saved: s.saved || 0 });

export type Decision =
  /** Keep this device's game. `elapsed` is the server-measured time away (we were in sync), or null to use the device clock. */
  | { kind: 'local'; rev: number; elapsed: number | null }
  /** The server has nothing yet: push this device's game. */
  | { kind: 'upload' }
  /** Nothing anywhere: start a new game. */
  | { kind: 'fresh' }
  /** Adopt the cloud save. */
  | { kind: 'server'; state: GameState; rev: number; elapsed: number }
  /** Both sides changed (or they belong to different accounts): ask the player. */
  | { kind: 'conflict'; local: Brief; server: Brief; state: GameState; rev: number; elapsed: number };

/** Local progress made since the last sync that is worth asking about (autosaves keep `saved` within seconds of `at`). */
const UNSYNCED_MS = 60_000;

/** A shop that has never sold anything and was just opened: nothing worth protecting from being replaced. */
export const isFresh = (s: GameState): boolean => (s.stats?.sold || 0) === 0 && (s.stats?.play || 0) < 60;

export function reconcile(local: GameState | null, meta: SyncMeta | null, userId: number, server: ServerSave): Decision {
  if (!server.state) return local ? { kind: 'upload' } : { kind: 'fresh' };
  const srv: GameState = E.migrate(server.state);
  if (!local) return { kind: 'server', state: srv, rev: server.rev, elapsed: server.elapsed };

  const sameLineage = !!meta && meta.userId === userId;
  if (sameLineage && meta!.rev === server.rev) {
    // Nobody else has saved since we last did: this device is the newest copy (it may have played offline since).
    return { kind: 'local', rev: server.rev, elapsed: server.elapsed };
  }
  const conflict: Decision = { kind: 'conflict', local: brief(local), server: brief(srv), state: srv, rev: server.rev, elapsed: server.elapsed };
  if (sameLineage) {
    // Another device saved after us. If this one has nothing new, just take theirs; otherwise both changed.
    const unsynced = (local.saved || 0) > meta!.at + UNSYNCED_MS;
    return unsynced ? conflict : { kind: 'server', state: srv, rev: server.rev, elapsed: server.elapsed };
  }
  // Never synced with this account (a guest shop meeting an existing account, or a different account on this phone).
  return isFresh(local) ? { kind: 'server', state: srv, rev: server.rev, elapsed: server.elapsed } : conflict;
}
