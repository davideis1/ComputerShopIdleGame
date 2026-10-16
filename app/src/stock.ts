// Stock-room logic ported from js/ui.js (renderCatalog). Pure functions over core items.
import CS from '@core';
import { E, GameState } from './game';

export type Item = any; // core/engine.js getItems() entries
export type Cat = 'pre' | 'game' | 'acc' | 'con';
export type Age = 'all' | 'current' | 'old';
export type Shelf = 'all' | 'stocked' | 'empty';
export type SortId = 'new' | 'pop' | 'profit' | 'margin' | 'cheap' | 'pricey' | 'stock' | 'name';

export const CATS: { id: Cat; label: string }[] = [
  { id: 'pre', label: '🖥️ Computers' },
  { id: 'game', label: '💿 Games' },
  { id: 'acc', label: '🖱️ Accessories' },
  { id: 'con', label: '🎮 Consoles' },
];
const KINDS: Record<Cat, string[]> = { pre: ['pre'], game: ['game'], acc: ['acc'], con: ['console', 'cgame', 'cacc'] };
const AISLE: Record<Exclude<Cat, 'pre'>, { id: string; flag: string }> = {
  game: { id: 'aisle_games', flag: 'aisleGame' },
  acc: { id: 'aisle_acc', flag: 'aisleAcc' },
  con: { id: 'aisle_console', flag: 'aisleConsole' },
};

export const isCurrent = (it: Item) =>
  it.buyable && (it.kind === 'game' || it.kind === 'cgame' ? it.age <= 1.5 : it.kind === 'acc' || it.kind === 'cacc' ? it.age <= 4 : it.kind === 'console' ? it.age <= 3 : it.age <= 2);

export function ageTag(it: Item): string {
  if (!it.buyable) return 'Clearance';
  if (it.age < 0.7) return 'New!';
  if (it.kind === 'game' || it.kind === 'cgame') return it.age > 1.5 ? 'Bargain bin' : 'Current';
  if (it.kind === 'acc' || it.kind === 'cacc') return it.age > 4 ? 'Older model' : 'Current';
  if (it.kind === 'console') return it.limited ? 'Launch' : it.age > 3 ? 'Older model' : 'Current';
  if (it.age > 4) return 'Old stock';
  if (it.age > 2) return 'Aging';
  return 'Current';
}

export function subtitle(it: Item): string {
  const grp = it.group ? CS.GROUP_BY_ID[it.group] : null;
  switch (it.kind) {
    case 'console': return it.brand + ' · ' + it.def.year;
    case 'cgame': return 'Game · ' + it.def.year;
    case 'cacc': return (grp ? grp.name : 'Accessory') + ' · ' + it.def.year;
    case 'acc': return (grp ? grp.name : 'Accessory') + ' · ' + it.def.year;
    case 'game': return 'PC game · ' + it.def.year;
    default: return it.def.year + ' model';
  }
}

/** The one-line extra tag (PC compatibility, console launch status, install base). */
export function extraTag(it: Item): string | null {
  if (it.kind === 'game') return it.capF >= 0.95 ? '✅ Runs on your PCs' : it.capF >= 0.5 ? '⚠️ Marginal on your PCs' : '🚫 Too demanding for your PCs';
  if (it.kind === 'console') return it.limited ? '🔥 Launch frenzy · max ' + it.allocCap + ' per order window' : it.hype > 0.3 ? '🔥 Still hot' : CS.PLAT_BY_ID[it.plat].hand ? '🕹️ Handheld' : '🎮 Home console';
  if (it.kind === 'cgame' || it.kind === 'cacc') return '👥 ' + Math.round((it.owners || 0) * 100) + '% of shoppers own ' + CS.PLAT_BY_ID[it.plat].name;
  return null;
}

export const perfLabel = (it: Item) =>
  (it.kind === 'console' ? 'Appeal ' : E.isAddon(it.kind) ? 'Hype ' : 'Performance ') + Math.round(it.rel * 100) + '%';

