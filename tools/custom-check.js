/* Compares the expected profit contribution of custom rigs vs. the best prebuilts per year.
   node tools/custom-check.js */
require('../js/data.js'); require('../js/engine.js');
const CS = globalThis.CS, E = CS.E;
function parts(d, tiers) {
  const o = {};
  CS.SLOTS.forEach((sl) => {
    const tier = tiers[sl.id] || 'Standard';
    const c = CS.PARTS.filter((p) => p.slot === sl.id && E.partAvail(p, d.y) && p.tier === tier && !p.rolling).sort((x, y) => y.year - x.year)[0];
    o[sl.id] = c.id;
  });
  return o;
}
function contrib(all, d) {
  const ref = E.refPrice(d.y);
  const out = new Map(all.map((i) => [i.key, 0]));
  E.SEG.forEach((seg) => {
    const ws = all.map((i) => E.itemWeight(seg, i.rel, i.price, d.y));
    const tot = ws.reduce((a, b) => a + b, 0);
    const pb = Math.min(0.95, 1 - Math.exp(-tot / 0.8));
    all.forEach((i, k) => out.set(i.key, out.get(i.key) + (seg.share * pb * ws[k]) / tot * (i.price - i.cost)));
  });
  return out;
}
console.log('year  best-prebuilt($/cust)  rig        bestMarkup  $/cust   rigPrice  rigRel');
for (const y of [1996, 1999, 2003, 2007, 2011, 2015, 2019, 2023, 2026]) {
  const s = E.newState(); s.cal = Math.min(y - 1993 + 0.5, 33.8); s.up.workshop = 1;
  const d = E.derive(s);
  const pre = E.getItems(s, d).filter((i) => i.kind === 'pre' && i.buyable);
  const base = contrib(pre, d);
  const bestPre = Math.max(...base.values());
  for (const [name, tiers] of [['standard', {}], ['premium', { cpu: 'Premium', gpu: 'Premium', ram: 'Premium' }], ['budget', { cpu: 'Budget', gpu: 'Budget', ram: 'Budget', storage: 'Budget' }]]) {
    let best = { v: -1 };
    for (let mk = 0.05; mk <= 1.5; mk += 0.05) {
      const bp = { id: 'x', parts: parts(d, tiers), markup: mk };
      const info = E.bpInfo(bp, d);
      const item = { key: 'b:x', kind: 'bp', rel: info.rel, price: info.price, cost: info.cost };
      const c = contrib(pre.concat([item]), d).get('b:x');
      if (c > best.v) best = { v: c, mk, price: info.price, rel: info.rel };
    }
    console.log(String(y).padEnd(5), bestPre.toFixed(1).padStart(8), '         ', name.padEnd(9), (best.mk * 100).toFixed(0).padStart(5) + '%   ', best.v.toFixed(1).padStart(7), String(Math.round(best.price)).padStart(8), best.rel.toFixed(2));
  }
}
