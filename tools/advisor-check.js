/* Prints what the shop advisor would say in a few typical situations:  node tools/advisor-check.js */
require('../js/data.js'); require('../js/addons.js'); require('../js/engine.js'); require('../js/managers.js'); require('../js/advisor.js');
const CS = globalThis.CS, E = CS.E, A = CS.Advisor;
function show(title, s) {
  const d = E.derive(s), items = E.getItems(s, d);
  const r = A.analyze(s, d, items);
  console.log('\n=== ' + title + ' (' + E.dateStr(d.y) + ', cash ' + A.fmt.$(s.cash) + ', sales ' + A.fmt.$(s.rate.rev * 60) + '/min)');
  console.log('Upgrades:');
  if (!r.recs.length) console.log('  (none)');
  r.recs.forEach((x) => console.log(`  ${x.icon} ${x.name} Lv${x.lvl}→${x.lvl + 1}  cost ${A.fmt.$(x.cost)}  ${x.afford ? 'AFFORDABLE' : 'save ~' + A.fmt.dur(x.eta)}  payback ${A.fmt.dur(x.payback)}\n     ${x.why}`));
  if (r.tokenRec) console.log('  token:', r.tokenRec.name, '-', r.tokenRec.why);
  console.log('Insights:');
  r.insights.forEach((x) => console.log(`  ${x.icon} [${x.lv}] ${x.text}`));
  return r;
}
function run(s, sec, bot) { for (let t = 0; t < sec; t++) { if (bot && t % 10 === 0) bot(s); E.step(s, 1, 1); } }
const stockTop = (s, n, tgt) => { const d = E.derive(s); E.getItems(s, d).filter((i) => i.kind === 'pre' && i.buyable).sort((a, b) => b.rel - a.rel).slice(0, n).forEach((i) => E.setTarget(s, i.key, tgt)); };

// 1. brand new shop
let s = E.newState(); show('Day one, empty shelves', s);

// 2. one computer, no upgrades yet
s = E.newState(); E.buy(s, 'p:compac_425', 2); run(s, 120); show('First sales', s);

// 3. mid game with a checkout bottleneck
s = E.newState(); s.cal = 6.5; s.cash = 60000; Object.assign(s.up, { clerk: 4, ads_news: 20, ads_tv: 10, sales: 1, shelf: 3 }); stockTop(s, 4, 10);
run(s, 600, (st) => stockTop(st, 4, 10)); show('Marketing way ahead of checkout', s);

// 4. shelves full, lots of cash, no managers
s = E.newState(); s.cal = 12; s.cash = 3e6; Object.assign(s.up, { clerk: 8, ads_news: 15, ads_tv: 10, ads_web: 6, ads_ecom: 3, sales: 8, barcode: 8, pos: 2, shelf: 1 }); stockTop(s, 6, 25);
run(s, 600, (st) => stockTop(st, 6, 25)); show('Full shelves, idle cash', s);

// 5. late game with tokens and an event ahead
s = E.newState(); s.cal = 26.9; s.cash = 5e7; s.meta.tokens = 7; s.stats.revenue = 5e8; Object.assign(s.up, { clerk: 12, warehouse: 6, ads_news: 20, ads_tv: 10, ads_web: 10, ads_ecom: 8, ads_seo: 6, ads_social: 5, sales: 10, barcode: 10, pos: 8, selfcheck: 4, shelf: 6, depot: 4, dc: 2, purchasing: 1, aisle_acc: 1, aisle_games: 1, workshop: 1, techs: 3 });
stockTop(s, 6, 30); run(s, 900, (st) => stockTop(st, 6, 30)); show('Late game', s);

// 6. back from a long absence, capped
s = E.newState(); s.cal = 8; s.cash = 2e5; Object.assign(s.up, { clerk: 4, ads_news: 12, sales: 4, shelf: 2 }); stockTop(s, 4, 12); run(s, 300, (st) => stockTop(st, 4, 12)); E.offline(s, 9 * 3600); show('After 9h away (cap 4h)', s);
