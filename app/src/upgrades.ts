// Upgrades-tab logic ported from js/ui.js (renderUpgrades / upNow).
import CS from '@core';
import { E, GameState } from './game';
import { money, num } from './theme';

export type Upgrade = any; // core/data.js CS.UPGRADES entry
export type UpFilter = 'all' | 'afford' | 'open';

export const UP_GROUPS = ['Marketing', 'Checkout', 'Stock', 'Shop', 'Workshop', 'Service'];
export const UP_FILTERS: { id: UpFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'afford', label: 'Affordable now' },
  { id: 'open', label: 'Not maxed' },
];

/** What the upgrade is currently giving you at level L. */
export function upNow(u: Upgrade, L: number): string {
  const v = u.per * L;
  switch (u.kind) {
    case 'lambda': return '+' + num(v) + ' customers/s';
    case 'serve': return '+' + num(v) + ' served/s';
    case 'restock': return '+' + num(v) + ' units/s';
    case 'build': return '+' + num(v) + ' PCs/s';
    case 'cap': return '+' + v + ' shelf spaces';
    case 'disc': return '-' + (v * 100).toFixed(1) + '% costs';
    case 'loyal': return '+' + Math.round(v * 100) + '% customers';
    case 'night': return '+' + v + 'h offline';
    case 'serveMult': case 'buildMult': return '+' + Math.round(v * 100) + '%';
    case 'bench': return '+' + v + ' slots';
    case 'attach': return '+' + Math.round(v * 100) + '% add-on sales';
    default: return ''; // aisles and the office have no running total
  }
}

export type UpRow = {
  u: Upgrade;
  level: number;
  unlocked: boolean;
  maxed: boolean;
  cost: number;
  canBuy: boolean;
  lv: string;
  now: string;
  req: string;
  buyLabel: string;
};
export type UpView = {
  stats: { label: string; value: string }[];
  hint: string;
  sections: { title: string; data: UpRow[] }[];
};

export function buildUpgradesView(s: GameState, filter: UpFilter): UpView {
  const d = E.derive(s);
  const hint =
    d.lambda > d.serve * 1.05 ? 'Checkout is your bottleneck: customers are leaving. Upgrade checkout!'
    : d.serve > d.lambda * 1.5 ? 'Checkout has spare capacity — more marketing will pay off.'
    : 'Marketing and checkout are well balanced.';

  const sections = UP_GROUPS.map((g) => {
    const data: UpRow[] = CS.UPGRADES
      .filter((u: Upgrade) => u.grp === g && d.y >= u.year - 2 && !(u.req && !s.up[u.req] && d.y < u.year))
      .map((u: Upgrade): UpRow => {
        const level = E.upLevel(s, u.id);
        const unlocked = E.upUnlocked(s, u);
        const maxed = level >= u.max;
        const cost = E.upCost(s, u);
        return {
          u, level, unlocked, maxed, cost,
          canBuy: unlocked && !maxed && s.cash >= cost,
          lv: u.max === 1 ? (level ? '✔' : '') : 'Lv ' + level + (u.max < 999 ? '/' + u.max : ''),
          now: level && u.max > 1 ? 'Now: ' + upNow(u, level) : '',
          req: !unlocked ? (d.y < u.year ? '🔒 Available in ' + u.year : '🔒 Requires ' + CS.UP_BY_ID[u.req].name) : '',
          buyLabel: maxed ? (u.verb ? 'OPEN ✔' : 'MAX') : (u.max === 1 ? (u.verb || 'Build') + ' — ' : 'Buy — ') + money(cost),
        };
      })
      .filter((r: UpRow) => filter === 'all' || (filter === 'open' ? !r.maxed : !r.maxed && r.unlocked && s.cash >= r.cost));
    return { title: g, data };
  }).filter((sec) => sec.data.length);

  return {
    stats: [
      { label: 'Customers / s', value: num(d.lambda) },
      { label: 'Checkout / s', value: num(d.serve) },
      { label: 'Restock / s', value: d.restock ? num(d.restock) : '–' },
      { label: 'Shelf space', value: num(d.cap) },
    ],
    hint,
    sections,
  };
}

/** Buy one level. */
export const buyOne = (s: GameState, id: string) => E.buyUp(s, id);
/** Buy as many levels as you can afford (same 200-level cap as the web build). */
export function buyMax(s: GameState, id: string) {
  for (let i = 0; i < 200 && E.buyUp(s, id); i++);
}
