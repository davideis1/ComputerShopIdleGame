/* Headless balance check:  node tools/sim.js [minutes]
   A simple bot plays the economy so we can see how cash/income progress by year. */
require('../js/data.js');
require('../js/engine.js');
const CS = globalThis.CS;
const E = CS.E;

const mins = +process.argv[2] || 250;
let s = E.newState();

function bestParts(d, tiers) {
  const parts = {};
  CS.SLOTS.forEach((sl) => {
    const tier = tiers[sl.id] || 'Standard';
    const c = CS.PARTS.filter((p) => p.slot === sl.id && E.partAvail(p, d.y) && p.tier === tier && !p.rolling).sort((x, y) => y.year - x.year)[0]
      || CS.PARTS.filter((p) => p.slot === sl.id && E.partAvail(p, d.y)).pop();
    parts[sl.id] = c.id;
  });
  return parts;
}
// expected margin per arriving customer from each item, using the real demand model
function scoreItems(items, d) {
  const ref = E.refPrice(d.y);
  const score = new Map(items.map((i) => [i.key, 0]));
  E.SEG.forEach((seg) => {
    const ws = items.map((i) => E.itemWeight(seg, i.rel, i.price, d.y));
    const tot = ws.reduce((a, b) => a + b, 0);
    const pb = Math.min(0.95, 1 - Math.exp(-tot / 0.8));
    items.forEach((i, k) => score.set(i.key, score.get(i.key) + (seg.share * pb * ws[k] / tot) * (i.price - i.cost)));
  });
  return score;
}
function bot() {
  const d = E.derive(s);
  const all = E.getItems(s, d).filter((i) => i.buyable || i.canBuild);
  const sc = scoreItems(all, d);
  const pre = all.filter((i) => i.kind === 'pre').sort((a, b) => sc.get(b.key) - sc.get(a.key));
  const sellRate = Math.min(d.lambda, d.serve) * 0.7;
  const per = Math.max(2, Math.ceil((sellRate * 40) / 4));
  pre.forEach((i, idx) => E.setTarget(s, i.key, idx < 4 ? per : 0));
  if (d.workshop) {
    const fresh = s.bps.filter((b) => E.bpInfo(b, d).avail && d.y - Math.max(...Object.values(b.parts).map((id) => CS.PART_BY_ID[id].year)) < 2.5);
    if (fresh.length < 2 && s.bps.length >= d.benchSlots) {
      const dead = s.bps.find((b) => !s.stock['b:' + b.id]);
      if (dead) E.deleteBp(s, dead.id);
    }
    if (fresh.length < 2 && s.bps.length < d.benchSlots) {
      const prem = fresh.length === 1;
      const parts = bestParts(d, prem ? { cpu: 'Premium', gpu: 'Premium' } : {});
      E.createBp(s, (prem ? 'Elite ' : 'Rig ') + Math.floor(d.y), parts, prem ? 0.9 : 0.8);
    }
    const bi = E.getItems(s, d).filter((i) => i.kind === 'bp' && i.canBuild);
    s.bps.forEach((b) => (b.target = bi.find((i) => i.id === b.id) ? per : 0));
  }
  // buy upgrades: balance lambda vs serve vs restock vs capacity
  for (let n = 0; n < 6; n++) {
    const dd = E.derive(s);
    const avail = CS.UPGRADES.filter((u) => E.upUnlocked(s, u) && E.upLevel(s, u.id) < u.max);
    const eff = (u) => u.per / E.upCost(s, u);
    const pick = (kind) => avail.filter((u) => u.kind === kind).sort((a, b) => eff(b) - eff(a))[0];
    const need = [];
    const sr = Math.min(dd.lambda, dd.serve) * 0.8;
    if (dd.restock < sr * 1.3) need.push(pick('restock'));
    if (dd.cap < sr * 120 + 12) need.push(pick('cap'));
    if (dd.lambda > dd.serve) need.push(pick('serve'));
    else need.push(pick('lambda'));
    if (dd.serve > dd.lambda * 1.5) need.push(pick('lambda'));
    if (!dd.workshop && dd.y >= 1997 && s.cash > 40000) need.push(CS.UP_BY_ID.workshop);
    if (dd.workshop) {
      if (dd.build < sr * 0.2) need.push(pick('build'));
      need.push(pick('buildMult'));
    }
    need.push(pick('disc'));
    let bought = false;
    for (const u of need.filter(Boolean)) {
      const reserve = (pre[0] ? pre[0].cost : 1000) * 2;
      if (s.cash > E.upCost(s, u) + reserve && E.buyUp(s, u.id)) { bought = true; break; }
    }
    if (!bought) break;
  }
}

