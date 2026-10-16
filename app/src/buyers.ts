// Buyers-tab logic ported from js/ui.js (renderBuyers, MC_SPEC / DESIGN_SPEC). Pure functions over core state.
import CS from '@core';
import { E, GameState } from './game';
import { money, num } from './theme';

const M = CS.M;

export type Ctl = {
  k: string;
  t: 'select' | 'range' | 'num' | 'text' | 'toggle' | 'chips';
  l: string;
  o?: any; // select options: [value, label][] or a function returning them
  min?: number;
  max?: number | 'skus' | 'bench';
  step?: number;
  f?: (v: number) => string;
  hide?: string[];
  only?: string[];
  req?: [string, number];
  maxlength?: number;
};
type Group = { grp: string; ctl: Ctl[] };

const presetOpts = (o: Record<string, any>) => () => Object.entries(o).map(([v, p]) => [v, p.label]).concat([['custom', 'Custom (your own settings)']]);

export const MC_SPEC: Group[] = [
  { grp: 'Strategy', ctl: [
    { k: 'preset', t: 'select', l: 'Preset', o: presetOpts(CS.MGR_PRESETS) },
    { k: 'priority', t: 'select', l: 'Prioritise', o: [['balanced', 'Balanced'], ['profit', 'Profit per sale'], ['volume', 'Best sellers'], ['margin', 'Highest margin']] },
    { k: 'coverage', t: 'range', l: 'Stock cover', min: 0.5, max: 20, step: 0.5, f: (v) => v + ' min of sales' },
    { k: 'safety', t: 'range', l: 'Safety buffer', min: 0, max: 100, step: 5, f: (v) => v + '%' },
    { k: 'maxSkus', t: 'range', l: 'Products stocked at once', min: 1, max: 'skus', step: 1, f: (v) => String(v) },
  ] },
  { grp: 'Budget & space', ctl: [
    { k: 'reserveCash', t: 'num', l: 'Never spend below ($)', min: 0, hide: ['bp'] },
    { k: 'maxOrderPct', t: 'range', l: 'Max share of free cash per order', min: 5, max: 100, step: 5, f: (v) => v + '%', hide: ['bp'] },
    { k: 'maxSpacePct', t: 'range', l: 'Shelf-space allowance', min: 5, max: 100, step: 5, f: (v) => v + '% of shelves' },
  ] },
  { grp: 'What to stock', ctl: [
    { k: 'age', t: 'select', l: 'Age policy', o: [['current', 'Current models only'], ['new', 'New releases only (up to 1 year)'], ['any', 'Anything still orderable']], hide: ['bp'] },
    { k: 'maxAge', t: 'range', l: '"Current" means up to', min: 0.5, max: 8, step: 0.5, f: (v) => v + ' years old', hide: ['bp'] },
    { k: 'minMargin', t: 'range', l: 'Minimum margin', min: 0, max: 60, step: 5, f: (v) => (v ? v + '%' : 'any') },
    { k: 'maxPrice', t: 'num', l: 'Max unit price ($, 0 = no limit)', min: 0 },
    { k: 'blocked', t: 'chips', l: 'Never buy from (tap to block)', hide: ['bp'] },
    { k: 'groups', t: 'chips', l: 'Only these groups (none selected = all)', only: ['acc'] },
    { k: 'platforms', t: 'chips', l: 'Only these platforms (none selected = all)', only: ['con'] },
  ] },
  { grp: 'Trends & pricing', ctl: [
    { k: 'sensitivity', t: 'range', l: 'Trend sensitivity', min: 0, max: 100, step: 5, f: (v) => (v < 34 ? 'slow & steady' : v < 67 ? 'moderate' : 'quick to react') },
    { k: 'anticipate', t: 'toggle', l: 'Plan ahead for market events', req: ['forecast', 4] },
    { k: 'preBuy', t: 'toggle', l: 'Time purchases around price spikes', req: ['forecast', 6], only: ['pre', 'bp'] },
    { k: 'testSize', t: 'range', l: 'Test order for new releases', min: 0, max: 12, step: 1, f: (v) => (v ? v + ' units' : 'none'), hide: ['bp'] },
    { k: 'mdOn', t: 'toggle', l: 'Mark down older stock', hide: ['bp'] },
    { k: 'mdAge', t: 'range', l: '…once older than', min: 0.5, max: 6, step: 0.5, f: (v) => v + ' years', hide: ['bp'] },
    { k: 'mdPct', t: 'range', l: '…by', min: 5, max: 60, step: 5, f: (v) => v + '% off', hide: ['bp'] },
  ] },
  { grp: 'Reports', ctl: [{ k: 'log', t: 'toggle', l: 'Keep a notebook of decisions' }] },
];

