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

// ---- the Service Desk manager
const mk = () => {
  const m = E.newState();
  m.cash = 3e6; m.cal = 2005 - 1993;
  Object.assign(m.up, { clerk: 20, sales: 30, barcode: 20, ads_news: 30, ads_tv: 30, purchasing: 1 });
  return m;
};
{
  const m = mk();
  ok(!CS.M.available(E.derive(m), 'svc'), 'the manager needs the Service Desk');
  m.up.svc_desk = 1;
  for (let i = 0; i < 20; i++) E.step(m, 1, 1);
  ok(CS.M.available(E.derive(m), 'svc'), '...and is available once the desk is open');
  const w0 = E.derive(m).upkeep;
  ok(CS.M.hire(m, 'svc', 0).ok, 'a Service Desk manager can be hired');
  ok(E.derive(m).upkeep > w0, 'their wage is part of the upkeep');
  const cap0 = E.derive(m).svcCap;
  for (let i = 0; i < 400; i++) E.step(m, 1, 1);
  const d = E.derive(m);
  ok(d.svcCap > cap0 * 5, 'capacity grew by itself (' + Math.round(cap0 * 60) + ' -> ' + Math.round(d.svcCap * 60) + ' jobs/min)');
  ok(d.svcCap >= d.svcDemand * 0.95, 'it keeps up with walk-ins (capacity ' + d.svcCap.toFixed(2) + ' vs ' + d.svcDemand.toFixed(2) + ' /s)');
  ok((m.up.warranty || 0) > 0, 'it grows Warranty Pitch');
  ok(m.mgr.svc.log.length > 0 && m.mgr.svc.plan.length === 2 && m.mgr.svc.stats.ordered > 0, 'it keeps a notebook, a plan and stats');

  // off duty: nothing happens
  const o = mk(); o.up.svc_desk = 1;
  CS.M.hire(o, 'svc', 0); CS.M.setCfg(o, 'svc', 'on', false);
  const up0 = JSON.stringify(o.up);
  for (let i = 0; i < 300; i++) E.step(o, 1, 1);
  ok(JSON.stringify(o.up) === up0, 'off duty: it buys nothing');

  // budget: a poor shop is not bankrupted by its manager
  const p = mk(); p.up.svc_desk = 1; p.cash = 30000;
  CS.M.hire(p, 'svc', 0); CS.M.setCfg(p, 'svc', 'reserveCash', 25000);
  const cash0 = p.cash;
  CS.M.svcTick(p, E.derive(p), p.mgr.svc, CS.M.cfgOf(p, 'svc'), E.derive(p).mgr.cats.svc);
  ok(cash0 - p.cash <= 5000 + 1e-6 || p.cash >= 25000, 'it respects the cash reserve (cash ' + Math.round(p.cash) + ' >= 25000)');

  // presets and settings
  CS.M.setCfg(m, 'svc', 'preset', 'ahead');
  ok(CS.M.cfgOf(m, 'svc').headroom === 30 && CS.M.cfgOf(m, 'svc').maxSpendPct === 50, 'a preset sets headroom and budget');
  CS.M.setCfg(m, 'svc', 'headroom', 5);
  ok(CS.M.cfgOf(m, 'svc').preset === 'custom', 'changing a setting by hand makes the preset custom');
  const r = E.deserialize(E.serialize(m));
  ok(r.mgr.svc && r.mgrCfg.svc.headroom === 5, 'the manager survives save and load');
  const old = JSON.parse(E.serialize(mk())); delete old.mgr.svc; delete old.mgrCfg.svc;
  ok(E.deserialize(JSON.stringify(old)).mgr.svc === null, 'old saves without the manager load fine');
  // the overload reminder stops when a manager is on duty
  const q = mk(); q.up.svc_desk = 1;
  ok(E.remindersAt(q).some((x) => x.id === 'service'), 'an unmanaged overloaded desk gets the reminder');
  CS.M.hire(q, 'svc', 0);
  ok(!E.remindersAt(q).some((x) => x.id === 'service'), '...but not with a manager on duty');
}

console.log(fails ? `\n${fails} check(s) failed` : '\nall service checks passed');
process.exit(fails ? 1 : 0);
