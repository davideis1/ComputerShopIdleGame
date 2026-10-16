import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { E, GameState, HustleResult, hustle as doHustle, LogLine, newGame, saleLines, tick } from './game';
import { clearGame, loadGame, saveGame } from './storage';

type Away = { elapsed: number; effective: number; capped: boolean; cash0: number; cash1: number } | null;
type Ctx = {
  game: GameState;
  frame: number; // increments every tick so screens can re-render or throttle themselves
  refresh: () => void; // call after mutating state from a tap so the UI updates immediately
  log: LogLine[]; // newest first, last 7 sales
  toast: string | null; // latest achievement / notice, clears itself
  hustleResult: HustleResult | null;
  hustle: () => void;
  notify: (text: string) => void; // show a banner on whichever tab is open
  saveNow: () => Promise<void>;
  prestige: () => number; // sell up and open a new franchise; returns the tokens gained (0 if none ready)
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
  const log = useRef<LogLine[]>([]);
  const logId = useRef(0);
  const [toast, setToast] = useState<string | null>(null);
  const [hustleResult, setHustleResult] = useState<HustleResult | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushLog = useCallback((lines: { text: string; amt: number }[]) => {
    lines.forEach((l) => log.current.unshift({ id: ++logId.current, ...l }));
    if (log.current.length > 7) log.current.length = 7;
  }, []);
  const say = useCallback((text: string, ms = 4000) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), ms);
  }, []);
  const announce = useCallback((ach: any[]) => {
    if (ach.length) say('🏆 ' + ach[0].name + ' — ' + ach[0].desc + ' (+1% customers)');
  }, [say]);
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
      else {
        const { events, ach } = tick(game.current, dt);
        if (events.length) pushLog(saleLines(events));
        announce(ach);
      }
      sinceSave.current += dt;
      if (sinceSave.current >= SAVE_EVERY_S) { sinceSave.current = 0; saveGame(game.current); }
      force((n) => n + 1);
    }, FRAME_MS);
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active' && game.current) saveGame(game.current);
    });
    return () => { clearInterval(id); sub.remove(); };
  }, [ready, catchUp, pushLog, announce]);

  const hustle = useCallback(() => {
    if (!game.current) return;
    const r = doHustle(game.current);
    if (!r) return;
    if (r.log) pushLog([r.log]);
    announce(r.ach);
    setHustleResult(r.result);
    if (resultTimer.current) clearTimeout(resultTimer.current);
    resultTimer.current = setTimeout(() => setHustleResult(null), 1500);
    force((n) => n + 1);
  }, [pushLog, announce]);

  const prestige = useCallback(() => {
    if (!game.current) return 0;
    const r = E.prestige(game.current);
    if (!r) return 0;
    game.current = r.state;
    log.current = [];
    last.current = Date.now();
    sinceSave.current = 0;
    saveGame(game.current);
    say('🎫 +' + r.gain + ' tokens! Opening your new franchise…', 6000);
    force((n) => n + 1);
    return r.gain;
  }, [say]);

  const saveNow = useCallback(async () => {
    if (!game.current) return;
    await saveGame(game.current);
    sinceSave.current = 0;
    say('💾 Saved on this device');
  }, [say]);

  const reset = useCallback(async () => {
    log.current = [];
    await clearGame();
    game.current = newGame();
    last.current = Date.now();
    setAway(null);
    force((n) => n + 1);
  }, []);

  if (!ready) return null;
  return (
    <GameContext.Provider value={{ game: game.current, frame, refresh, log: log.current, toast, hustleResult, hustle, prestige, notify: say, saveNow, away, dismissAway: () => setAway(null), reset }}>
      {children}
    </GameContext.Provider>
  );
}
