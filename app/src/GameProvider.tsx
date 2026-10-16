import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { E, GameState, newGame, tick } from './game';
import { clearGame, loadGame, saveGame } from './storage';

type Away = { elapsed: number; effective: number; capped: boolean; cash0: number; cash1: number } | null;
type Ctx = {
  game: GameState;
  frame: number; // increments every tick so screens can re-render or throttle themselves
  refresh: () => void; // call after mutating state from a tap so the UI updates immediately
  away: Away;
  dismissAway: () => void;
  reset: () => Promise<void>;
};

const GameContext = createContext<Ctx | null>(null);
export const useGame = () => {
  const c = useContext(GameContext);
  if (!c) throw new Error('useGame outside GameProvider');
  return c;
};

const FRAME_MS = 250;
const SAVE_EVERY_S = 15;
const MIN_AWAY_S = 60; // shorter gaps are just ticked through

/** Owns the simulation: loads the save, catches up offline time, ticks, and autosaves. */
export function GameProvider({ children }: { children: ReactNode }) {
  const game = useRef<GameState | null>(null);
  const last = useRef(Date.now());
  const sinceSave = useRef(0);
  const [ready, setReady] = useState(false);
  const [away, setAway] = useState<Away>(null);
  const [frame, force] = useState(0);
  const refresh = useCallback(() => force((n) => n + 1), []);

  // Run real time that passed while the app was closed or backgrounded through the same offline code as the web build.
  const catchUp = useCallback((seconds: number) => {
    if (!game.current || seconds < MIN_AWAY_S) return;
    const rep = E.offline(game.current, seconds);
    if (rep.units > 0 || rep.upkeep > 0 || rep.built > 0) setAway(rep);
  }, []);

  useEffect(() => {
    let alive = true;
    loadGame().then((s) => {
      if (!alive) return;
      game.current = s ?? newGame();
      if (s) catchUp((Date.now() - s.saved) / 1000); // negative (clock set back) is ignored by the MIN_AWAY_S guard
      last.current = Date.now();
      setReady(true);
    });
    return () => { alive = false; };
  }, [catchUp]);

  useEffect(() => {
    if (!ready) return;
    const id = setInterval(() => {
      const now = Date.now();
      const dt = (now - last.current) / 1000;
      last.current = now;
      if (dt <= 0) return;
      if (dt > 10) catchUp(dt); // JS timers were suspended (app was backgrounded)
      else tick(game.current, dt);
      sinceSave.current += dt;
      if (sinceSave.current >= SAVE_EVERY_S) { sinceSave.current = 0; saveGame(game.current); }
      force((n) => n + 1);
    }, FRAME_MS);
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active' && game.current) saveGame(game.current);
    });
    return () => { clearInterval(id); sub.remove(); };
  }, [ready, catchUp]);

  const reset = useCallback(async () => {
    await clearGame();
    game.current = newGame();
    last.current = Date.now();
    setAway(null);
    force((n) => n + 1);
  }, []);

  if (!ready) return null;
  return (
    <GameContext.Provider value={{ game: game.current, frame, refresh, away, dismissAway: () => setAway(null), reset }}>
      {children}
    </GameContext.Provider>
  );
}
