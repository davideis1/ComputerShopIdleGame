// Menu-tab logic ported from js/ui.js (renderMenu: statistics + trophies). Pure functions over core state.
import CS from '@core';
import { E, GameState } from './game';
import { dur, money, num } from './theme';

export type TroFilter = 'all' | 'earned' | 'locked';
export const TRO_FILTERS: { id: TroFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'earned', label: 'Earned' },
  { id: 'locked', label: 'Locked' },
];

export type Trophy = { id: string; name: string; desc: string; earned: boolean; progress: number }; // progress 0..1
export type MenuView = {
  stats: { label: string; value: string }[];
  trophies: Trophy[];
  trophyCount: string; // "5 / 40 (+5% customers)"
};

export const DEFAULT_NAME = 'Mega Byte Computers';
/** Rename the shop (same 30-character limit and fallback as the web build). */
export const setShopName = (s: GameState, name: string) => { s.name = name.slice(0, 30) || DEFAULT_NAME; };

export function buildMenuView(s: GameState, filter: TroFilter): MenuView {
  const d = E.derive(s);
  const st = s.stats;
  const got = CS.ACH.filter((a: any) => s.ach[a.id]).length;
  return {
    stats: [
      { label: 'Calendar', value: E.dateStr(d.y) },
      { label: 'Time played', value: dur(st.play) },
      { label: 'Time earning while away', value: dur(st.offline) },
      { label: 'Sales this franchise', value: money(st.revenue) },
      ...(s.meta.resets ? [
        { label: 'Sales, all franchises', value: money(s.meta.lifeRevenue + st.revenue) },
        { label: 'Items sold, all franchises', value: num(s.meta.lifeUnits + E.unitsSold(st)) },
      ] : []),
      { label: 'Computers sold', value: num(st.sold) },
      { label: 'Computers built', value: num(st.built) },
      { label: 'Games sold', value: num(st.soldGames) },
      { label: 'Accessories sold', value: num(st.soldAcc) },
      { label: 'Consoles sold', value: num(st.soldConsoles || 0) },
      { label: 'Console games & accessories sold', value: num((st.soldCGames || 0) + (st.soldCAcc || 0)) },
      { label: 'Hustles', value: num(st.hustles) },
      { label: 'Franchises opened', value: num(s.meta.resets) },
      { label: 'Offline limit', value: d.offlineCap / 3600 + 'h' },
    ],
    trophies: CS.ACH
      .filter((a: any) => filter === 'all' || (filter === 'earned') === !!s.ach[a.id])
      .map((a: any) => ({ id: a.id, name: a.name, desc: a.desc, earned: !!s.ach[a.id], progress: s.ach[a.id] ? 1 : Math.max(0, Math.min(1, a.p ? a.p(s) : 0)) })),
    trophyCount: got + ' / ' + CS.ACH.length + ' (+' + got + '% customers)',
  };
}
