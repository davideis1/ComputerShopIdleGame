import AsyncStorage from '@react-native-async-storage/async-storage';
import { E, GameState } from './game';

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
