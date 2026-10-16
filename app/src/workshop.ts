// Workshop-tab logic ported from js/ui.js (renderWorkshop, syncSelect, createBpCard). Pure functions over core state.
import CS from '@core';
import { E, GameState } from './game';
import { money, num } from './theme';

export type BpFilter = 'all' | 'build' | 'old';
export type BpSort = 'new' | 'profit' | 'perf' | 'stock';
export const BP_FILTERS: { id: BpFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'build', label: 'Buildable' },
  { id: 'old', label: 'Discontinued parts' },
];
export const BP_SORTS: { id: BpSort; label: string }[] = [
  { id: 'new', label: 'Newest' },
  { id: 'profit', label: 'Profit per PC' },
  { id: 'perf', label: 'Performance' },
  { id: 'stock', label: 'Most in stock' },
];

export type Design = { name: string; parts: Record<string, string>; markup: number };
export const newDesign = (): Design => ({ name: 'My Custom PC', parts: {}, markup: 0.6 });

export type PartOption = { id: string; label: string; tier: string; name: string; price: string; perf: number };
export type SlotView = { id: string; icon: string; name: string; selected: string; price: string; options: PartOption[] };

export type BpRow = {
  it: any; // engine item (kind 'bp')
  spec: string;
  perf: string;
  warn: boolean;
  auto: boolean;
  cost: number; price: number; profit: number;
  markupPct: number;
};

export type WorkshopView = {
  locked: null | { kind: 'year' | 'buy'; year: number; desc: string; cost: number; canBuy: boolean };
  stats: { label: string; value: string }[];
  hint: string;
  rows: BpRow[];
  totalBps: number;
  slots: SlotView[];
  parts: Record<string, string>; // the design with any now-discontinued picks replaced
  info: { cost: number; price: number; profit: number; perf: number };
  full: boolean;
  msg: string;
};

const partLabel = (p: any, d: any) => `${p.tier} · ${p.name} — ${money(E.partPrice(p, d))} · ${Math.round(E.partRel(p, d.y) * 100)}%`;

function slotParts(slotId: string, d: any): any[] {
  return CS.PARTS
    .filter((p: any) => p.slot === slotId && E.partAvail(p, d.y))
    .sort((a: any, b: any) => (b.rolling ? 0 : b.year) - (a.rolling ? 0 : a.year) || b.q - a.q);
}