export const DESIGN_SPEC: Group[] = [
  { grp: 'Strategy', ctl: [
    { k: 'preset', t: 'select', l: 'Preset', o: presetOpts(CS.DESIGN_PRESETS) },
    { k: 'maxDesigns', t: 'range', l: 'Designs to keep at once', min: 1, max: 'bench', step: 1, f: (v) => String(v) },
    { k: 'reserveSlots', t: 'range', l: 'Keep blueprint slots free for me', min: 0, max: 'bench', step: 1, f: (v) => (v ? v + ' slot' + (v > 1 ? 's' : '') : 'none') },
    { k: 'tiers', t: 'chips', l: 'Part tiers to use (tap to toggle)' },
    { k: 'diversity', t: 'range', l: 'Appetite for a second design of the same kind', min: 0, max: 1, step: 0.05, f: (v) => (v >= 0.85 ? 'happy to' : v >= 0.5 ? 'sometimes' : 'avoid') },
  ] },
  { grp: 'Pricing', ctl: [
    { k: 'priceMode', t: 'select', l: 'Pricing', o: [['auto', 'Follow the market (needs Market sense 2)'], ['fixed', 'Fixed markup']] },
    { k: 'fixedMarkup', t: 'range', l: 'Fixed markup', min: 0, max: 1.5, step: 0.05, f: (v) => '+' + Math.round(v * 100) + '%' },
    { k: 'minMarkup', t: 'range', l: 'Lowest markup to try', min: 0, max: 1.5, step: 0.05, f: (v) => '+' + Math.round(v * 100) + '%' },
    { k: 'maxMarkup', t: 'range', l: 'Highest markup to try', min: 0, max: 2, step: 0.05, f: (v) => '+' + Math.round(v * 100) + '%' },
    { k: 'minMargin', t: 'range', l: 'Minimum margin', min: 0, max: 60, step: 5, f: (v) => (v ? v + '%' : 'any') },
    { k: 'maxBuildCost', t: 'num', l: 'Max build cost per PC ($, 0 = no limit)', min: 0 },
  ] },
  { grp: 'Parts & stock', ctl: [
    { k: 'allowIgp', t: 'toggle', l: 'Use integrated graphics in cheap designs' },
    { k: 'allowFree', t: 'toggle', l: 'Use the free OS in budget designs' },
    { k: 'setTargets', t: 'toggle', l: 'Set auto-build targets (unless a Custom Builds buyer is on duty)' },
    { k: 'coverage', t: 'range', l: 'Stock cover', min: 0.5, max: 20, step: 0.5, f: (v) => v + ' min of sales' },
    { k: 'reserveCash', t: 'num', l: 'Never pay a design fee below ($)', min: 0 },
    { k: 'refreshAge', t: 'range', l: 'Replace designs older than', min: 1, max: 6, step: 0.5, f: (v) => v + ' years (when slots are needed)' },
    { k: 'autoRetire', t: 'toggle', l: 'Delete obsolete designs once sold out' },
  ] },
  { grp: 'Reports', ctl: [
    { k: 'namePrefix', t: 'text', l: 'Name prefix for new designs', maxlength: 12 },
    { k: 'log', t: 'toggle', l: 'Keep a notebook of decisions' },
  ] },
];

