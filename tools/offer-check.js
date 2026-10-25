/* Decision events (core/offers.js):  node tools/offer-check.js   Exits 1 on failure. */
const CS = require('../core');
const E = CS.E;
let fails = 0;
const ok = (cond, what) => { console.log((cond ? 'ok   ' : 'FAIL ') + what); if (!cond) fails++; };

// a trading shop in 2008 with stock
const shop = () => {
  const s = E.newState();
  s.cash = 5e6;
  s.cal = 2008 - 1993;
  Object.assign(s.up, { clerk: 10, sales: 20, ads_news: 20, shelf: 20, depot: 10 });
  E.getItems(s, E.derive(s)).filter((i) => i.kind === 'pre' && i.buyable).slice(0, 4).forEach((i) => E.buy(s, i.key, 60));
  s.stats.sold = 50;
  s.rate.rev = 3000;
  return s;
};

// offers arrive in live play, never during offline catch-up, and expire if ignored
const a = shop();
for (let i = 0; i < 400 && !a.offer; i++) E.step(a, 1, 1);
ok(!!a.offer, 'an offer arrives within a few minutes of play');
const v = CS.Offers.view(a);
ok(v && v.title && v.text && v.choices.length === 2 && v.left > 0, 'the card has a title, text, two choices and a countdown');
for (let i = 0; i < CS.Offers.WAIT + 5; i++) E.step(a, 1, 1);
ok(!a.offer || a.offer.at !== v.at, 'an ignored offer expires'); // (a new one may follow later)
ok((a.stats.offersMissed || 0) >= 1, 'and counts as missed');
const off = shop();
E.offline(off, 4 * 3600);
ok(!off.offer, 'no offers during offline catch-up');

// every template: make, show, resolve both ways, and stay sane
CS.OFFERS.forEach((t) => {
  const s = shop();
  s.cal = (t.id === 'y2k' ? 1999.5 : t.id === 'miner' ? 2019 : 2008) - 1993;
  const d = E.derive(s);
  const o = t.make(s, d, E.getItems(s, d));
  if (!o) { ok(false, t.id + ': could not be made for a stocked shop'); return; }
  [0, 1].forEach((i) => {
    const c = E.deserialize(E.serialize(Object.assign(s, { offer: Object.assign({ id: t.id, at: s.stats.play, until: s.stats.play + 90 }, o) })));
    const r = CS.Offers.resolve(c, i);
    ok(r && typeof r.text === 'string' && !c.offer && isFinite(c.cash) && c.rep >= 1 && c.rep <= 5, `${t.id} choice ${i}: "${r && r.text}"`);
  });
});

// boosts raise shoppers and wear off
const b = shop();
const lam = E.derive(b).lambda;
b.boost = { demand: 1.3, until: b.stats.play + 10, label: 'Ad campaign' };
ok(E.derive(b).lambda > lam * 1.25 && CS.Offers.activeBoost(b), 'an ad boost raises shoppers');
for (let i = 0; i < 15; i++) E.step(b, 1, 1);
ok(!CS.Offers.activeBoost(b), 'and wears off');

console.log(fails ? `\n${fails} check(s) failed` : '\nall offer checks passed');
process.exit(fails ? 1 : 0);
