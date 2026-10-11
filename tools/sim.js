/* Headless balance check:  node tools/sim.js [minutes]
   A simple bot plays the economy so we can see how cash/income progress by year. */
require('../js/data.js');
require('../js/engine.js');
const CS = globalThis.CS;
const E = CS.E;

const mins = +process.argv[2] || 170;
const s = E.newState();

function bot() {
  const d = E.derive(s);
  const items = E.getItems(s, d).filter((i) => i.kind === 'pre' && i.buyable);
  // targets: best two by expected profit per wholesale dollar x relevance
  const ref = E.refPrice(d.y);
  items.forEach((i) => (i.score = Math.pow(i.rel, 1.3) * Math.pow(Math.max(0.4, i.price / ref), -1.1) * (i.price - i.cost)));
  items.sort((a, b) => b.score - a.score);
  const sellRate = Math.min(d.lambda, d.serve) * 0.7;
  const per = Math.max(2, Math.ceil((sellRate * 45) / 3));
  items.forEach((i, idx) => E.setTarget(s, i.key, idx < 3 ? per : 0));
  // blueprint: if workshop, make a mid build
  if (d.workshop && s.bps.length === 0) {
    const parts = {};
    CS.SLOTS.forEach((sl) => {
      const c = CS.PARTS.filter((p) => p.slot === sl.id && E.partAvail(p, d.y) && p.tier === 'Standard').pop();
      parts[sl.id] = c.id;
    });
    E.createBp(s, 'Bot Rig', parts, 0.35);
  }
  // keep a bp fresh
  if (d.workshop && s.bps.length) {
    const bp = s.bps[s.bps.length - 1];
    if (!E.bpInfo(bp, d).avail && s.bps.length < d.benchSlots) {
      const parts = {};
      CS.SLOTS.forEach((sl) => {
        const c = CS.PARTS.filter((p) => p.slot === sl.id && E.partAvail(p, d.y) && p.tier === 'Standard').pop();
        parts[sl.id] = c.id;
      });
      E.createBp(s, 'Bot Rig ' + Math.floor(d.y), parts, 0.35);
    }
    s.bps.forEach((b) => (b.target = b.id === s.bps[s.bps.length - 1].id ? per : 0));
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
      const reserve = (items[0] ? items[0].cost : 1000) * 2;
      if (s.cash > E.upCost(s, u) + reserve && E.buyUp(s, u.id)) { bought = true; break; }
    }
    if (!bought) break;
  }
}

let lastY = 0;
const fmt = (n) => (n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : n.toFixed(0));
const t0 = Date.now();
for (let t = 0; t < mins * 60; t++) {
  if (t % 5 === 0) bot();
  E.step(s, 1, 1);
  const y = Math.floor(E.yearOf(s));
  if (y !== lastY && t % 5 === 0) {
    lastY = y;
    const d = E.derive(s);
    console.log(
      `${(t / 60).toFixed(0).padStart(4)}m  ${y}  cash $${fmt(s.cash).padStart(8)}  rev/s ${fmt(s.rate.rev).padStart(7)}  upkeep/s ${fmt(d.upkeep).padStart(6)}  λ ${d.lambda.toFixed(2)} serve ${d.serve.toFixed(2)} restock ${d.restock.toFixed(1)} cap ${d.cap}  sold ${fmt(s.stats.sold)} built ${fmt(s.stats.built)}  stock ${E.totalStock(s)}`
    );
  }
}
console.log('sim ms', Date.now() - t0);

// Offline equivalence check: run 8h of offline and compare to online
const a = E.deserialize(E.serialize(s));
const b = E.deserialize(E.serialize(s));
const rep = E.offline(a, 8 * 3600);
console.log('offline 8h -> year', E.yearOf(a).toFixed(2), 'cash', fmt(a.cash), 'units', fmt(rep.units), 'revenue', fmt(rep.revenue));
let t1 = Date.now();
E.advance(b, 8 * 3600 * 0.25 * 0 + 600, 1);
console.log('600s online -> cash', fmt(b.cash), '(sim ms', Date.now() - t1 + ')');
