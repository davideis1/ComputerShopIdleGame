/* PC Designer sanity check:  node tools/design-check.js [year]
   Hires a designer (and a Custom Builds buyer), runs the shop and prints the blueprints it designed. */
require('../js/data.js'); require('../js/addons.js'); require('../js/engine.js'); require('../js/consoles.js'); require('../js/managers.js');
const CS = globalThis.CS, E = CS.E, M = CS.M;
const year = +process.argv[2] || 2003;
const fmt = (n) => (n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : n.toFixed(0));
let bad = 0;
const ok = (c, m) => { if (!c) { bad++; console.log('FAIL', m); } };
for (const withBuyer of [false, true]) {
  const s = E.newState();
  s.cal = year - 1993 + 0.2; s.cash = 3e6;
  Object.assign(s.up, { purchasing: 1, workshop: 1, techs: 5, ads_news: 15, ads_tv: 8, ads_web: 6, sales: 8, barcode: 8, shelf: 8, depot: 3, clerk: 6, tools: 3, bench: 3 });
  ['pre'].concat(withBuyer ? ['bp'] : []).concat(['design']).forEach((c) => { M.candidates(s, c); ok(M.hire(s, c, 0).ok, 'hire ' + c); });
  const bonus0 = E.derive(s).customBonus;
  const rev0 = s.stats.revenue;
  E.advance(s, 45 * 60, 1, E.newReport());
  const d = E.derive(s);
  const mine = s.bps.filter((b) => b.by === 'designer');
  console.log(`\n== designer ${withBuyer ? '+ Custom Builds buyer' : 'alone'} (${year}) ==  revenue ${fmt(s.stats.revenue - rev0)}, custom built ${s.stats.built}, designs ${mine.length}/${d.benchSlots} slots, cash ${fmt(s.cash)}`);
  mine.forEach((b) => { const i = E.bpInfo(b, d); console.log(`  ${b.name.padEnd(22)} ${b.arch.padEnd(9)} cost ${fmt(i.cost).padStart(6)} price ${fmt(i.price).padStart(6)} markup ${Math.round(b.markup * 100)}% target ${b.target} stock ${s.stock['b:' + b.id] || 0}`); });
  (s.mgr.design.log || []).slice(0, 6).forEach((l) => console.log('   log:', l.txt));
  ok(mine.length > 0, 'designer created blueprints');
  ok(mine.length <= d.benchSlots, 'within slots');
  ok(d.customBonus > bonus0 - 1e-9, 'bonus applies');
  ok(s.bps.every((b, i, a) => a.findIndex((x) => JSON.stringify(x.parts) === JSON.stringify(b.parts)) === i), 'no duplicate designs');
  if (!withBuyer) ok(mine.some((b) => b.target > 0), 'designer set targets');
}
// save/load round trip
{
  const s = E.newState(); s.cal = 12; s.cash = 3e6; Object.assign(s.up, { purchasing: 1, workshop: 1, bench: 2, techs: 3 });
  M.candidates(s, 'design'); M.hire(s, 'design', 0);
  E.advance(s, 600, 1, E.newReport());
  const r = E.deserialize(E.serialize(s));
  ok(r.bps.filter((b) => b.by === 'designer').length === s.bps.filter((b) => b.by === 'designer').length, 'bp tags persist');
  ok(M.takeOver(r, r.bps[0] && r.bps[0].id) || !r.bps.length, 'take over');
}
console.log(bad ? '\n' + bad + ' FAILED' : '\nall design checks passed');
process.exit(bad ? 1 : 0);
