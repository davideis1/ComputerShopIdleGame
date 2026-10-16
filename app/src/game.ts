import CS from '@core';

export const E = CS.E;
export type GameState = any;

/** New game with a fresh Franchise (meta) record. */
export const newGame = (): GameState => E.newState();

/** Advance the shop by `dt` real seconds (1 game second per real second, like the web build). */
export function tick(s: GameState, dt: number) {
  const events: any[] = [];
  const ach: any[] = E.step(s, dt, 1, null, events) || [];
  return { events, ach };
}

export const year = (s: GameState): number => Math.floor(E.derive(s).y);

export type LogLine = { id: number; text: string; amt: number };

/** Collapse the engine's per-customer sale events into feed lines (same grouping as the web build). */
export function saleLines(events: any[]): { text: string; amt: number }[] {
  const agg: Record<string, { name: string; k: number; rev: number }> = {};
  const out: { text: string; amt: number }[] = [];
  events.forEach((ev) => {
    if (ev.bailout) { out.push({ text: '🏦 Out of cash! The bank lent you to restock.', amt: ev.bailout }); return; }
    const addon = E.isAddon(ev.it.kind);
    const key = addon ? 'addons' : ev.it.key;
    const a = agg[key] || (agg[key] = { name: addon ? 'Games & accessories' : ev.it.name, k: 0, rev: 0 });
    a.k += ev.k; a.rev += ev.rev;
  });
  Object.values(agg).forEach((a) => out.push({ text: (a.k > 1 ? a.k + '× ' : '') + a.name, amt: a.rev }));
  return out;
}

export type HustleResult = { kind: 'none' | 'passed' | 'sold'; text: string; rev?: number };

/** One hard-sell attempt. Returns null while on cooldown. */
export function hustle(s: GameState): { result: HustleResult; log?: { text: string; amt: number }; ach: any[] } | null {
  const r = E.hustle(s);
  if (!r) return null;
  if (r.none) return { result: { kind: 'none', text: 'Nothing in stock to sell!' }, ach: [] };
  if (r.passed) return { result: { kind: 'passed', text: 'Just browsing…' }, ach: [] };
  const n = r.extras ? r.extras.length : 0;
  return {
    result: { kind: 'sold', text: '+', rev: r.rev },
    log: { text: 'Hustled: ' + r.sold.name + (n ? ' + ' + n + ' add-on' + (n > 1 ? 's' : '') : ''), amt: r.rev },
    ach: E.checkAch(s) || [],
  };
}
