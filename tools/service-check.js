/* Service Desk: repairs, warranties and claims.  node tools/service-check.js   Exits 1 on failure. */
const CS = require('../core');
const E = CS.E;
let fails = 0;
const ok = (cond, what) => { console.log((cond ? 'ok   ' : 'FAIL ') + what); if (!cond) fails++; };

// the menu follows the era
const names = (y) => E.serviceAt(y).list.map((x) => x.id);
ok(names(1995).includes('dialup') && !names(1995).includes('wifi'), '1995: dial-up setup, no Wi-Fi yet');
ok(names(1999.5).includes('y2k') && !names(2001).includes('y2k'), 'Y2K checks only around 2000');
ok(names(2025).includes('aipc') && !names(2025).includes('dialup'), '2025: AI PC setup, dial-up is gone');
ok(names(2032).includes('quantum'), 'the Near Future has its own services');
ok(E.serviceAt(2020).price > E.serviceAt(1995).price, 'prices rise with the years');

// closed desk: nothing happens
const s = E.newState();
s.cash = 1e7;
s.cal = 2005 - 1993;
['ads_news', 'sales', 'clerk'].forEach((id) => { s.up[id] = 10; });
let d = E.derive(s);
ok(!d.service && d.svcDemand === 0 && d.warranty === 0, 'no desk, no repairs or warranties');
ok(E.buyUp(s, 'svc_desk'), 'the Service Desk opens');
d = E.derive(s);
ok(d.service && d.svcDemand > 0 && d.svcCap > 0, 'walk-ins arrive and the owner can fix some');

// repairs: capped by capacity, paid, counted
const before = { cash: s.cash, rev: s.stats.revenue };
for (let i = 0; i < 300; i++) E.step(s, 1, 1);
ok(s.stats.repairs > 0 && s.stats.serviceRevenue > 0, 'repair jobs done: ' + Math.round(s.stats.repairs));
ok(s.stats.repairs <= d.svcCap * 300 + 1, 'never more jobs than the desk can handle');
ok(s.stats.svcLost > 0, 'busy desk turns jobs away (' + Math.round(s.stats.svcLost) + ')');
const v = E.serviceView(s, E.derive(s));
ok(v.open && v.menu.length > 3 && v.turnedAway > 0, 'serviceView reports the menu and lost jobs');
ok(s.stats.revenue > before.rev, 'repairs count as sales (and so towards Franchise Tokens)');

// technicians add capacity; the Advisor suggests them when jobs are lost
const cap0 = E.derive(s).svcCap;
E.buyUp(s, 'svc_tech');
ok(E.derive(s).svcCap > cap0, 'a technician adds capacity');
s.rate.rev = 500;
['aisle_acc', 'aisle_games', 'aisle_console'].forEach((id) => (s.up[id] = 1)); // take the obvious cheaper wins off the table
s.up.ads_tv = 60; s.up.ads_web = 60; s.up.ads_ecom = 60; s.up.loyalty = 30;
const adv = CS.Advisor.analyze(s, E.derive(s), E.getItems(s, E.derive(s)));
ok(JSON.stringify(adv).includes('turns away'), 'the Advisor notices turned-away repair jobs');

// warranties on PC sales, claims paid later
const w = E.newState();
w.cash = 1e7;
w.cal = 2000 - 1993;
E.buyUp(w, 'svc_desk');
const pc = E.getItems(w, E.derive(w)).filter((i) => i.kind === 'pre' && i.buyable)[0];
E.buy(w, pc.key, 5);
const events = [];
const cash0 = w.cash;
const it = E.getItems(w, E.derive(w)).find((i) => i.key === pc.key);
const rev = E.sellUnits(w, it, 1, null, events, 1);
ok(rev > it.price && w.stats.warranties > 0, 'a PC sale brings warranty money too');
ok(events.some((e) => e.it.key === 'warranty' && e.k === 0), 'warranties show as their own sales line');
ok(w.claims > 0 && w.claims < rev - it.price, 'part of the premium is held back for claims');
const due = w.claims;
w.stock[pc.key] = 0; // no more sales: only claims move money now
for (let i = 0; i < 600; i++) E.step(w, 1, 1);
ok(w.stats.claimsPaid > 0 && w.claims < due, 'claims are paid out over time');
ok(Math.abs(w.stats.claimsPaid - (due - w.claims)) < 1e-6, 'every claim paid comes out of what was held back');

console.log(fails ? `\n${fails} check(s) failed` : '\nall service checks passed');
process.exit(fails ? 1 : 0);
