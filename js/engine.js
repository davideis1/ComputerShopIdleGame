/* Game simulation. No DOM access, so it can run headless (see tools/sim.js).
   Everything is advanced by step(); offline progress is the same step() run in bulk. */
(function (g) {
  const CS = g.CS;
  const C = CS.C;

  const infl = (y) => Math.pow(1.025, y - 1993);
  const wageInfl = (y) => Math.pow(1.02, y - 1993);
  const refPrice = (y) => 1400 * infl(y);
  const pdepr = (age) => Math.max(0.2, Math.pow(0.8, Math.max(0, age)));

  // Customer segments: value-for-money weighting = rel^a * (price/ref)^-b
  const SEG = [
    { id: 'budget', share: 0.45, a: 0.9, b: 2.0 },
    { id: 'main', share: 0.4, a: 1.3, b: 1.1 },
    { id: 'enth', share: 0.15, a: 2.0, b: 0.25 },
  ];
  const K = 0.8; // how easily customers are convinced to buy

  /* ---------- state ---------- */
  function newState() {
    const s = {
      v: C.VERSION,
      name: 'Mega Byte Computers',
      started: Date.now(),
      saved: Date.now(),
      cal: 0, // years since Jan 1993
      cash: C.START_CASH,
      up: {},
      stock: {},
      target: {},
      acc: {},
      bps: [],
      bpSeq: 1,
      priceAdj: 0,
      rAcc: 0,
      bAcc: 0,
      hustleCd: 0,
      stats: { sold: 0, revenue: 0, built: 0, lost: 0, stockouts: 0, hustles: 0, play: 0, offline: 0 },
      ach: {},
      seen: {},
      rate: { rev: 0, up: 0 },
      settings: { theme: 'auto' },
    };
    CS.PRODUCTS.forEach((p) => {
      if (p.year <= C.START_YEAR) s.seen[p.id] = 1;
    });
    return s;
  }

  function migrate(raw) {
    const base = newState();
    const s = Object.assign(base, raw);
    s.stats = Object.assign(base.stats, raw.stats || {});
    s.rate = Object.assign(base.rate, raw.rate || {});
    s.settings = Object.assign(base.settings, raw.settings || {});
    ['up', 'stock', 'target', 'acc', 'ach', 'seen'].forEach((k) => (s[k] = Object.assign({}, raw[k] || (k === 'seen' ? base.seen : {}))));
    s.bps = Array.isArray(raw.bps) ? raw.bps.filter((b) => b && b.parts) : [];
    if (!isFinite(s.cash)) s.cash = 0;
    if (!isFinite(s.cal) || s.cal < 0) s.cal = 0;
    s.cal = Math.min(s.cal, C.END_CAL);
    s.v = C.VERSION;
    return s;
  }

  const serialize = (s) => JSON.stringify(s);
  function deserialize(str) {
    const raw = JSON.parse(str);
    if (!raw || typeof raw !== 'object' || typeof raw.cash !== 'number') throw new Error('Not a valid save');
    return migrate(raw);
  }

  /* ---------- calendar & events ---------- */
  const yearOf = (s) => C.START_YEAR + s.cal;
  function eraAt(y) {
    let e = CS.ERAS[0];
    CS.ERAS.forEach((x) => {
      if (y >= x.from) e = x;
    });
    return e;
  }
  function eventsAt(y) {
    const r = { demand: 1, gpuCost: 1, partCost: 1, preCost: 1, list: [] };
    CS.EVENTS.forEach((e) => {
      if (y >= e.from && y < e.to) {
        r.list.push(e);
        r.demand *= e.demand || 1;
        r.gpuCost *= e.gpuCost || 1;
        r.partCost *= e.partCost || 1;
        r.preCost *= e.preCost || 1;
      }
    });
    return r;
  }

  /* ---------- derived stats ---------- */
  function derive(s) {
    const y = yearOf(s);
    const ev = eventsAt(y);
    const lv = (id) => s.up[id] || 0;
    let lambda = 0.06, serve = 0.25, restock = 0, build = 0, buildMult = 1, serveMult = 1;
    let cap = 12, disc = 0, night = 4, bench = 2, loyal = 0, upkeep = 0;
    CS.UPGRADES.forEach((u) => {
      const L = lv(u.id);
      if (!L) return;
      switch (u.kind) {
        case 'lambda': lambda += u.per * L; break;
        case 'serve': serve += u.per * L; break;
        case 'serveMult': serveMult += u.per * L; break;
        case 'restock': restock += u.per * L; break;
        case 'build': build += u.per * L; break;
        case 'buildMult': buildMult += u.per * L; break;
        case 'cap': cap += u.per * L; break;
        case 'disc': disc += u.per * L; break;
        case 'night': night += u.per * L; break;
        case 'bench': bench += u.per * L; break;
        case 'loyal': loyal += u.per * L; break;
      }
      if (u.up) upkeep += u.up * L;
    });
    const achCount = Object.keys(s.ach).length;
    const rent = 0.2 * Math.pow(1 + lv('shelf'), 1.2) * infl(y);
    return {
      y,
      ev,
      lambda: lambda * (1 + loyal) * (1 + 0.01 * achCount) * ev.demand,
      serve: serve * serveMult,
      restock,
      build: build * buildMult,
      cap,
      disc: Math.min(0.5, disc),
      offlineCap: night * 3600,
      benchSlots: bench,
      upkeep: upkeep * wageInfl(y) + rent,
      workshop: lv('workshop') > 0,
      achCount,
    };
  }

  /* ---------- parts & items ---------- */
  function partYear(p, y) {
    return p.rolling ? y - 1.5 : p.year;
  }
  function partAvail(p, y) {
    return p.rolling || (y >= p.year && y - p.year <= C.PART_WINDOW);
  }
  function partRel(p, y) {
    return p.q * Math.pow(C.G, -(y - partYear(p, y)));
  }
  function partPrice(p, d) {
    if (p.free) return 0;
    const sl = CS.SLOT_BY_ID[p.slot];
    const py = partYear(p, d.y);
    const launch = sl.base * Math.pow(p.q, 1.25) * Math.pow(sl.grow, py - 1993);
    const aged = launch * Math.max(0.35, Math.pow(0.86, Math.max(0, d.y - py)));
    return aged * d.ev.partCost * (p.slot === 'gpu' ? d.ev.gpuCost : 1) * (1 - d.disc);
  }
  function bpInfo(bp, d) {
    let cost = 40 * infl(d.y);
    let rel = 1;
    let avail = true;
    CS.SLOTS.forEach((sl) => {
      const p = CS.PART_BY_ID[bp.parts[sl.id]];
      if (!p) { avail = false; return; }
      cost += partPrice(p, d);
      rel *= Math.pow(partRel(p, d.y), sl.w);
      if (!partAvail(p, d.y)) avail = false;
    });
    return { cost, rel, avail, price: cost * (1 + bp.markup) };
  }
  // Same calc used by the blueprint designer before a blueprint exists
  function designInfo(parts, markup, d) {
    return bpInfo({ parts, markup }, d);
  }

  function totalStock(s) {
    let n = 0;
    for (const k in s.stock) n += s.stock[k];
    return n;
  }

  /** All items the shop can sell right now (prebuilts in window or in stock, plus blueprints). */
  function getItems(s, d) {
    const out = [];
    CS.PRODUCTS.forEach((p) => {
      if (p.year > d.y) return;
      const age = d.y - p.year;
      const key = 'p:' + p.id;
      const stock = s.stock[key] || 0;
      const buyable = age <= C.SALE_WINDOW;
      if (!buyable && !stock) return;
      const base = p.price * pdepr(age);
      out.push({
        key, kind: 'pre', id: p.id, def: p, name: p.name, brand: p.brand, icon: p.icon,
        age, rel: p.q * Math.pow(C.G, -age), price: base * (1 + s.priceAdj),
        cost: base * (1 - p.m) * (1 - d.disc) * d.ev.preCost, stock, buyable, target: s.target[key] || 0,
      });
    });
    s.bps.forEach((bp) => {
      const key = 'b:' + bp.id;
      const info = bpInfo(bp, d);
      out.push({
        key, kind: 'bp', id: bp.id, def: bp, name: bp.name, brand: 'Custom', icon: '🛠️', age: 0,
        rel: info.rel, price: info.price, cost: info.cost, stock: s.stock[key] || 0, buyable: false,
        canBuild: info.avail, target: bp.target || 0,
      });
    });
    return out;
  }

  /* ---------- actions ---------- */
  function buyUnits(s, it, n, d) {
    if (!it.buyable) return 0;
    const room = d.cap - totalStock(s);
    const afford = Math.floor(s.cash / it.cost);
    const k = Math.max(0, Math.min(n, room, afford));
    if (!k) return 0;
    s.cash -= k * it.cost;
    s.stock[it.key] = (s.stock[it.key] || 0) + k;
    it.stock += k;
    return k;
  }
  function buy(s, key, n) {
    const d = derive(s);
    const it = getItems(s, d).find((i) => i.key === key);
    if (!it) return 0;
    if (n === 'max') n = 1e9;
    return buyUnits(s, it, n, d);
  }
  function setTarget(s, key, n) {
    n = Math.max(0, Math.min(999, Math.floor(n)));
    if (key.startsWith('b:')) {
      const bp = s.bps.find((b) => 'b:' + b.id === key);
      if (bp) bp.target = n;
    } else s.target[key] = n;
  }

  const upLevel = (s, id) => s.up[id] || 0;
  const upCost = (s, u) => Math.ceil(u.base * Math.pow(u.grow, upLevel(s, u.id)));
  function upUnlocked(s, u) {
    return yearOf(s) >= u.year && (!u.req || upLevel(s, u.req) > 0);
  }
  function buyUp(s, id) {
    const u = CS.UP_BY_ID[id];
    if (!u || !upUnlocked(s, u)) return false;
    const L = upLevel(s, id);
    const cost = upCost(s, u);
    if (L >= u.max || s.cash < cost) return false;
    s.cash -= cost;
    s.up[id] = L + 1;
    return true;
  }

  function createBp(s, name, parts, markup) {
    const d = derive(s);
    if (!d.workshop) return { ok: false, err: 'Build the Workshop first.' };
    if (s.bps.length >= d.benchSlots) return { ok: false, err: 'No free blueprint slot. Buy a Design Bench or delete an old blueprint.' };
    for (const sl of CS.SLOTS) {
      const p = CS.PART_BY_ID[parts[sl.id]];
      if (!p || !partAvail(p, d.y)) return { ok: false, err: 'Pick a part for every slot.' };
    }
    const bp = { id: 'bp' + s.bpSeq++, name: (name || 'Custom PC').slice(0, 28), parts: Object.assign({}, parts), markup: Math.max(0, Math.min(2, markup)), target: 0 };
    s.bps.push(bp);
    return { ok: true, bp };
  }
  function deleteBp(s, id) {
    const key = 'b:' + id;
    if (s.stock[key] > 0) return false;
    s.bps = s.bps.filter((b) => b.id !== id);
    delete s.stock[key];
    delete s.acc[key];
    return true;
  }

  /* ---------- simulation ---------- */
  function pickSegmentProb(live, seg, y) {
    const ref = refPrice(y);
    const ws = live.map((i) => Math.pow(i.rel, seg.a) * Math.pow(Math.max(0.4, i.price / ref), -seg.b));
    const tot = ws.reduce((a, b) => a + b, 0);
    return { ws, tot, p: Math.min(0.95, 1 - Math.exp(-tot / K)) };
  }

  function sellUnits(s, it, k, rep, events) {
    s.stock[it.key] -= k;
    it.stock -= k;
    const rev = k * it.price;
    s.cash += rev;
    s.stats.sold += k;
    s.stats.revenue += rev;
    if (rep) {
      rep.sold[it.key] = (rep.sold[it.key] || 0) + k;
      rep.names[it.key] = it.name;
      rep.revenue += rev;
      rep.units += k;
    }
    if (events) events.push({ it, k, rev });
    return rev;
  }

  function step(s, dt, calRate, rep, events) {
    const wasToday = s.cal >= C.END_CAL;
    if (!wasToday) s.cal = Math.min(C.END_CAL, s.cal + (dt / C.YEAR_SECONDS) * calRate);
    s.stats.play += dt;
    s.hustleCd = Math.max(0, s.hustleCd - dt);
    const d = derive(s);
    const items = getItems(s, d);
    let spent = 0;

    // auto-restock prebuilts
    if (d.restock > 0) {
      s.rAcc = Math.min(6, s.rAcc + d.restock * dt);
      for (const it of items) {
        if (s.rAcc < 1) break;
        if (it.kind !== 'pre' || !it.buyable || it.stock >= it.target) continue;
        const k = buyUnits(s, it, Math.min(Math.floor(s.rAcc), it.target - it.stock), d);
        s.rAcc -= k;
        spent += k * it.cost;
        if (!k) break; // out of cash or shelf space
      }
    }
    // auto-build blueprints
    if (d.workshop && d.build > 0) {
      s.bAcc = Math.min(4, s.bAcc + d.build * dt);
      for (const it of items) {
        if (s.bAcc < 1) break;
        if (it.kind !== 'bp' || !it.canBuild || it.stock >= it.target) continue;
        const room = d.cap - totalStock(s);
        const k = Math.max(0, Math.min(Math.floor(s.bAcc), it.target - it.stock, room, Math.floor(s.cash / it.cost)));
        if (!k) continue;
        s.cash -= k * it.cost;
        s.stock[it.key] = (s.stock[it.key] || 0) + k;
        it.stock += k;
        s.bAcc -= k;
        s.stats.built += k;
        spent += k * it.cost;
        if (rep) rep.built += k;
      }
    }

    // customers
    const served = Math.min(d.lambda, d.serve) * dt;
    const busy = Math.max(0, d.lambda - d.serve) * dt;
    s.stats.lost += busy;
    if (rep) rep.busy += busy;
    const live = items.filter((i) => i.stock > 0);
    let revenue = 0;
    if (!live.length) {
      s.stats.stockouts += served;
      if (rep) rep.stockouts += served;
    } else {
      const exp = new Array(live.length).fill(0);
      SEG.forEach((seg) => {
        const r = pickSegmentProb(live, seg, d.y);
        if (r.tot <= 0) return;
        for (let i = 0; i < live.length; i++) exp[i] += (served * seg.share * r.p * r.ws[i]) / r.tot;
      });
      let sold = 0;
      for (let i = 0; i < live.length; i++) {
        const it = live[i];
        const acc = (s.acc[it.key] || 0) + exp[i];
        const whole = Math.floor(acc);
        const k = Math.min(whole, it.stock);
        s.acc[it.key] = acc - whole;
        if (k > 0) revenue += sellUnits(s, it, k, rep, events);
        sold += exp[i];
        if (k < whole) {
          s.stats.stockouts += whole - k;
          if (rep) rep.stockouts += whole - k;
        }
      }
    }

    // safety net: never let the shop get stuck broke with empty shelves
    if (!live.length && totalStock(s) === 0) {
      const cheapest = items.filter((i) => i.buyable).reduce((m, i) => Math.min(m, i.cost), Infinity);
      if (isFinite(cheapest) && s.cash < cheapest) {
        s.cash = cheapest * 2;
        s.stats.bailouts = (s.stats.bailouts || 0) + 1;
        if (rep) rep.bailouts = (rep.bailouts || 0) + 1;
        if (events) events.push({ bailout: cheapest * 2 });
      }
    }

    // upkeep (never drives cash negative)
    const upkeep = Math.min(s.cash, d.upkeep * dt);
    s.cash -= upkeep;
    if (rep) {
      rep.upkeep += upkeep;
      rep.spent += spent;
    }

    const f = 1 - Math.exp(-dt / 20);
    s.rate.rev += (revenue / dt - s.rate.rev) * f;
    s.rate.up += (d.upkeep - s.rate.up) * f;
    return checkAch(s);
  }

  function checkAch(s) {
    let fresh = null;
    for (const a of CS.ACH) {
      if (!s.ach[a.id] && a.ok(s)) {
        s.ach[a.id] = 1;
        (fresh = fresh || []).push(a);
      }
    }
    return fresh;
  }

  function newReport() {
    return { sold: {}, names: {}, revenue: 0, units: 0, upkeep: 0, spent: 0, built: 0, busy: 0, stockouts: 0 };
  }

  function advance(s, seconds, calRate, rep) {
    const h = seconds > 7200 ? 5 : seconds > 300 ? 2 : 1;
    let left = seconds;
    let fresh = [];
    while (left > 1e-9) {
      const dt = Math.min(h, left);
      const a = step(s, dt, calRate, rep);
      if (a) fresh = fresh.concat(a);
      left -= dt;
    }
    return fresh;
  }

  /** Catch up after the game was closed. Returns a report for the welcome-back screen. */
  function offline(s, elapsed) {
    const d0 = derive(s);
    const eff = Math.max(0, Math.min(elapsed, d0.offlineCap));
    const rep = newReport();
    rep.elapsed = elapsed;
    rep.effective = eff;
    rep.capped = elapsed > eff;
    rep.cap = d0.offlineCap;
    rep.cash0 = s.cash;
    rep.year0 = d0.y;
    s.stats.offline += eff;
    rep.ach = advance(s, eff, C.OFFLINE_CAL_RATE, rep);
    rep.cash1 = s.cash;
    rep.year1 = yearOf(s);
    return rep;
  }

  /** Active "hard sell": one real customer, rolled randomly, with a boosted chance to buy. */
  function hustle(s) {
    if (s.hustleCd > 0) return null;
    s.hustleCd = 3;
    s.stats.hustles++;
    const d = derive(s);
    const live = getItems(s, d).filter((i) => i.stock > 0);
    if (!live.length) return { none: true };
    let r = Math.random(), seg = SEG[SEG.length - 1];
    for (const sg of SEG) {
      if ((r -= sg.share) < 0) { seg = sg; break; }
    }
    const q = pickSegmentProb(live, seg, d.y);
    if (Math.random() > Math.min(0.98, q.p + 0.25)) return { passed: true };
    let pick = Math.random() * q.tot, idx = 0;
    for (let i = 0; i < live.length; i++) {
      if ((pick -= q.ws[i]) < 0) { idx = i; break; }
    }
    const it = live[idx];
    const events = [];
    sellUnits(s, it, 1, null, events);
    return { sold: it, rev: it.price };
  }

  /** Returns newly-available prebuilts since last call (for "new model" toasts). */
  function newProducts(s) {
    const y = yearOf(s);
    const out = [];
    CS.PRODUCTS.forEach((p) => {
      if (p.year <= y && !s.seen[p.id]) {
        s.seen[p.id] = 1;
        out.push(p);
      }
    });
    return out;
  }

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dateStr = (y) => MONTHS[Math.min(11, Math.floor((y % 1) * 12))] + ' ' + Math.floor(y);

  CS.E = {
    SEG, infl, refPrice, newState, migrate, serialize, deserialize, yearOf, eraAt, eventsAt, derive,
    partAvail, partRel, partPrice, bpInfo, designInfo, totalStock, getItems, buy, buyUnits, setTarget,
    upLevel, upCost, upUnlocked, buyUp, createBp, deleteBp, step, advance, offline, hustle, newProducts,
    newReport, checkAch, dateStr,
  };
  if (typeof module !== 'undefined') module.exports = CS;
})(typeof window !== 'undefined' ? window : globalThis);
