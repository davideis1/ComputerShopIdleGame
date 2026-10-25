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

// player settings: kinds can be switched off, and the night-shift reminder can come early
const o = E.newState();
ok(E.remindersAt(o, { kinds: { night: false } }).every((r) => r.id !== 'night'), 'a switched-off kind is not scheduled');
const base = E.remindersAt(o).find((r) => r.id === 'night').seconds;
ok(E.remindersAt(o, { leadMin: 30 }).find((r) => r.id === 'night').seconds === base - 1800, 'the night-shift reminder can come 30 minutes early');
ok(E.remindersAt(o, { leadMin: 9999 }).find((r) => r.id === 'night').seconds >= 60, 'an absurd lead time still leaves a valid reminder');

// a Franchise Token that becomes claimable while away
const k = E.newState();
k.stats.revenue = 0.9 * CS.C.TOKEN_R0;
k.rate.rev = 1e4;
const tok = E.remindersAt(k).find((r) => r.id === 'tokens');
ok(tok && Math.abs(tok.seconds - (E.nextTokenAt(k) - k.stats.revenue) / 1e4) < 1, 'a Franchise Token reminder arrives when revenue will reach it (' + (tok && Math.round(tok.seconds)) + ' s)');
k.stats.revenue = 2 * CS.C.TOKEN_R0;
ok(!ids(k).includes('tokens'), 'no token reminder when one is already claimable');

// a Service Desk drowning in jobs with nobody managing it
const v = E.newState();
v.cal = 2005 - 1993; v.cash = 1e6; v.up.ads_news = 30; v.up.sales = 20; v.up.svc_desk = 1;
ok(ids(v).includes('service'), 'an overloaded Service Desk gets a reminder');
ok(!E.remindersAt(v, { kinds: { service: false } }).some((r) => r.id === 'service'), '...unless the player switched it off');

console.log(fails ? `\n${fails} check(s) failed` : '\nall reminder checks passed');
process.exit(fails ? 1 : 0);
