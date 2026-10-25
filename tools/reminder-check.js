/* App reminders (E.remindersAt, scheduled by app/src/notify.ts):  node tools/reminder-check.js   Exits 1 on failure. */
const CS = require('../core');
const E = CS.E;
let fails = 0;
const ok = (cond, what) => { console.log((cond ? 'ok   ' : 'FAIL ') + what); if (!cond) fails++; };
const ids = (s) => E.remindersAt(s).map((r) => r.id).join(',');

const s = E.newState();
const night = E.remindersAt(s).find((r) => r.id === 'night');
ok(night && night.seconds === E.derive(s).offlineCap, 'the night-shift reminder fires when offline earning stops (' + night.seconds / 3600 + 'h)');

// stock on the shelf, nobody restocking, busy shop: an empty-shelves reminder before the night shift ends
s.cash = 1e6; s.up.ads_news = 5; s.up.shelf = 5;
E.getItems(s, E.derive(s)).filter((i) => i.kind === 'pre' && i.buyable).slice(0, 2).forEach((i) => E.buy(s, i.key, 25));
const empty = E.remindersAt(s).find((r) => r.id === 'empty');
ok(empty && empty.seconds < night.seconds, 'empty shelves are expected in ' + (empty && Math.round(empty.seconds / 60)) + ' min');
s.up.clerk = 1;
ok(!ids(s).includes('empty'), 'no empty-shelves reminder once a clerk restocks');

// a console launch inside the offline window (Console Corner open, just before a launch)
const c = E.newState();
c.up.aisle_console = 1;
c.cal = CS.PLAT_BY_ID.ps2.year - 0.05 - 1993;
const launch = E.remindersAt(c).find((r) => r.id === 'launch');
ok(launch && /launches today/.test(launch.title) && launch.seconds < E.derive(c).offlineCap, 'a console launch while away: ' + (launch && launch.title));
c.up.aisle_console = 0;
ok(!ids(c).includes('launch'), 'no launch reminder without Console Corner');
ok(E.remindersAt(c).every((r) => r.seconds >= 60 && r.title && r.body), 'every reminder has text and is at least a minute away');

console.log(fails ? `\n${fails} check(s) failed` : '\nall reminder checks passed');
process.exit(fails ? 1 : 0);