export function buildWorkshopView(s: GameState, f: BpFilter, sort: BpSort, design: Design): WorkshopView {
  const d = E.derive(s);
  const u = CS.UP_BY_ID.workshop;
  const blank = { stats: [], hint: '', rows: [], totalBps: 0, slots: [], parts: {}, info: { cost: 0, price: 0, profit: 0, perf: 0 }, full: false, msg: '' };
  if (!d.workshop) {
    const cost = E.upCost(s, u);
    return { ...blank, locked: { kind: d.y < u.year ? 'year' : 'buy', year: u.year, desc: u.desc, cost, canBuy: s.cash >= cost } };
  }

  const items: any[] = E.getItems(s, d);
  const bpItems = items.filter((i) => i.kind === 'bp');
  const sorts: Record<BpSort, (a: any, b: any) => number> = {
    new: (a, b) => b.def.id.slice(2) - a.def.id.slice(2),
    profit: (a, b) => b.price - b.cost - (a.price - a.cost),
    perf: (a, b) => b.rel - a.rel,
    stock: (a, b) => b.stock - a.stock,
  };
  const rows: BpRow[] = bpItems
    .filter((i) => f === 'all' || (f === 'build') === i.canBuild)
    .sort(sorts[sort])
    .map((it) => ({
      it,
      spec: CS.SLOTS.map((sl: any) => CS.PART_BY_ID[it.def.parts[sl.id]].name).join(' · '),
      perf: 'Performance ' + Math.round(it.rel * 100) + '%',
      warn: !it.canBuild,
      auto: it.def.by === 'designer',
      cost: it.cost, price: it.price, profit: it.price - it.cost,
      markupPct: Math.round(it.def.markup * 100),
    }));

  // Part pickers. A pick that has since been discontinued falls back to the newest Standard part.
  const parts: Record<string, string> = {};
  const slots: SlotView[] = CS.SLOTS.map((sl: any) => {
    const list = slotParts(sl.id, d);
    let sel = design.parts[sl.id];
    if (!list.find((p) => p.id === sel)) {
      const pick = list.filter((p) => p.tier === 'Standard').sort((a, b) => b.year - a.year)[0] || list[0];
      sel = pick ? pick.id : '';
    }
    parts[sl.id] = sel;
    const cur = CS.PART_BY_ID[sel];
    return {
      id: sl.id, icon: sl.icon, name: sl.name, selected: sel,
      price: cur ? money(E.partPrice(cur, d)) : '',
      options: list.map((p: any) => ({ id: p.id, label: partLabel(p, d), tier: p.tier, name: p.name, price: money(E.partPrice(p, d)), perf: Math.round(E.partRel(p, d.y) * 100) })),
    };
  });
  const di = E.designInfo(parts, design.markup, d);
  const full = s.bps.length >= d.benchSlots;

  return {
    locked: null,
    stats: [
      { label: 'Build speed / min', value: d.build ? num(d.build * 60) : 'No technicians' },
      { label: 'Blueprint slots', value: s.bps.length + ' / ' + d.benchSlots },
      { label: 'Built PCs in stock', value: num(bpItems.reduce((a, i) => a + i.stock, 0)) },
    ],
    hint: d.build
      ? "Technicians build PCs up to each blueprint's auto-build target and pay for parts as they go. Old parts are discontinued after ~6 years — design a fresh blueprint then."
      : 'Hire Build Technicians in Upgrades — they build your blueprints automatically.',
    rows, totalBps: bpItems.length, slots, parts,
    info: { cost: di.cost, price: di.price, profit: di.price - di.cost, perf: Math.round(di.rel * 100) },
    full,
    msg: full
      ? 'All blueprint slots are used. Delete an empty blueprint or buy a Design Bench.'
      : 'Customers weigh performance against price. Enthusiasts pay for power; bargain hunters want cheap.',
  };
}

/* ---------- actions ---------- */
export const buildWorkshop = (s: GameState) => E.buyUp(s, 'workshop');
export function saveBlueprint(s: GameState, design: Design, parts: Record<string, string>): { ok: boolean; msg: string; ach: any[] } {
  const r = E.createBp(s, design.name.trim() || 'Custom PC', parts, design.markup);
  return r.ok ? { ok: true, msg: 'Blueprint saved: ' + r.bp.name + '. Set an auto-build target to start production.', ach: E.checkAch(s) || [] } : { ok: false, msg: r.err, ach: [] };
}
export const deleteBlueprint = (s: GameState, id: string) => E.deleteBp(s, id);
export const takeOver = (s: GameState, id: string) => CS.M.takeOver(s, id);
export const setMarkup = (s: GameState, id: string, pct: number) => {
  const bp = s.bps.find((b: any) => b.id === id);
  if (bp) bp.markup = Math.max(0, Math.min(2, pct / 100));
};
/** One tap on the +/- auto-build stepper (same stepping as the Stock tab). */
export function stepBpTarget(s: GameState, it: any, dir: 1 | -1) {
  const step = it.pack || 1;
  const big = it.target >= 10 * step ? 5 * step : step;
  E.setTarget(s, it.key, it.target + dir * big);
}
/** Pin = you set this item's target; skip = the buyer never stocks it. Tapping the active one clears it. */
export function togglePin(s: GameState, it: any, want: 'pin' | 'skip') {
  if (it.mgrCat) CS.M.setPin(s, it.mgrCat, it.key, it.pin === want ? '' : want);
}
export const pinLabels = (it: any) => ({
  info: it.managed ? '👔 Manager sets the target: ' + it.target : it.pin === 'skip' ? '🚫 Manager skips this' : '📌 You set this one',
  pin: it.pin === 'pin' ? 'Hand to manager' : 'Set it myself',
  skip: it.pin === 'skip' ? 'Allow again' : 'Never stock',
});
