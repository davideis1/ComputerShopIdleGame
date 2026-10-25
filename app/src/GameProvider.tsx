import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as api from './api';
import { useAuth } from './AuthProvider';
import CS from '@core';
import { E, GameState, HustleResult, hustle as doHustle, LogLine, newGame, saleLines, tick } from './game';
import { clearGame, clearSyncMeta, deviceId, loadGame, loadSyncMeta, saveGame, saveSyncMeta } from './storage';
import { noteBrowse, noteBuy } from './walkers';
import { gcReport, gcStart, onGcPlayer } from './gamecenter';
import { cancelAll as cancelReminders, scheduleFor as scheduleReminders } from './notify';
import { brief, Brief, Decision, reconcile, SyncMeta } from './sync';

type Away = { elapsed: number; effective: number; capped: boolean; cash0: number; cash1: number } | null;
export type SyncStatus = 'off' | 'ok' | 'offline' | 'paused' | 'error';
export type Conflict = { local: Brief; server: Brief } | null;
type ResetResult = { ok: true } | { ok: false; message: string };
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
  decide: (choice: number) => void; // answer the open offer card (core/offers.js)
  away: Away;
  catchProgress: number | null; // 0..1 while a long offline catch-up runs, else null
  dismissAway: () => void;
  reset: () => Promise<ResetResult>;
  /** Cloud sync: 'off' when signed out, 'ok' / 'offline' / 'paused' (conflict postponed) / 'error' when signed in. */
  sync: { status: SyncStatus; at: number | null };
  conflict: Conflict; // set when this device and the cloud both changed: the player picks
  resolveConflict: (choice: 'local' | 'server' | 'later') => void;
  syncNow: () => Promise<void>;
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
const BOOT_LOAD_MS = 5000;
const SLICE_MS = 12; // catch-up work per frame // how long launch waits for the server before playing from the local save

type PendingServer = { state: GameState; rev: number; elapsed: number };