const catDef = (id: string) => CS.MGR_CATS.find((c: any) => c.id === id);
const specFor = (cat: string) => (catDef(cat).designer ? DESIGN_SPEC : MC_SPEC);

function brandsOf(cat: string): string[] {
  const set = new Set<string>();
  if (cat === 'pre') CS.PRODUCTS.forEach((p: any) => set.add(p.brand));
  else if (cat === 'con') CS.PLATFORMS.forEach((p: any) => set.add(p.maker));
  else CS.ADDONS.filter((a: any) => a.kind === cat).forEach((a: any) => set.add(a.brand));
  return Array.from(set).sort();
}
function chipOptions(cat: string, k: string): { id: string; label: string }[] {
  if (k === 'platforms') return CS.PLATFORMS.map((p: any) => ({ id: p.id, label: p.name }));
  if (k === 'tiers') return ['Budget', 'Standard', 'Premium'].map((x) => ({ id: x, label: x }));
  if (k === 'groups') return CS.GROUPS.filter((g: any) => g.kind === 'acc').map((g: any) => ({ id: g.id, label: g.icon + ' ' + g.name }));
  return brandsOf(cat).map((b) => ({ id: b, label: b })); // 'blocked'
}

const trendArrow = (tr: number | null | undefined) => (tr == null ? '' : tr > 0.25 ? '↗' : tr < -0.25 ? '↘' : '→');

/* ---------- view model ---------- */

export type CtlView = {
  ctl: Ctl;
  value: any;
  display: string; // current value label (ranges)
  locked: boolean;
  lockText: string;
  min: number;
  max: number;
  options: { id: string; label: string }[]; // select + chips options
};
export type CandView = { idx: number; key: string; icon: string; title: string; desc: string; skills: string; wage: string; bonus: number; label: string };
export type SkillView = { id: string; name: string; icon: string; desc: string; lv: string; pct: number; maxed: boolean; cost: number; trainLabel: string; canTrain: boolean };
export type CatView = {
  id: string; name: string; icon: string; designer: boolean;
  avail: boolean; need: string; staffed: boolean;
  summary: string;
  cands: CandView[]; refreshLabel: string; canRefresh: boolean;
  person: string; trait: string; on: boolean;
  stats: { label: string; value: string }[];
  stance: string;
  skills: SkillView[];
  planTitle: string;
  plan: { name: string; stock: string; why: string }[];
  offNote: boolean;
  emptyPlan: boolean;
  groups: { grp: string; ctls: CtlView[] }[];
  log: string[];
};
export type BuyersView = {
  locked: null | { kind: 'year' | 'buy'; year: number; desc: string; cost: number; canBuy: boolean };
  stats: { label: string; value: string }[];
  wages: string;
  cats: CatView[];
};

