/* Franchise HQ rules:  node tools/hq-check.js
   Head Start, Time Warp, and opening upgrades bought before a new franchise's first sale. Exits 1 on failure. */
const CS = require('../core');
const E = CS.E, C = CS.C;
let fails = 0;
const ok = (cond, what) => { console.log((cond ? 'ok   ' : 'FAIL ') + what); if (!cond) fails++; };
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const metaWith = (tup) => Object.assign(E.newState().meta, { tup });

// Head Start: opening year and cash per level
C.HEAD_STARTS.forEach((h, L) => {
  const s = E.newState(metaWith({ t_head: L }));
  ok(near(s.cal, h.cal) && near(s.cash, C.START_CASH + h.cash), `Head Start ${L}: opens in ${E.yearOf(s)} with $${s.cash}`);
  ok(E.startYear(s) === C.START_YEAR + h.cal, `startYear() says ${E.startYear(s)}`);
  const unseen = CS.PRODUCTS.filter((p) => p.year <= E.yearOf(s) && !s.seen[p.id]).length;
  ok(unseen === 0, 'older products are not flagged new');
});

// Time Warp: faster before WARP_UNTIL, normal after
{
  const s = E.newState(metaWith({ t_warp: 10 }));
  E.step(s, C.YEAR_SECONDS, 1);
  ok(near(s.cal, 2.5, 1e-9), `Time Warp 10: one year of play moves ${s.cal.toFixed(3)} years before 2015`);
  s.cal = C.WARP_UNTIL + 1;
  E.step(s, C.YEAR_SECONDS, 1);
  ok(near(s.cal, C.WARP_UNTIL + 2, 1e-9), 'and exactly one year after 2015');
}

// Fresh franchise: opening upgrades apply until the first sale
{
  let s = E.newState();
  s.stats.revenue = 5e9;
  const p = E.prestige(s);
  s = p.state;
  s.meta.tokens = 1000;
  ok(s.fresh === true, 'a new franchise starts fresh');
  const cash0 = s.cash;
  E.buyTokenUp(s, 't_cash');
  ok(near(s.cash, cash0 + 7500), "Founder's Fund bought while fresh adds cash now");
  E.buyTokenUp(s, 't_head');
  ok(near(s.cal, C.HEAD_STARTS[1].cal) && near(s.cash, cash0 + 7500 + C.HEAD_STARTS[1].cash), 'Head Start bought while fresh moves the calendar and adds cash');
  E.buyTokenUp(s, 't_head');
  ok(near(s.cal, C.HEAD_STARTS[2].cal) && near(s.cash, cash0 + 7500 + C.HEAD_STARTS[2].cash), 'a second level tops up to the next opening');
  E.buyTokenUp(s, 't_kit');
  ok(s.up.clerk >= 1 && s.up.ads_news >= 2, 'Starter Kit applies while fresh');
  const r = E.deserialize(E.serialize(s));
  ok(r.fresh === true, 'fresh survives save/load');
  const d = E.derive(s);
  E.getItems(s, d).filter((i) => i.kind === 'pre' && i.buyable).slice(0, 3).forEach((i) => E.setTarget(s, i.key, 5));
  for (let i = 0; i < 600 && s.fresh; i++) E.step(s, 1, 1);
  ok(s.fresh === false, 'the first sale ends the fresh window');
  const cash1 = s.cash;
  E.buyTokenUp(s, 't_cash');
  ok(near(s.cash, cash1), "after that, Founder's Fund waits for the next franchise");
}

console.log(fails ? `\n${fails} HQ check(s) failed` : '\nall HQ checks passed');
process.exit(fails ? 1 : 0);