/** Owns the simulation: loads the save, catches up offline time, ticks, autosaves, and syncs with the account. */
export function GameProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const tokenRef = useRef<string | null>(null);
  const userIdRef = useRef<number | null>(null);
  tokenRef.current = auth.token;
  userIdRef.current = auth.user ? auth.user.id : null;

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

  // --- sync state
  const meta = useRef<SyncMeta | null>(null);
  const device = useRef('app');
  const syncing = useRef(false);
  const paused = useRef(false);
  const pending = useRef<PendingServer | null>(null); // the cloud copy waiting on the player's choice
  const [sync, setSync] = useState<Ctx['sync']>({ status: 'off', at: null });
  const [conflict, setConflict] = useState<Conflict>(null);
  const booted = useRef(false);
  const prevToken = useRef<string | null | undefined>(undefined);

  const pushLog = useCallback((lines: { text: string; amt: number }[]) => {
    lines.forEach((l) => log.current.unshift({ id: ++logId.current, ...l }));
    if (log.current.length > 7) log.current.length = 7;
  }, []);
  const say = useCallback((text: string, ms = 4000) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), ms);
  }, []);
  // Era changes and the first claimable token get a banner, like the web build (js/ui.js renderHeader).
  // Only moving forward counts: a new franchise or an adopted cloud save going back in time stays quiet.
  const eraShown = useRef<{ name: string; from: number } | null>(null);
  const offerSeen = useRef<number | null>(null);
  const milestones = useCallback(() => {
    const g = game.current;
    if (!g) return;
    const era = E.eraAt(E.yearOf(g));
    if (eraShown.current && era.from > eraShown.current.from) say('🕰️ New era: ' + era.name + ' — ' + era.blurb, 5000);
    eraShown.current = era;
    // a new offer card: say so wherever the player is
    if (g.offer && g.offer.at !== offerSeen.current) {
      offerSeen.current = g.offer.at;
      const ov = CS.Offers.view(g);
      if (ov) say('📨 ' + ov.title + ' — open the Shop tab to decide (' + CS.Offers.WAIT + 's).', 6000);
    }
    // after an hour of play, mention reminders once (they are opt-in)
    if (g.stats.play > 3600 && g.settings && g.settings.notify == null && !g.seen.notifyTip) {
      g.seen.notifyTip = 1;
      say('🔔 Want a nudge when the night shift ends? Switch on reminders in Menu → Look.', 6000);
    }
    if (E.pendingTokens(g) >= 1 && !g.seen.tok) {
      g.seen.tok = 1;
      say('🎫 Franchise Tokens are available! Open the HQ tab to cash them in for permanent upgrades.', 6000);
    }
  }, [say]);
  const announce = useCallback((ach: any[]) => {
    if (!ach.length) return;
    say('🏆 ' + ach[0].name + ' — ' + ach[0].desc + ' (+1% customers)');
    gcReport(game.current);
  }, [say]);
  const [frame, force] = useState(0);
  const refresh = useCallback(() => force((n) => n + 1), []);

  // Run real time that passed while the app was closed or backgrounded through the same offline code as the web build.
  // It runs in slices of ~12 ms so the phone keeps drawing; after 250 ms a progress overlay shows. The tick and
  // autosave wait meanwhile. If the game is replaced mid-way (cloud copy adopted, erased), the job is dropped.
  const catching = useRef(false);
  const [catchProgress, setCatchProgress] = useState<number | null>(null);
  const catchUp = useCallback(async (seconds: number) => {
    const g = game.current;
    if (!g || seconds < MIN_AWAY_S || catching.current) return;
    catching.current = true;
    const job = E.offlineStart(g, seconds);
    const t0 = Date.now();
    for (;;) {
      const slice = Date.now();
      let done = false;
      while (!done && Date.now() - slice < SLICE_MS) done = E.offlineRun(job, 20);
      if (done || game.current !== g) break;
      if (Date.now() - t0 > 250) setCatchProgress(1 - job.left / Math.max(1, job.total));
      await new Promise((r) => setTimeout(r, 0));
    }
    catching.current = false;
    setCatchProgress(null);
    last.current = Date.now();
    if (game.current !== g) return;
    const rep = job.rep;
    if (rep.units > 0 || rep.upkeep > 0 || rep.built > 0) setAway(rep);
  }, []);

  /* ---------- cloud sync ---------- */

  const markSynced = useCallback(async (rev: number) => {
    const uid = userIdRef.current;
    if (uid == null) return;
    meta.current = { userId: uid, rev, at: Date.now() };
    await saveSyncMeta(meta.current);
    setSync({ status: 'ok', at: Date.now() });
  }, []);

  /** The token was refused by the server: it expired or the account is gone. */
  const signOut = auth.signOut;
  const sessionLost = useCallback(() => { signOut(true); }, [signOut]);

  /** Push this device's game to the account (revision-checked, like the website). */
  const push = useCallback(async (force = false) => {
    const t = tokenRef.current, g = game.current;
    if (!t || !g || syncing.current || paused.current || (pending.current && !force)) return;
    syncing.current = true;
    try {
      const r = await api.saveToServer(t, { state: E.serialize(g), rev: meta.current ? meta.current.rev : 0, tab: device.current, force });
      if (r.ok) { await markSynced(r.data.rev); return; }
      if (r.error === 'conflict') { await openConflict(); return; }
      if (r.status === 401) { sessionLost(); return; }
      setSync((s) => ({ status: r.network ? 'offline' : 'error', at: s.at }));
    } finally {
      syncing.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markSynced, sessionLost]);

  /** Fetch the cloud copy and ask the player which one to keep. */
  const openConflict = useCallback(async () => {
    const t = tokenRef.current;
    if (!t || !game.current) return;
    const r = await api.loadSave(t);
    if (!r.ok) {
      if (r.status === 401) sessionLost(); else setSync((s) => ({ status: r.network ? 'offline' : 'error', at: s.at }));
      return;
    }
    if (!r.data.state) { meta.current = null; return; } // the cloud copy vanished: the next push will recreate it
    const st: GameState = E.migrate(r.data.state);
    pending.current = { state: st, rev: r.data.rev, elapsed: r.data.elapsed };
    setConflict({ local: brief(game.current), server: brief(st) });
  }, [sessionLost]);

  /** Make the cloud copy this device's game (new phone, or the player chose it). */
  const adoptServer = useCallback(async (p: PendingServer) => {
    game.current = p.state;
    log.current = [];
    last.current = Date.now();
    sinceSave.current = 0;
    await catchUp(p.elapsed);
    await saveGame(game.current);
    await markSynced(p.rev);
    force((n) => n + 1);
  }, [catchUp, markSynced]);

  /** Apply a reconcile() decision while the game is running (after signing in, or "Sync now"). */
  const applyDecision = useCallback(async (d: Decision) => {
    switch (d.kind) {
      case 'upload': meta.current = null; await push(); break;
      case 'local': await markSynced(d.rev); await push(); break;
      case 'server': await adoptServer({ state: d.state, rev: d.rev, elapsed: d.elapsed }); break;
      case 'conflict': pending.current = { state: d.state, rev: d.rev, elapsed: d.elapsed }; setConflict({ local: d.local, server: d.server }); break;
      default: break; // 'fresh'
    }
  }, [adoptServer, markSynced, push]);

  /** Compare this device with the account from scratch. */
  const reconcileNow = useCallback(async () => {
    const t = tokenRef.current, uid = userIdRef.current;
    if (!t || uid == null || !game.current) return;
    const r = await api.loadSave(t);
    if (!r.ok) {
      if (r.status === 401) sessionLost(); else setSync((s) => ({ status: r.network ? 'offline' : 'error', at: s.at }));
      return;
    }
    paused.current = false;
    await applyDecision(reconcile(game.current, meta.current, uid, r.data));
  }, [applyDecision, sessionLost]);

  const resolveConflict = useCallback((choice: 'local' | 'server' | 'later') => {
    const p = pending.current;
    pending.current = null;
    setConflict(null);
    if (!p) return;
    if (choice === 'server') { adoptServer(p); return; }
    if (choice === 'local') {
      meta.current = userIdRef.current != null ? { userId: userIdRef.current, rev: p.rev, at: Date.now() } : null;
      push(true); // overwrite the cloud copy with this device's shop
      return;
    }
    paused.current = true; // keep playing locally; "Sync now" in Menu -> Account asks again
    setSync((s) => ({ status: 'paused', at: s.at }));
  }, [adoptServer, push]);

  const syncNow = useCallback(async () => {
    if (!tokenRef.current || !game.current) return;
    if (pending.current) { setConflict({ local: brief(game.current), server: brief(pending.current.state) }); return; }
    if (paused.current || !meta.current || meta.current.userId !== userIdRef.current) { await reconcileNow(); return; }
    await saveGame(game.current);
    await push();
  }, [push, reconcileNow]);

  /* ---------- launch ---------- */

  useEffect(() => {
    if (auth.status === 'loading' || booted.current) return;
    booted.current = true;
    let alive = true;
    (async () => {
      device.current = await deviceId();
      meta.current = await loadSyncMeta();
      const local = await loadGame();
      const t = tokenRef.current, uid = userIdRef.current;
      let d: Decision | null = null;
      if (t && uid != null) {
        const r = await api.loadSave(t, BOOT_LOAD_MS);
        if (r.ok) d = reconcile(local, meta.current, uid, r.data);
        else if (r.status === 401) auth.signOut(true);
        else setSync({ status: r.network ? 'offline' : 'error', at: null });
      }
      if (!alive) return;

      // Offline time: with the server in reach, never more than the server saw (a changed phone clock can't buy extra hours),
      // and never more than the device saw (so offline play that was already simulated is not counted twice).
      const deviceAway = local ? Math.max(0, (Date.now() - local.saved) / 1000) : 0;
      if (d && d.kind === 'server') {
        game.current = d.state;
        await catchUp(d.elapsed);
        meta.current = { userId: uid!, rev: d.rev, at: Date.now() };
        await saveSyncMeta(meta.current);
        await saveGame(game.current);
        setSync({ status: 'ok', at: Date.now() });
      } else {
        game.current = local ?? newGame();
        await catchUp(d && d.kind === 'local' && d.elapsed != null ? Math.min(d.elapsed, deviceAway) : deviceAway);
        if (d && d.kind === 'local') { meta.current = { userId: uid!, rev: d.rev, at: Date.now() }; await saveSyncMeta(meta.current); setSync({ status: 'ok', at: Date.now() }); }
        if (d && d.kind === 'upload') meta.current = null;
        if (d && d.kind === 'conflict') {
          pending.current = { state: d.state, rev: d.rev, elapsed: d.elapsed };
          setConflict({ local: d.local, server: d.server });
        }
      }
      last.current = Date.now();
      setReady(true);
      if (d && (d.kind === 'upload' || d.kind === 'local')) push();
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.status]);

  // Signing in or out while the game is running.
  useEffect(() => {
    const prev = prevToken.current;
    prevToken.current = auth.token;
    if (!ready || prev === undefined || prev === auth.token) return;
    if (auth.token) { reconcileNow(); return; }
    // Signed out: keep `meta` (it records which account and revision this device last matched), so signing back in to the
    // same account is a quiet revision comparison; a different account has a different id and is asked about instead.
    pending.current = null; paused.current = false;
    setConflict(null);
    setSync({ status: 'off', at: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.token, ready]);
  useEffect(() => { if (ready && prevToken.current === undefined) prevToken.current = auth.token; }, [ready, auth.token]);

  /* ---------- Game Center ---------- */

  // Sign in once the shop is loaded, then send every trophy and progress ring (again whenever a player signs in).
  useEffect(() => {
    if (!ready) return;
    const off = onGcPlayer((p) => { if (p.authenticated) gcReport(game.current); });
    gcStart();
    return off;
  }, [ready]);

  /* ---------- the tick ---------- */

  useEffect(() => {
    if (!ready) return;
    const id = setInterval(() => {
      const now = Date.now();
      if (catching.current) return; // catch-up owns the game until it finishes (it resets the clock)
      const dt = (now - last.current) / 1000;
      last.current = now;
      if (dt <= 0) return;
      if (dt > 10) { catchUp(dt); return; } // JS timers were suspended (app was backgrounded); the catch-up saves nothing mid-way
      else {
        const { events, ach } = tick(game.current, dt);
        if (events.length) { pushLog(saleLines(events)); events.forEach((ev) => { if (!ev.bailout && !E.isAddon(ev.it.kind)) noteBuy(Math.min(ev.k, 2)); }); }
        announce(ach);
      }
      milestones();
      sinceSave.current += dt;
      if (sinceSave.current >= SAVE_EVERY_S) { sinceSave.current = 0; saveGame(game.current); push(); gcReport(game.current); }
      force((n) => n + 1);
    }, FRAME_MS);
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active' && game.current && !catching.current) { saveGame(game.current); push(); scheduleReminders(game.current); }
      if (st === 'active') cancelReminders();
    });
    return () => { clearInterval(id); sub.remove(); };
  }, [ready, catchUp, pushLog, announce, push, milestones]);

  /* ---------- actions ---------- */

  const hustle = useCallback(() => {
    if (!game.current) return;
    const r = doHustle(game.current);
    if (!r) return;
    if (r.log) pushLog([r.log]);
    announce(r.ach);
    setHustleResult(r.result);
    if (r.result.kind === 'sold') noteBuy(); else if (r.result.kind === 'passed') noteBrowse();
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
    push();
    say('🎫 +' + r.gain + ' tokens! Opening your new franchise…', 6000);
    force((n) => n + 1);
    return r.gain;
  }, [say, push]);

  const decide = useCallback((choice: number) => {
    if (!game.current) return;
    const r = CS.Offers.resolve(game.current, choice);
    if (!r) return;
    say(r.text);
    if (r.rev) pushLog([{ text: r.text.replace(/^\S+ /, ''), amt: r.rev }]);
    announce(E.checkAch(game.current) || []);
    force((n) => n + 1);
  }, [say, pushLog, announce]);

  const saveNow = useCallback(async () => {
    if (!game.current) return;
    await saveGame(game.current);
    sinceSave.current = 0;
    if (!tokenRef.current) { say('💾 Saved on this device'); return; }
    await push();
    say(syncStatusRef.current === 'ok' ? '☁️ Saved to your account' : '💾 Saved on this device. Cloud sync is waiting for a connection.');
  }, [say, push]);
  const syncStatusRef = useRef<SyncStatus>('off');
  syncStatusRef.current = sync.status;

  const reset = useCallback(async (): Promise<ResetResult> => {
    // Erase the cloud save first: if we erased only the phone, the next launch would pull the shop straight back.
    const t = tokenRef.current;
    if (t) {
      const r = await api.resetServer(t);
      if (!r.ok && r.status !== 401) return { ok: false, message: api.errorText(r.error) + " Your shop wasn't erased." };
    }
    log.current = [];
    pending.current = null;
    paused.current = false;
    setConflict(null);
    await clearGame();
    game.current = newGame();
    last.current = Date.now();
    setAway(null);
    if (t && userIdRef.current != null) { meta.current = { userId: userIdRef.current, rev: 0, at: Date.now() }; await saveSyncMeta(meta.current); }
    else { meta.current = null; await clearSyncMeta(); }
    force((n) => n + 1);
    return { ok: true };
  }, []);

  if (!ready) return null;
  const status: SyncStatus = auth.token ? sync.status : 'off';
  return (
    <GameContext.Provider
      value={{
        game: game.current, frame, refresh, log: log.current, toast, hustleResult, hustle, prestige, decide, notify: say, saveNow, away,
        dismissAway: () => setAway(null), catchProgress, reset, sync: { status, at: sync.at }, conflict, resolveConflict, syncNow,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}
