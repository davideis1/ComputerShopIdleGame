import CS from '@core';
import { E, GameState } from './game';

/** The Service tab shows once the Service Desk is open or about to be (same rule as the web nav). */
export function serviceVisible(s: GameState): boolean {
  return !!E.derive(s).service || E.derive(s).y >= CS.UP_BY_ID.svc_desk.year;
}
