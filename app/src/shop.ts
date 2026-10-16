// Shop-tab logic ported from js/ui.js (renderShop / renderAdvisor). Pure functions over core state.
import CS from '@core';
import { E, GameState } from './game';
import { money, num } from './theme';

export type Alert = { lv: 'warn' | 'bad'; text: string };
export type Rec = any; // core/advisor.js analyze().recs entry
export type Insight = { lv: string; icon: string; text: string };

export type ShopView = {
  shelves: string; // emoji row
  stockInfo: string;
  alerts: Alert[];
  stats: { label: string; value: string }[];
  era: { name: string; from: number; blurb: string };
  events: { name: string; text: string }[];
  ended: boolean;
  date: string;
  income: number;
  recs: Rec[];
  insights: Insight[];
  more: number;
  fmtDur: (sec: number) => string;
};

export function buildShopView(s: GameState, advisor: boolean): ShopView {
  const d = E.derive(s);
  const items: any[] = E.getItems(s, d);
  const total = E.totalStock(s);

  // shelf icons (stock shown as little emoji, capped like the web build)
  let shelves = '', n = 0;
  items.forEach((it) => { for (let i = 0; i < Math.min(it.stock, 10) && n < 44; i++, n++) shelves += it.icon; });
  if (total > n) shelves += ' +' + (total - n);

  const alerts: Alert[] = [];
  const active = items.filter((i) => i.stock > 0).length;
  if (s.stats.sold === 0 && total === 0) alerts.push({ lv: 'warn', text: '👋 Welcome! Open the Stock tab, buy a computer, then hit Hustle to sell it. Set an auto-restock target once you hire a Stock Clerk (Upgrades).' });
  else if (!active) alerts.push({ lv: 'bad', text: '🚫 Shelves are empty — customers are walking out! Restock in the Stock tab.' });
  else if (d.lambda > d.serve * 1.05 && !advisor) alerts.push({ lv: 'warn', text: '⏳ Customers are waiting in line (' + d.lambda.toFixed(2) + '/s arriving vs ' + d.serve.toFixed(2) + '/s served). Upgrade checkout or hire sales staff.' });
  if (d.y >= 1995 && !d.office && s.stats.sold >= 60 && (s.up.clerk || 0) > 0) alerts.push({ lv: 'warn', text: '👔 Tip: a Purchasing Office (Upgrades → Shop) lets you hire buyers who manage your stock levels for you.' });
  if (s.stats.sold >= 15 && !d.aisleAcc) alerts.push({ lv: 'warn', text: '🖱️ Tip: open the Accessories Wall (Upgrades → Shop). Keyboards, monitors and modems carry fat margins, and PC buyers add them on.' });
  else if (s.stats.sold >= 60 && !d.aisleGame) alerts.push({ lv: 'warn', text: '💿 Tip: open the Software Aisle (Upgrades → Shop) to sell PC games.' });
  if (total >= d.cap && !advisor) alerts.push({ lv: 'warn', text: '📦 Shelves are full. Expand the shop floor to stock more.' });
  if (!(s.up.clerk > 0) && s.stats.sold > 0 && s.stats.sold < 40) alerts.push({ lv: 'warn', text: '💡 Tip: a Stock Clerk restocks automatically — even while you are away.' });
  if (d.upkeep * 60 > 0 && s.rate.rev < d.upkeep * 0.9 && s.stats.sold > 5) alerts.push({ lv: 'bad', text: '💸 Wages & rent are exceeding your sales.' });

  const era = E.eraAt(d.y);
  let rec: Rec[] = [], insights: Insight[] = [], more = 0;
  if (advisor) {
    const a = CS.Advisor.analyze(s, d, items);
    rec = a.recs.concat(a.tokenRec ? [a.tokenRec] : []);
    insights = a.insights;
    more = a.more;
  }

  return {
    shelves,
    stockInfo: 'Shelves ' + total + '/' + d.cap,
    alerts,
    stats: [
      { label: 'Customers / min', value: num(d.lambda * 60) },
      { label: 'Checkout capacity / min', value: num(d.serve * 60) },
      { label: 'Revenue / min', value: money(s.rate.rev * 60) },
      { label: 'Auto-restock / min', value: d.restock ? num(d.restock * 60) : 'none' },
      { label: 'Wages & rent / min', value: money(d.upkeep * 60) },
      { label: 'Walk-outs (busy)', value: num(s.stats.lost) },
      { label: 'Computers sold', value: num(s.stats.sold) },
      { label: 'Computers built', value: num(s.stats.built) },
      { label: 'Games sold', value: num(s.stats.soldGames) },
      { label: 'Accessories sold', value: num(s.stats.soldAcc) },
      { label: 'Consoles sold', value: num(s.stats.soldConsoles || 0) },
      { label: 'Console games sold', value: num((s.stats.soldCGames || 0) + (s.stats.soldCAcc || 0)) },
    ],
    era,
    events: d.ev.list,
    ended: s.cal >= CS.C.END_CAL,
    date: E.dateStr(d.y),
    income: s.rate.rev * 60,
    recs: rec,
    insights,
    more,
    fmtDur: CS.Advisor.fmt.dur,
  };
}

/** Buy what the advisor suggests (a shop upgrade or a permanent HQ upgrade). */
export const buyRec = (s: GameState, r: Rec) => (r.kind === 'tup' ? E.buyTokenUp(s, r.id) : E.buyUp(s, r.id));
export const recButtonLabel = (r: Rec, fmtDur: (n: number) => string) => {
  const tok = r.kind === 'tup';
  return r.afford
    ? (tok ? 'Buy — ' + num(r.cost) + ' 🎫' : 'Buy — ' + money(r.cost))
    : 'Save up — ' + money(r.cost) + (isFinite(r.eta) ? ' (about ' + fmtDur(r.eta) + ')' : '');
};