let lastY = 0;
const split = {};
const fmt = (n) => (n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : n.toFixed(0));
const t0 = Date.now();
for (let t = 0; t < mins * 60; t++) {
  if (t % 5 === 0) bot();
  const evs = [];
  E.step(s, 1, 1, null, evs);
  evs.forEach((e) => { if (e.it) { split[e.it.kind] = (split[e.it.kind] || 0) + e.rev; } });
  const y = Math.floor(E.yearOf(s));
  if (y !== lastY && t % 5 === 0) {
    lastY = y;
    const d = E.derive(s);
    console.log(
      `${(t / 60).toFixed(0).padStart(4)}m  ${y}  cash $${fmt(s.cash).padStart(8)}  rev/s ${fmt(s.rate.rev).padStart(7)}  upkeep/s ${fmt(d.upkeep).padStart(6)}  λ ${d.lambda.toFixed(2)} serve ${d.serve.toFixed(2)} restock ${d.restock.toFixed(1)} cap ${d.cap}  sold ${fmt(s.stats.sold)} built ${fmt(s.stats.built)}  stock ${E.totalStock(s)}  runRev ${fmt(s.stats.revenue)} tokens ${E.pendingTokens(s)}`
    );
  }
}
console.log('revenue split', Object.entries(split).map(([k, v]) => k + ' ' + fmt(v)).join(', '));
console.log('sim ms', Date.now() - t0);

// Offline equivalence check: run 8h of offline and compare to online
const a = E.deserialize(E.serialize(s));
const b = E.deserialize(E.serialize(s));
const rep = E.offline(a, 8 * 3600);
console.log('offline 8h -> year', E.yearOf(a).toFixed(2), 'cash', fmt(a.cash), 'units', fmt(rep.units), 'revenue', fmt(rep.revenue));
let t1 = Date.now();
E.advance(b, 8 * 3600 * 0.25 * 0 + 600, 1);
console.log('600s online -> cash', fmt(b.cash), '(sim ms', Date.now() - t1 + ')');

// detail: what sells at the end
{
  const d = E.derive(s);
  const items = E.getItems(s, d).filter((i) => i.target > 0 || i.stock > 0);
  console.log('year', d.y.toFixed(1), 'items with targets:');
  items.forEach((i) => console.log(' ', i.key.padEnd(18), 'price', fmt(i.price).padStart(7), 'cost', fmt(i.cost).padStart(7), 'rel', i.rel.toFixed(2), 'tgt', i.target, 'stock', i.stock));
}

// Optional: node tools/sim.js 250 3  -> play several franchises, spending tokens greedily
const runs = +process.argv[3] || 1;
const PRIORITY = ['t_income', 't_profit', 't_cash', 't_kit', 't_cap', 't_supply', 't_token', 't_night', 't_build'];
for (let run = 2; run <= runs; run++) {
  const p = E.prestige(s);
  s = p.state;
  let bought = 0;
  for (let guard = 0; guard < 500; guard++) {
    // cheapest affordable among the priority list, weighted by priority order
    const pick = PRIORITY.map((id) => CS.TUP_BY_ID[id]).filter((u) => E.tl(s, u.id) < u.max && E.tokenCost(s, u) <= s.meta.tokens)[0];
    if (!pick) break;
    E.buyTokenUp(s, pick.id); bought++;
  }
  const marks = {};
  for (let t = 0; t < mins * 60; t++) {
    if (t % 5 === 0) bot();
    E.step(s, 1, 1);
    const y = Math.floor(E.yearOf(s));
    if ([2000, 2010, 2020].includes(y) && !marks[y]) marks[y] = fmt(s.stats.revenue) + ' @' + (t / 60).toFixed(0) + 'm';
  }
  console.log(`run ${run}: +${p.gain} tokens, bought ${bought} upgrades (${JSON.stringify(s.meta.tup)}), revenue marks ${JSON.stringify(marks)}, end revenue ${fmt(s.stats.revenue)}, pending ${E.pendingTokens(s)}`);
}
