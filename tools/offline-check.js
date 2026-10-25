/* Offline catch-up:  node tools/offline-check.js   Exits 1 on failure.
   The sliced catch-up the app runs between frames (offlineStart/offlineRun) must equal E.offline exactly. */
// seeded random, reset before each run, so both runs draw the same numbers
let seed = 1;
const reseed = () => { seed = 1; };
Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const CS = require('../core');
const E = CS.E;
let fails = 0;
const ok = (cond, what) => { console.log((cond ? 'ok   ' : 'FAIL ') + what); if (!cond) fails++; };

// a mid-game shop with buyers, consoles and a workshop running
const s = E.newState();
s.cash = 5e7;
s.cal = 2006 - 1993;
Object.assign(s.up, { clerk: 20, sales: 30, barcode: 20, pos: 10, ads_news: 30, ads_tv: 20, shelf: 25, depot: 10, aisle_acc: 1, aisle_games: 1, aisle_console: 1, purchasing: 1, workshop: 1, techs: 10, svc_desk: 1, svc_tech: 10 });
['pre', 'game', 'acc', 'con'].forEach((c) => CS.M.hire(s, c, 0));
for (let i = 0; i < 300; i++) E.step(s, 1, 1);
const raw = E.serialize(s);

[600, 3 * 3600, 9 * 3600].forEach((secs) => {
  const a = E.deserialize(raw), b = E.deserialize(raw);
  reseed();
  const t = Date.now();
  const r1 = E.offline(a, secs);
  const ms = Date.now() - t;
  reseed();
  const job = E.offlineStart(b, secs);
  let slices = 0;
  while (!E.offlineRun(job, 97)) slices++;
  const r2 = job.rep;
  ok(a.cash === b.cash && r1.revenue === r2.revenue && r1.units === r2.units && E.serialize(a) === E.serialize(b),
    `${secs / 3600}h away: sliced (${slices + 1} slices) = one-shot (${ms} ms)`);
  ok(r1.effective <= r1.cap && r1.cash1 === a.cash && r1.year1 > r1.year0, `${secs / 3600}h report is complete (capped at ${r1.cap / 3600}h)`);
});
const j = E.offlineStart(E.deserialize(raw), 4 * 3600);
ok(j.h === 10, 'long gaps run in 10 s steps');

console.log(fails ? `\n${fails} check(s) failed` : '\nall offline checks passed');
process.exit(fails ? 1 : 0);
