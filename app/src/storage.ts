import AsyncStorage from '@react-native-async-storage/async-storage';
import { E, GameState } from './game';
import type { SyncMeta } from './sync';

const KEY = 'csig-save-v1';

export async function loadGame(): Promise<GameState | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? E.deserialize(raw) : null;
  } catch {
    return null; // corrupt or unreadable: start fresh rather than crash
  }
}

export async function saveGame(s: GameState): Promise<void> {
  s.saved = Date.now();
  await AsyncStorage.setItem(KEY, E.serialize(s));
}

export const clearGame = () => AsyncStorage.removeItem(KEY);

/* ---------- sync bookkeeping (kept apart from the game state so it never ends up inside a save) ---------- */
const META_KEY = 'csig-sync-v1';
const DEVICE_KEY = 'csig-device-v1';

export async function loadSyncMeta(): Promise<SyncMeta | null> {
  try {
    const raw = await AsyncStorage.getItem(META_KEY);
    const m = raw ? JSON.parse(raw) : null;
    return m && typeof m.userId === 'number' && typeof m.rev === 'number' ? m : null;
  } catch {
    return null;
  }
}
export const saveSyncMeta = (m: SyncMeta) => AsyncStorage.setItem(META_KEY, JSON.stringify(m));
export const clearSyncMeta = () => AsyncStorage.removeItem(META_KEY);

/** A random id for this install, sent as the "tab" so a stale revision from the same device is never a conflict. */
export async function deviceId(): Promise<string> {
  try {
    const have = await AsyncStorage.getItem(DEVICE_KEY);
    if (have) return have;
  } catch { /* fall through and make one */ }
  let id = 'app';
  for (let i = 0; i < 12; i++) id += Math.floor(Math.random() * 16).toString(16);
  try { await AsyncStorage.setItem(DEVICE_KEY, id); } catch { /* the id just won't persist */ }
  return id;
}
