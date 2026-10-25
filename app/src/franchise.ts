// Franchise HQ logic ported from js/ui.js (renderFranchise, tupNow, claimTokens). Pure functions over core state.
import CS from '@core';
import { E, GameState } from './game';
import { money, num } from './theme';
import { UpFilter } from './upgrades';

export type TupRow = {
  u: any; // core/data.js CS.TOKEN_UPGRADES entry
  level: number;
  maxed: boolean;
  cost: number;
  canBuy: boolean;
  lv: string;
  now: string;
  buyLabel: string;
};
export type FranchiseView = {
  tokens: string;
  stats: { label: string; value: string }[];
  pending: number;
  barPct: number;
  nextText: string;
  claimLabel: string;
  canClaim: boolean;
  sections: { title: string; data: TupRow[] }[];
};

/** What an HQ upgrade is giving you at level L. */
export function tupNow(u: any, L: number): string {
  const v = u.per * L;
  switch (u.id) {
    case 't_cash': return '+' + money(v) + ' start cash';
    case 't_kit': return 'Start with ' + v + ' clerk/shelf/sales level' + (v > 1 ? 's' : '') + ', ' + 2 * v + ' ad levels';
    case 't_night': return '+' + v + 'h offline';
    case 't_mgr': return '+' + v + ' to every buyer skill';
    case 't_mgr_deal': return '-' + (v * 100).toFixed(1) + '% purchase costs';
    case 't_mgr_wage': return '-' + Math.round(v * 100) + '% wages';
    case 't_mgr_recruit': return '-' + Math.round(v * 100) + '% hiring costs';
    case 't_mgr_academy': return '-' + Math.round(v * 100) + '% training costs';
    case 't_mgr_speed': return '+' + Math.round(v * 100) + '% order speed';
    case 't_mgr_wide': return '+' + v + ' products per buyer';
    case 't_mgr_free': return v + ' free hire' + (v > 1 ? 's' : '') + ' per franchise';
    case 't_mgr_office': return 'Office open from the start';
    case 't_warp': return '+' + Math.round(v * 100) + '% calendar speed until 2015';
    case 't_head': return 'New franchises open in ' + (CS.C.START_YEAR + CS.C.HEAD_STARTS[Math.min(L, CS.C.HEAD_STARTS.length - 1)].cal);
    default: return '+' + Math.round(v * 100) + '%';
  }
}

/** The HQ tab (and its nav button) shows once tokens matter. Same rule as the web build. */
export function hqVisible(s: GameState): boolean {
  return s.meta.resets > 0 || s.meta.tokens > 0 || E.pendingTokens(s) > 0 || s.cal >= 20;
}
/** The Buyers tab shows once the Purchasing Office is open or about to be. */
export function buyersVisible(s: GameState): boolean {
  return !!E.derive(s).office || E.derive(s).y >= CS.UP_BY_ID.purchasing.year;
}

export function buildFranchiseView(s: GameState, filter: UpFilter): FranchiseView {
  const m = s.meta, pend = E.pendingTokens(s);
  const next = E.nextTokenAt(s);
  const prev = pend > 0 ? E.tokenAt(s, pend) : 0;
  const tlist = CS.TOKEN_UPGRADES.filter((u: any) => {
    if (filter === 'all') return true;
    const maxed = E.tl(s, u.id) >= u.max;
    return filter === 'open' ? !maxed : !maxed && m.tokens >= E.tokenCost(s, u);
  });
  const row = (u: any): TupRow => {
    const level = E.tl(s, u.id), cost = E.tokenCost(s, u), maxed = level >= u.max;
    return {
      u, level, maxed, cost, canBuy: !maxed && m.tokens >= cost,
      lv: 'Lv ' + level + '/' + u.max,
      now: level ? 'Now: ' + tupNow(u, level) : '',
      buyLabel: maxed ? 'MAX' : 'Buy — ' + num(cost) + ' 🎫',
    };
  };
  const sections = [
    { title: 'HQ Upgrades (permanent)', data: tlist.filter((u: any) => u.grp !== 'Buyers').map(row) },
    { title: 'Buyer upgrades (permanent)', data: tlist.filter((u: any) => u.grp === 'Buyers').map(row) },
  ].filter((sec) => sec.data.length);

  return {
    tokens: '🎫 ' + num(m.tokens),
    stats: [
      { label: 'This run: total sales', value: money(s.stats.revenue) },
      { label: 'Tokens ready to claim', value: num(pend) },
      { label: 'Franchises opened', value: num(m.resets) },
      { label: 'Tokens earned (all time)', value: num(m.earned) },
    ],
    pending: pend,
    barPct: Math.max(0, Math.min(100, (100 * (s.stats.revenue - prev)) / (next - prev))),
    nextText: pend < 1
      ? 'First token at ' + money(next) + ' in total sales this run.'
      : 'Next token at ' + money(next) + ' in total sales (' + money(Math.max(0, next - s.stats.revenue)) + ' to go).',
    claimLabel: pend >= 1 ? '🎫 Sell up & claim ' + num(pend) + ' token' + (pend > 1 ? 's' : '') : 'Reach ' + money(CS.C.TOKEN_R0) + ' in sales to claim tokens',
    canClaim: pend >= 1,
    sections,
  };
}

/** Text for the "open a new franchise?" confirmation. */
export function claimSummary(s: GameState) {
  const pend = E.pendingTokens(s);
  return {
    title: 'Open a new franchise?',
    body:
      `Sell this shop for ${pend} Franchise Token${pend > 1 ? 's' : ''} and start again in ${E.startYear(s)}.\n\n` +
      'HQ upgrades you buy before your first sale still apply to the new shop.\n\n' +
      `You keep: ${num(s.meta.tokens + pend)} tokens in total, your HQ upgrades, trophies, shop name and stats.\n\n` +
      `You lose: ${money(s.cash)} cash, shop upgrades, stock, blueprints and your place in history (${E.dateStr(E.yearOf(s))}).`,
  };
}

export const buyTokenUpgrade = (s: GameState, id: string) => E.buyTokenUp(s, id);