export const SORTS: { id: SortId; label: string }[] = [
  { id: 'new', label: 'Newest' },
  { id: 'pop', label: 'Popular' },
  { id: 'profit', label: 'Profit' },
  { id: 'margin', label: 'Margin' },
  { id: 'cheap', label: 'Cheapest' },
  { id: 'pricey', label: 'Priciest' },
  { id: 'stock', label: 'In stock' },
  { id: 'name', label: 'A–Z' },
];
const sortFn = (id: SortId, pop: Record<string, number>) => {
  const m = (it: Item) => (it.price - it.cost) / it.price;
  switch (id) {
    case 'pop': return (a: Item, b: Item) => (pop[b.key] || 0) - (pop[a.key] || 0);
    case 'profit': return (a: Item, b: Item) => b.price - b.cost - (a.price - a.cost);
    case 'margin': return (a: Item, b: Item) => m(b) - m(a);
    case 'cheap': return (a: Item, b: Item) => a.price - b.price;
    case 'pricey': return (a: Item, b: Item) => b.price - a.price;
    case 'stock': return (a: Item, b: Item) => b.stock - a.stock;
    case 'name': return (a: Item, b: Item) => (a.brand + a.name).localeCompare(b.brand + b.name);
    default: return (a: Item, b: Item) => a.age - b.age || a.price - b.price;
  }
};

export type Filters = { age: Age; shelf: Shelf; sort: SortId; q: string };

export type StockView = {
  list: Item[];
  pop: Record<string, number>; // demand 0..1 within each group
  unlocked: boolean;
  aisle: { id: string; name: string; icon: string; desc: string; base: number } | null;
  clerk: boolean;
  used: number;
  cap: number;
};

/** Everything the Stock screen shows for one category + filter set. */
export function buildStockView(s: GameState, cat: Cat, f: Filters): StockView {
  const d = E.derive(s);
  const items: Item[] = E.getItems(s, d).filter((i: Item) => KINDS[cat].includes(i.kind));
  const raw = E.popularityMap(items, d);
  const max: Record<string, number> = {};
  items.forEach((i) => { const g = i.group || ''; max[g] = Math.max(max[g] || 1e-9, raw[i.key]); });
  const pop: Record<string, number> = {};
  items.forEach((i) => { pop[i.key] = raw[i.key] / max[i.group || '']; });

  const q = f.q.trim().toLowerCase();
  const list = items
    .filter((i) => {
      if (f.age === 'current' && !isCurrent(i)) return false;
      if (f.age === 'old' && isCurrent(i)) return false;
      if (f.shelf === 'stocked' && !(i.stock > 0 || i.target > 0)) return false;
      if (f.shelf === 'empty' && (i.stock > 0 || i.target > 0)) return false;
      if (q && !(i.brand + ' ' + i.name).toLowerCase().includes(q)) return false;
      return true;
    })
    .sort((a, b) => (Number(b.buyable) - Number(a.buyable)) || sortFn(f.sort, pop)(a, b));

  const a = cat === 'pre' ? null : AISLE[cat];
  return {
    list,
    pop,
    unlocked: !a || !!d[a.flag],
    aisle: a ? CS.UP_BY_ID[a.id] : null,
    clerk: (s.up.clerk || 0) + (s.up.warehouse || 0) + (s.up.robot || 0) > 0,
    used: E.totalStock(s),
    cap: d.cap,
  };
}

/** One tap on the +/- auto-restock stepper (steps by pack size, in bigger jumps once the target is large). */
export function stepTarget(s: GameState, it: Item, dir: 1 | -1) {
  const step = it.pack || 1;
  const big = it.target >= 10 * step ? 5 * step : step;
  E.setTarget(s, it.key, it.target + dir * big);
}

/** True if the player could afford and fit one more unit. */
export const canBuy = (s: GameState, it: Item, room: number) => it.buyable && s.cash >= it.cost && room >= (it.size || 1);