export function buildBuyersView(s: GameState): BuyersView {
  const d = E.derive(s);
  const u = CS.UP_BY_ID.purchasing;
  if (!d.office) {
    return { locked: { kind: d.y < u.year ? 'year' : 'buy', year: u.year, desc: u.desc, cost: u.base, canBuy: s.cash >= u.base }, stats: [], wages: '', cats: [] };
  }
  let n = 0, ordered = 0, saved = 0;
  CS.MGR_CATS.forEach((c: any) => { const mg = s.mgr[c.id]; if (mg) { n++; ordered += mg.stats.ordered; saved += mg.stats.saved; } });
  const items: any[] = E.getItems(s, d);
  const byKey: Record<string, any> = {};
  items.forEach((i) => (byKey[i.key] = i));

  const cats = CS.MGR_CATS.map((c: any): CatView => {
    const mg = s.mgr[c.id];
    const avail = M.available(d, c.id);
    const base = { id: c.id, name: c.name, icon: c.icon, designer: !!c.designer, avail, staffed: !!mg };
    const empty = { cands: [], refreshLabel: '', canRefresh: false, person: '', trait: '', on: false, stats: [], stance: '', skills: [], planTitle: '', plan: [], offNote: false, emptyPlan: false, groups: [], log: [], summary: '', need: '' };

    if (!mg) {
      const need = avail ? '' : c.id === 'bp' || c.designer ? 'Needs the Build Workshop.' : c.id === 'game' ? 'Needs the Software Aisle.' : c.id === 'con' ? 'Needs the Console Corner.' : 'Needs the Accessories Wall.';
      const cands: CandView[] = (avail ? M.candidates(s, c.id) : []).map((x: any, idx: number) => {
        const tr = CS.MGR_TRAITS[x.trait];
        const bonus = M.bonusFor(s, x.wage, d.y);
        return {
          idx, key: x.name, icon: tr.icon, title: x.name + ' — ' + tr.name, desc: tr.desc,
          skills: CS.MGR_SKILLS.map((sk: any) => sk.icon + ' ' + x.skills[sk.id]).join('   '),
          wage: 'Wage ' + money(x.wage * M.wageInfl(d.y) * 60) + '/min · signing bonus ' + money(bonus),
          bonus, label: bonus ? 'Hire for ' + money(bonus) : 'Hire (no signing bonus)',
        };
      });
      const rc = M.refreshCost(s, d);
      return { ...base, ...empty, need, cands, refreshLabel: 'Look for other candidates — ' + money(rc), canRefresh: avail && s.cash >= rc, summary: avail ? 'No one hired yet. Expand to see candidates.' : '🔒 Not available yet.' };
    }

    const m = d.mgr.cats[c.id], cfg = M.cfgOf(s, c.id), tr = CS.MGR_TRAITS[mg.trait];
    const skills: SkillView[] = CS.MGR_SKILLS.map((sk0: any) => {
      const name = (c.skillNames || {})[sk0.id] || sk0.name, desc = (c.skillDescs || {})[sk0.id] || sk0.desc;
      const lvl = mg.skills[sk0.id], eff = m.eff[sk0.id], cost = M.trainCost(s, mg, sk0.id, d), maxed = lvl >= M.MAX_LEVEL;
      return {
        id: sk0.id, name, icon: sk0.icon, desc,
        lv: 'Lv ' + lvl + (eff > lvl ? ' (+' + (eff - lvl) + ' HQ)' : '') + ' / ' + M.MAX_LEVEL,
        pct: Math.min(eff, M.MAX_LEVEL) / M.MAX_LEVEL,
        maxed, cost, trainLabel: maxed ? 'MAX' : 'Train — ' + money(cost), canTrain: !maxed && s.cash >= cost,
      };
    });
    const plan = mg.plan.slice().sort((a: any, b: any) => b.t - a.t).map((p: any) => ({
      name: p.name,
      stock: (byKey[p.k] ? byKey[p.k].stock : 0) + ' / ' + p.t,
      why: trendArrow(p.tr) + ' ' + p.why + ' · ' + p.v.toFixed(p.v < 10 ? 1 : 0) + '/min',
    }));

    const groups = specFor(c.id).map((g) => {
      const ctls = g.ctl.filter((x) => (!x.hide || !x.hide.includes(c.id)) && (!x.only || x.only.includes(c.id))).map((x): CtlView => {
        const v = cfg[x.k];
        const locked = !!x.req && m.eff[x.req[0]] < x.req[1];
        const max = x.max === 'skus' ? m.maxSkus : x.max === 'bench' ? d.benchSlots : (x.max as number) ?? 0;
        const value = x.t === 'range' ? Math.min(v, max) : v;
        let options: { id: string; label: string }[] = [];
        if (x.t === 'select') options = (typeof x.o === 'function' ? x.o() : x.o).map(([id, label]: [string, string]) => ({ id, label }));
        else if (x.t === 'chips') options = chipOptions(c.id, x.k);
        return {
          ctl: x, value, min: x.min ?? 0, max, locked, options,
          display: x.t === 'range' && x.f ? x.f(value) : '',
          lockText: locked ? '🔒 Needs ' + ((c.skillNames || {})[x.req![0]] || CS.MGR_SKILLS.find((k: any) => k.id === x.req![0]).name) + ' ' + x.req![1] : '',
        };
      });
      return { grp: g.grp, ctls };
    }).filter((g) => g.ctls.length);

    return {
      ...base, need: '', cands: [], refreshLabel: '', canRefresh: false,
      summary: tr.icon + ' ' + (cfg.on ? 'On duty' : '😴 Off duty') + ' · ' + mg.plan.length + ' product' + (mg.plan.length === 1 ? '' : 's') + ' planned · ordered ' + num(mg.stats.ordered) + ' · saved ' + money(mg.stats.saved) + (mg.stance ? (mg.stance === 'prebuy' ? ' · 🛒 buying ahead' : ' · ⏳ holding back') : ''),
      person: tr.icon + ' ' + mg.name + ' (' + tr.name + ')',
      trait: tr.desc + ' Wage ' + money(m.wage * 60) + '/min.',
      on: !!cfg.on,
      stats: (c.designer
        ? [['Designs made', num(mg.stats.ordered)], ['Design fees', money(mg.stats.spent)], ['Quality bonus', '+' + m.eff.negotiate + '%'], ['Active designs', String(mg.plan.length)]]
        : [['Units ordered', num(mg.stats.ordered)], ['Spent', money(mg.stats.spent)], ['Saved (deals)', money(mg.stats.saved)], ['Products planned', String(mg.plan.length)]]
      ).map(([label, value]) => ({ label, value })),
      stance: cfg.on && mg.stance ? (mg.stance === 'prebuy' ? '🛒 Buying ahead of a price spike.' : '⏳ Holding back while prices are inflated.') : '',
      skills,
      planTitle: c.designer ? 'Current designs' : "This week's plan",
      plan, offNote: !cfg.on, emptyPlan: !plan.length && !!cfg.on,
      groups,
      log: (mg.log || []).slice(0, 8).map((l: any) => l.txt),
    };
  });

  return {
    locked: null,
    stats: [
      { label: 'Buyers employed', value: n + ' / ' + CS.MGR_CATS.length },
      { label: 'Units ordered', value: num(ordered) },
      { label: 'Saved by negotiating', value: money(saved) },
      { label: 'Wages / min', value: money(d.mgr.wages * 60) },
    ],
    wages: n ? 'Wages ' + money(d.mgr.wages * 60) + '/min' : '',
    cats,
  };
}

/** Severance is one hour of wages, shown in the confirm dialog. */
export const severance = (s: GameState, cat: string) => {
  const mg = s.mgr[cat];
  return mg ? Math.round(mg.wage * M.wageInfl(E.yearOf(s)) * 3600) : 0;
};

export const hire = (s: GameState, cat: string, idx: number) => M.hire(s, cat, idx);
export const refreshCands = (s: GameState, cat: string) => M.refresh(s, cat);
export const train = (s: GameState, cat: string, skill: string) => M.train(s, cat, skill);
export const fire = (s: GameState, cat: string) => M.fire(s, cat);
export const setCfg = (s: GameState, cat: string, k: string, v: any) => M.setCfg(s, cat, k, v);
export const toggleChip = (s: GameState, cat: string, k: string, v: string) => {
  const cur: string[] = M.cfgOf(s, cat)[k].slice();
  const i = cur.indexOf(v);
  if (i >= 0) cur.splice(i, 1); else cur.push(v);
  M.setCfg(s, cat, k, cur);
};
export const openOffice = (s: GameState) => E.buyUp(s, 'purchasing');
