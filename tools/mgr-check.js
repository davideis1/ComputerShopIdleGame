/* Purchasing manager sanity check:  node tools/mgr-check.js [year]
   Hires a buyer in every category, runs the shop for 20 simulated minutes and prints what they did. */
require('../core/data.js'); require('../core/addons.js'); require('../core/engine.js'); require('../core/consoles.js'); require('../core/managers.js');
const CS = globalThis.CS, E = CS.E, M = CS.M;
const year = +process.argv[2] || 2003;
const fmt = (n) => (n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : n.toFixed(0));
function setup(withMgr) {
  const s = E.newState();
  s.cal = year - 1993 + 0.2; s.cash = 3e6;
  Object.assign(s.up, { purchasing: 1, aisle_acc: 1, aisle_games: 1, aisle_console: 1, workshop: 1, techs: 4, ads_news: 15, ads_tv: 8, ads_web: 6, sales: 8, barcode: 8, shelf: 8, depot: 3, clerk: 6, tools: 3, bench: 2 });
  if (withMgr) {
    ['pre', 'bp', 'game', 'acc', 'con'].forEach((c) => {
      const cands = M.candidates(s, c);
      const r = M.hire(s, c, 0);
      if (!r.ok) console.log('hire failed', c, r.err);
    });
    // a custom PC for the bp manager to work with
    const d = E.derive(s); const parts = {};
    CS.SLOTS.forEach((sl) => { parts[sl.id] = CS.PARTS.filter((p) => p.slot === sl.id && E.partAvail(p, d.y) && p.tier === 'Standard' && !p.rolling).sort((a, b) => b.year - a.year)[0].id; });
    E.createBp(s, 'Test Rig', parts, 0.8);
  } else {
    // baseline: you stock a few current items by hand
    const d = E.derive(s);
    E.getItems(s, d).filter((i) => i.buyable && i.age < 2).slice(0, 12).forEach((i) => E.setTarget(s, i.key, 8));
  }
  return s;
}
for (const withMgr of [false, true]) {
  const s = setup(withMgr);
  const rev0 = s.stats.revenue, t0 = Date.now();
  const rep = E.newReport();
  E.advance(s, 20 * 60, 1, rep);
  const d = E.derive(s);
  console.log(withMgr ? '\n== WITH MANAGERS ==' : '== BASELINE (12 hand-set targets) ==');
  console.log('revenue', fmt(s.stats.revenue - rev0), 'cash', fmt(s.cash), 'PCs', s.stats.sold, 'games', Math.round(s.stats.soldGames), 'acc', Math.round(s.stats.soldAcc), 'consoles', Math.round(s.stats.soldConsoles || 0), 'cgames', Math.round(s.stats.soldCGames || 0), 'shelves', E.totalStock(s) + '/' + d.cap, 'upkeep/s', d.upkeep.toFixed(1), 'ms', Date.now() - t0);
  if (withMgr) {
    ['pre', 'bp', 'game', 'acc', 'con'].forEach((c) => {
      const mg = s.mgr[c];
      console.log(`- ${c}: ${mg.name} (${mg.trait}) skills ${JSON.stringify(mg.skills)} wage ${mg.wage.toFixed(2)}/s preset ${s.mgrCfg[c].preset}; ordered ${mg.stats.ordered} units, spent ${fmt(mg.stats.spent)}, saved ${fmt(mg.stats.saved)}; plan ${mg.plan.length} items`);
      mg.plan.slice(0, 3).forEach((p) => console.log(`    ${p.name.padEnd(34)} target ${String(p.t).padStart(4)}  ${p.v.toFixed(1).padStart(6)}/min  ${p.why}${p.tr != null ? '  trend ' + (p.tr * 100).toFixed(0) + '%' : ''}`));
      (mg.log || []).slice(0, 2).forEach((l) => console.log('    log:', l.txt));
    });
    const bad = Object.keys(s.stock).filter((k) => s.stock[k] < 0);
    console.log('negative stock keys:', bad.length, '| cash >= 0:', s.cash >= 0);
    // save/load roundtrip keeps the managers
    const r = E.deserialize(E.serialize(s));
    console.log('roundtrip managers:', Object.values(r.mgr).filter(Boolean).length, 'cfg keys', Object.keys(r.mgrCfg).length);
    const o = E.deserialize(E.serialize(s)); const rr = E.offline(o, 3600);
    console.log('offline 1h: units', fmt(rr.units), 'revenue', fmt(rr.revenue), 'spent', fmt(rr.spent));
  }
}
