import CS from '@core';

export const E = CS.E;
export type GameState = any;

/** New game with a fresh Franchise (meta) record. */
export const newGame = (): GameState => E.newState();

/** Advance the shop by `dt` real seconds (1 game second per real second, like the web build). */
export function tick(s: GameState, dt: number) {
  const events: unknown[] = [];
  E.step(s, dt, 1, null, events);
  return events;
}

/** Offline catch-up uses the same simulation in bulk (see E.offline). */
export const offline = (s: GameState, seconds: number) => E.offline(s, seconds);

export const dateLabel = (s: GameState) => {
  const d = E.derive(s);
  return { year: Math.floor(d.y), d };
};
