import CS from '@core';
import { GameState } from './game';

/** Percent complete per trophy (the achievement ids of Game Center and Play Games): 100 once earned, else whole steps below. */
export function trophyProgress(s: GameState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const a of CS.ACH) {
    out[a.id] = s.ach[a.id] ? 100 : Math.max(0, Math.min(99, Math.floor((a.p ? a.p(s) : 0) * 100)));
  }
  return out;
}
