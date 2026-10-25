/* Retail seasons and the scaled Hustle:  node tools/season-check.js   Exits 1 on failure. */
const CS = require('../core');
const E = CS.E;
let fails = 0;
const ok = (cond, what) => { console.log((cond ? 'ok   ' : 'FAIL ') + what); if (!cond) fails++; };

// seasons show up as events on the right dates, every year
const at = (y) => E.eventsAt(y).list.filter((e) => e.season).map((e) => e.id).join(',');
ok(at(2001.05) === 'season_lull', 'January lull in January');
ok(at(2001.5) === 'season_summer', 'Summer Game Sale in July');
ok(at(2001.65) === 'season_school', 'Back to School in late August');
ok(at(2001.9) === 'season_bfriday', 'Black Friday in late November');
ok(at(2001.95) === 'season_holiday', 'Holiday Rush in December');
ok(at(2001.3) === '', 'nothing in April');
ok(at(2034.9) === 'season_bfriday', 'seasons carry on in the Near Future');
ok(E.eventsAt(2001.9).demand > 1.6 && E.eventsAt(2001.05).demand < 0.9, 'demand rises for Black Friday and dips in January');
ok(E.eventsAt(2001.95).kinds.console > 1.5, 'Holiday Rush boosts consoles');
ok(E.eventsAt(2001.95).list.find((e) => e.season) === E.eventsAt(2001.96).list.find((e) => e.season), 'the same season-year is the same object');

// a buyer's forecast and the Advisor see a season coming
const s0 = E.newState();
s0.cal = 2001.82 - 1993;
const adv = CS.Advisor.analyze(s0, E.derive(s0), E.getItems(s0, E.derive(s0)));
ok(JSON.stringify(adv).includes('Black Friday'), 'the Advisor warns about Black Friday a month ahead');

// Hustle: streaks and business orders
const s = E.newState();
s.cash = 1e7;
const d = E.derive(s);
E.getItems(s, d).filter((i) => i.kind === 'pre' && i.buyable).slice(0, 3).forEach((i) => E.buy(s, i.key, 60));
const streaks = [];
for (let i = 0; i < 4; i++) { streaks.push(E.hustle(s).streak); for (let k = 0; k < E.HUSTLE_CD; k++) E.step(s, 1, 1); }
ok(streaks.join(',') === '1,2,3,4', 'back-to-back hustles build a streak (' + streaks.join(',') + ')');
ok(E.hustleStreak(s) === 4, 'the streak shows while it can still continue');
for (let k = 0; k < 10; k++) E.step(s, 1, 1);
ok(E.hustleStreak(s) === 0 && E.hustle(s).streak === 1, 'a pause ends the streak');
let big = null;
for (let n = 0; n < 20 && !big; n++) {
  for (let k = 0; k < E.HUSTLE_CD; k++) E.step(s, 1, 1);
  s.rate.rev = 4000;
  const r = E.hustle(s);
  if (r && r.units) big = r;
}
ok(big && big.units > 1, 'a busy shop gets business orders (' + (big && big.units) + ' units)');

console.log(fails ? `\n${fails} check(s) failed` : '\nall season checks passed');
process.exit(fails ? 1 : 0);
