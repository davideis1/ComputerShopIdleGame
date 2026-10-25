/* Shop reputation:  node tools/rep-check.js   Exits 1 on failure. */
const CS = require('../core');
const E = CS.E;
let fails = 0;
const ok = (cond, what) => { console.log((cond ? 'ok   ' : 'FAIL ') + what); if (!cond) fails++; };

const fresh = E.newState();
ok(fresh.rep === 3 && Math.abs(E.repMult(fresh) - 1) < 1e-9, 'a new shop starts at 3★ with no effect on shoppers');
const old = JSON.parse(E.serialize(fresh)); delete old.rep;
ok(E.deserialize(JSON.stringify(old)).rep === 3, 'old saves without a rating start at 3★');
const lo = Object.assign(E.newState(), { rep: 1 }), hi = Object.assign(E.newState(), { rep: 5 });
ok(Math.abs(E.repMult(lo) - 0.85) < 1e-9 && Math.abs(E.repMult(hi) - 1.15) < 1e-9, '1★ = -15% shoppers, 5★ = +15%');
ok(E.derive(hi).lambda > E.derive(lo).lambda, 'a better rating brings more shoppers');

// a shop with nothing on the shelves and a long queue: the rating falls and the panel says why
const bad = E.newState();
bad.up.ads_news = 40; // plenty of shoppers, one slow cashier, no stock
for (let i = 0; i < 1200; i++) E.step(bad, 1, 1);
const vb = E.reputationView(bad, E.derive(bad));
ok(bad.rep < 2.5, 'empty shelves and queues pull the rating down (' + bad.rep.toFixed(2) + '★)');
ok(vb.worst && (vb.worst.id === 'stock' || vb.worst.id === 'speed'), 'the worst factor is named: ' + (vb.worst && vb.worst.label));
ok(vb.factors.every((f) => f.score >= 0 && f.score <= 1 && f.cost >= 0), 'factor scores stay in 0..1');

// a well-run shop: stocked, fast checkout, Service Desk keeping up
const good = E.newState();
good.cash = 1e8;
good.cal = 2005 - 1993;
Object.assign(good.up, { clerk: 20, sales: 30, barcode: 20, pos: 10, svc_desk: 1, svc_tech: 20, svc_bench: 10 });
const d = E.derive(good);
E.getItems(good, d).filter((i) => i.kind === 'pre' && i.buyable).forEach((i) => E.setTarget(good, i.key, 40));
for (let i = 0; i < 1800; i++) E.step(good, 1, 1);
ok(good.rep > 3.4, 'a stocked, fast shop with repairs rises (' + good.rep.toFixed(2) + '★)');
ok(E.reputationView(good, E.derive(good)).label.length === 5, 'the star label is five characters');

// the Advisor names the problem
const adv = CS.Advisor.analyze(bad, E.derive(bad), E.getItems(bad, E.derive(bad)));
ok(adv.all.some((x) => x.icon === '⭐') || bad.stats.sold <= 20, 'the Advisor explains a poor rating once the shop has traded');

console.log(fails ? `\n${fails} check(s) failed` : '\nall reputation checks passed');
process.exit(fails ? 1 : 0);
