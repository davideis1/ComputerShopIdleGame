/* Console gaming sanity check:  node tools/console-check.js
   Coverage of the catalogue by year, platform market shares, installed-base effect on game sales, launch allocation. */
require('../js/data.js'); require('../js/addons.js'); require('../js/engine.js'); require('../js/consoles.js'); require('../js/managers.js');
const CS = globalThis.CS, E = CS.E, Con = CS.Con;
const fmt = (n) => (n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : n.toFixed(0));
console.log('platforms', CS.PLATFORMS.length, '| consoles', CS.CONSOLES.length, '| games', CS.CGAMES.length, '| accessories', CS.CACCS.length);
let gaps = [];
for (let y = 1993; y <= 2026; y++) {
  const s = E.newState(); s.cal = y - 1993 + 0.5; s.up.aisle_console = 1;
  const d = E.derive(s), items = E.getItems(s, d);
  const hw = items.filter((i) => i.kind === 'console' && i.buyable).length, gm = items.filter((i) => i.kind === 'cgame' && i.buyable).length, ac = items.filter((i) => i.kind === 'cacc' && i.buyable).length;
  if (hw < 2 || gm < 8 || ac < 3) gaps.push(`${y}: ${hw} consoles/${gm} games/${ac} acc`);
}
console.log('coverage gaps:', gaps.length ? gaps.join(' | ') : 'none');
for (const y of [1994, 2000, 2008, 2015, 2022, 2026]) {
  const s = E.newState(); s.cal = y - 1993 + 0.5; s.up.aisle_console = 1;
  const d = E.derive(s);
  console.log(y, Con.market(s, d).slice(0, 5).map((m) => `${m.plat.name} ${(m.share * 100).toFixed(0)}% ${m.status}`).join(', '));
}

// installed-base effect: same shop, with and without having sold the platform's consoles
function run(year, ib) {
  const s = E.newState(); s.cal = year - 1993 + 0.2; s.cash = 5e6;
  Object.assign(s.up, { aisle_console: 1, ads_news: 15, ads_tv: 8, ads_web: 6, sales: 8, barcode: 8, shelf: 8, depot: 2 });
  if (ib) s.ib = { ps2: ib, xb: ib, gcn: ib };
  const d = E.derive(s);
  E.getItems(s, d).filter((i) => i.buyable && (i.kind === 'cgame' || i.kind === 'cacc') && i.age < 3).forEach((i) => { s.stock[i.key] = 200; });
  E.getItems(s, d).filter((i) => i.kind === 'pre' && i.buyable && i.age < 2).slice(0, 4).forEach((i) => { s.stock[i.key] = 100; });
  const t0 = s.stats.revenue; E.advance(s, 600, 1);
  return { games: s.stats.soldCGames, acc: s.stats.soldCAcc, rev: s.stats.addonRevenue };
}
console.log('\n2003, console games & accessories only (consoles not stocked):');
console.log('  no installed base   ', JSON.stringify(run(2003, 0)));
console.log('  500 consoles sold   ', JSON.stringify(run(2003, 500)));

// launch window: allocation and hype
{
  const s = E.newState(); s.cal = 2020 - 1993 + 0.1; s.cash = 5e7; Object.assign(s.up, { aisle_console: 1, ads_news: 20, ads_tv: 10, ads_web: 8, ads_ecom: 5, sales: 10, barcode: 10, pos: 4, shelf: 8, depot: 6, clerk: 6 });
  const d = E.derive(s);
  const ps5 = E.getItems(s, d).find((i) => i.id === 'ps5');
  console.log('\nPlayStatic 5 launch (Feb 2020): hype', ps5.hype.toFixed(2), 'allocation cap', ps5.allocCap, 'cost', Math.round(ps5.cost), 'price', Math.round(ps5.price));
  console.log('buying 1000 at launch ->', E.buy(s, ps5.key, 1000), 'units allowed');
  E.setTarget(s, ps5.key, 400);
  E.advance(s, 1200, 1);
  const e = E.getItems(s, E.derive(s)).find((i) => i.id === 'ps5');
  console.log('after 20 min: stock', e.stock, '| sold consoles', s.stats.soldConsoles, '| ib', JSON.stringify(s.ib), '| revenue', fmt(s.stats.consoleRevenue));
}
// round trip + offline
{
  const s = E.newState(); s.cal = 10; s.cash = 1e6; s.up.aisle_console = 1; s.ib = { ps2: 50 };
  const r = E.deserialize(E.serialize(s));
  console.log('\nroundtrip ib', JSON.stringify(r.ib), 'stats', r.stats.soldConsoles);
}

// revenue mix of a fully stocked shop
for (const y of [1996, 2003, 2012, 2022]) {
  const s = E.newState(); s.cal = y - 1993 + 0.4; s.cash = 5e7;
  Object.assign(s.up, { aisle_console: 1, aisle_acc: 1, aisle_games: 1, ads_news: 20, ads_tv: 12, ads_web: 8, ads_ecom: 4, sales: 10, barcode: 10, pos: 3, shelf: 10, depot: 4, dc: 2 });
  const d = E.derive(s);
  const items = E.getItems(s, d).filter((i) => i.buyable && (i.age < (i.kind === 'cacc' || i.kind === 'acc' ? 4 : i.kind === 'console' ? 3 : 2)));
  items.forEach((i) => { s.stock[i.key] = i.kind === 'pre' ? 120 : i.kind === 'console' ? 80 : 400; });
  const rev = {}; const evs = [];
  const rep = E.newReport();
  for (let t = 0; t < 600; t++) { const ev = []; E.step(s, 1, 1, rep, ev); ev.forEach((e) => { if (e.it) { const k = e.it.kind; rev[k] = (rev[k] || 0) + e.rev; } }); }
  const tot = Object.values(rev).reduce((a, b) => a + b, 0);
  console.log(y, 'revenue', fmt(tot), Object.entries(rev).map(([k, v]) => `${k} ${(100 * v / tot).toFixed(0)}%`).join(', '), '| consoles/min', (s.stats.soldConsoles / 10).toFixed(1), 'cgames/min', (s.stats.soldCGames / 10).toFixed(1));
}
