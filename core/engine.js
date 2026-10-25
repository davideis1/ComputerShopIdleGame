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
    { id: 'budget', share: 0.45, a: 0.9, b: 2.6, c0: 0.75 },
    { id: 'main', share: 0.4, a: 1.3, b: 1.8, c0: 1.3 },
    { id: 'enth', share: 0.15, a: 2.0, b: 0.8, c0: 2.3 },
  ];
  const CUSTOM_BONUS = 1.4;
  const ADDON_SCALE = 0.5; // overall add-on attach tuning (see CLAUDE.md "Economy balance")
  const K = 0.8; // how easily customers are convinced to buy

  /* ---------- state ---------- */
  function newMeta() {
    return { tokens: 0, earned: 0, resets: 0, tup: {}, lifeRevenue: 0, lifeSold: 0, lifeUnits: 0, bestRevenue: 0 };
  }
  /** Every unit sold this run: PCs, games, accessories, consoles and console games/accessories. */
  function unitsSold(st) {
    return (st.sold || 0) + (st.soldGames || 0) + (st.soldAcc || 0) + (st.soldConsoles || 0) + (st.soldCGames || 0) + (st.soldCAcc || 0);
  }
  const tl = (s, id) => (s.meta && s.meta.tup[id]) || 0;

  /** meta (Franchise Tokens and their upgrades) survives resets; everything else starts fresh. */
  function newState(meta) {
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
      stats: { sold: 0, soldGames: 0, soldAcc: 0, soldConsoles: 0, soldCGames: 0, soldCAcc: 0, consoleRevenue: 0, addonRevenue: 0, revenue: 0, built: 0, lost: 0, stockouts: 0, hustles: 0, play: 0, offline: 0,
        repairs: 0, serviceRevenue: 0, svcLost: 0, warranties: 0, warrantyRevenue: 0, claimsPaid: 0 },
      claims: 0, // warranty claims still to be paid out
      sAcc: 0, // fractional repair jobs
      ach: {},
      seen: {},
      aAcc: 0,
      ib: {}, // consoles sold per platform: your installed base
      pcRel: 0.9, // recent quality of the PCs this shop sells; decides which games can run
      rate: { rev: 0, up: 0 },
      rep: 3, // shop rating, 1-5 stars (see reputationTick)
      settings: { theme: 'auto' },
      meta: meta || newMeta(),
    };
    if (CS.M) CS.M.init(s);
    s.freeHires = tl(s, 't_mgr_free');
    ['t_cash', 't_kit', 't_mgr_office', 't_head'].forEach((id) => startBonus(s, id, 0, tl(s, id)));
    return s;
  }
  const headStart = (L) => C.HEAD_STARTS[Math.min(C.HEAD_STARTS.length - 1, L)];
  /** Apply an HQ upgrade that shapes the opening of a franchise, going from level `from` to `to`.
      Runs at newState, and again when one is bought while the franchise is still fresh (no sale yet). */
  function startBonus(s, id, from, to) {
    switch (id) {
      case 't_cash': s.cash += 7500 * (to - from); break;
      case 't_kit':
        s.up.clerk = Math.max(s.up.clerk || 0, to); s.up.ads_news = Math.max(s.up.ads_news || 0, 2 * to);
        s.up.shelf = Math.max(s.up.shelf || 0, to); s.up.sales = Math.max(s.up.sales || 0, to);
        break;
      case 't_mgr_office': if (to) s.up.purchasing = 1; break;
      case 't_head': {
        const a = headStart(from), b = headStart(to);
        s.cal = Math.max(s.cal, b.cal);
        s.cash += b.cash - a.cash;
        break;
      }
    }
    // products from before the opening year aren't "new"
    CS.PRODUCTS.forEach((p) => { if (p.year <= C.START_YEAR + s.cal) s.seen[p.id] = 1; });
  }
  /** Calendar speed multiplier from Time Warp (only before WARP_UNTIL). */
  const calSpeed = (s) => (s.cal < C.WARP_UNTIL ? 1 + 0.15 * Math.min(C.WARP_MAX, tl(s, 't_warp')) : 1);
  /** The year the next franchise opens in. */
  const startYear = (s) => C.START_YEAR + headStart(tl(s, 't_head')).cal;

  function migrate(raw) {
    const base = newState();
    const s = Object.assign(base, raw);
    s.stats = Object.assign(base.stats, raw.stats || {});
    s.rate = Object.assign(base.rate, raw.rate || {});
    s.settings = Object.assign(base.settings, raw.settings || {});
    if (!isFinite(s.pcRel)) s.pcRel = 0.9;
    s.freeHires = isFinite(raw.freeHires) ? raw.freeHires : 0;
    s.ib = Object.assign({}, raw.ib || {});
    s.lastAway = raw.lastAway || null;
    s.mgr = raw.mgr || null; s.mgrCfg = raw.mgrCfg || {}; s.mgrPool = raw.mgrPool || {}; s.mAcc = raw.mAcc || {}; s.vel = raw.vel || {};
    if (CS.M) CS.M.init(s);
    if (CS.Names) CS.Names.migrate(s); // buyers' blocked brand names after the game/console renames
    s.meta = Object.assign(newMeta(), raw.meta || {});
    if (!raw.meta || !isFinite(raw.meta.lifeUnits)) s.meta.lifeUnits = s.meta.lifeSold; // older saves only counted PCs
    s.meta.tup = Object.assign({}, (raw.meta && raw.meta.tup) || {});
    ['up', 'stock', 'target', 'acc', 'ach', 'seen'].forEach((k) => (s[k] = Object.assign({}, raw[k] || (k === 'seen' ? base.seen : {}))));
    s.bps = Array.isArray(raw.bps) ? raw.bps.filter((b) => b && b.parts) : [];
    CS.UPGRADES.forEach((u) => { if (s.up[u.id] > u.max) s.up[u.id] = u.max; }); // a max lowered in a balance pass
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
  // A season in a given year, as an event with real dates (cached so the same season-year is the same object).
  const seasonCache = {};
  function seasonEvent(x, Y) {
    const k = x.id + Y;
    return seasonCache[k] || (seasonCache[k] = Object.assign({}, x, { id: 'season_' + x.id, from: Y + x.from, to: Y + x.to, season: true }));
  }
  function eventsAt(y) {
    const r = { demand: 1, gpuCost: 1, partCost: 1, preCost: 1, kinds: {}, list: [] };
    const take = (e) => {
      r.list.push(e);
      r.demand *= e.demand || 1;
      r.gpuCost *= e.gpuCost || 1;
      r.partCost *= e.partCost || 1;
      r.preCost *= e.preCost || 1;
      if (e.kinds) Object.keys(e.kinds).forEach((k) => (r.kinds[k] = (r.kinds[k] || 1) * e.kinds[k]));
    };
    CS.EVENTS.forEach((e) => { if (y >= e.from && y < e.to) take(e); });
    const Y = Math.floor(y), f = y - Y;
    (CS.SEASONS || []).forEach((x) => { if (f >= x.from && f < x.to) take(seasonEvent(x, Y)); });
    return r;
  }
  /** Seasonal boost to how often shoppers pick up a kind of item (games at Christmas, etc.). */
  const kindBoost = (d, kind) => (d.ev.kinds && d.ev.kinds[kind]) || 1;

  /* ---------- derived stats ---------- */
  function derive(s) {
    const y = yearOf(s);
    const ev = eventsAt(y);
    const lv = (id) => s.up[id] || 0;
    let lambda = 0.06, serve = 0.25, restock = 0, build = 0, buildMult = 1, serveMult = 1;
    let cap = 12, disc = 0, night = 4, bench = 2, loyal = 0, upkeep = 0, upsell = 0;
    let aisleGame = false, aisleAcc = false, aisleConsole = false, office = false, svcDesk = false, svc = 0, warranty = 0;
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
        case 'office': office = true; break;
        case 'aisle_game': aisleGame = true; break;
        case 'aisle_console': aisleConsole = true; break;
        case 'aisle_acc': aisleAcc = true; break;
        case 'attach': upsell += u.per * L; break;
        case 'svc_desk': svcDesk = true; break;
        case 'svc': svc += u.per * L; break;
        case 'warranty': warranty += u.per * L; break;
      }
      if (u.up) upkeep += u.up * L;
    });
    const achCount = Object.keys(s.ach).length;
    disc += 0.01 * tl(s, 't_supply');
    night += 2 * tl(s, 't_night');
    const rent = 0.2 * Math.pow(1 + lv('shelf'), 1.2) * infl(y);
    const out = {
      y,
      ev,
      lambda: lambda * (1 + loyal) * (1 + 0.01 * achCount) * (1 + 0.1 * tl(s, 't_income')) * ev.demand * repMult(s) * (s.boost && s.stats.play <= s.boost.until ? s.boost.demand : 1),
      serve: serve * serveMult,
      restock,
      build: build * buildMult,
      cap: Math.round(cap * (1 + 0.1 * tl(s, 't_cap'))),
      profit: 1 + 0.03 * tl(s, 't_profit'),
      customBonus: CUSTOM_BONUS + 0.05 * tl(s, 't_build'),
      disc: Math.min(0.5, disc),
      offlineCap: night * 3600,
      benchSlots: bench,
      upkeep: upkeep * wageInfl(y) + rent,
      workshop: lv('workshop') > 0,
      aisleGame,
      aisleAcc,
      aisleConsole,
      office,
      upsell,
      achCount,
      service: svcDesk,
      svcCap: svcDesk ? SVC_BASE + svc : 0, // repair jobs per second the desk can handle
      warranty: svcDesk ? WARRANTY_BASE + warranty : 0, // share of PC buyers who add a warranty
    };
    out.svc = serviceAt(y);
    out.svcDemand = svcDesk ? out.lambda * SVC_SHARE * out.svc.mix : 0; // walk-in repair jobs per second
    if (CS.M) {
      out.mgr = CS.M.derive(s, out);
      out.upkeep += out.mgr.wages;
      out.customBonus += out.mgr.designBonus || 0;
    }
    return out;
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
    let rel = d.customBonus || CUSTOM_BONUS; // hand-assembled, no bloatware
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

  const isAddon = (k) => k === 'game' || k === 'acc' || k === 'cgame' || k === 'cacc';
  const sizeMemo = new Map(); // item sizes never change; this is on the hot path (every purchase checks shelf room)
  function itemSize(key) { // shelf spaces per unit: a PC is 1, small items less
    let v = sizeMemo.get(key);
    if (v !== undefined) return v;
    if (CS.Con && (key[0] === 'c' || key[0] === 'x' || key[0] === 'y')) v = CS.Con.size(key);
    else if (key[0] === 'g' || key[0] === 'a') {
      const a = CS.ADDON_BY_ID[key.slice(2)];
      v = a ? CS.GROUP_BY_ID[a.group].size : 1;
    } else v = 1;
    sizeMemo.set(key, v);
    return v;
  }
  function slotsUsed(s) {
    let n = 0;
    const st = s.stock;
    for (const k in st) { const q = st[k]; if (q) n += q * itemSize(k); } // most keys are long-gone items at 0
    return n;
  }
  const totalStock = (s) => Math.ceil(slotsUsed(s) - 1e-9);

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
    CS.ADDONS.forEach((a) => {
      if (a.year > d.y) return;
      const grp = CS.GROUP_BY_ID[a.group];
      const game = a.kind === 'game';
      const key = (game ? 'g:' : 'a:') + a.id;
      const stock = s.stock[key] || 0;
      const age = d.y - a.year;
      const buyable = (game ? d.aisleGame : d.aisleAcc) && age <= grp.window;
      if (!buyable && !stock) return;
      const base = a.price * (game ? Math.max(0.25, Math.pow(0.78, age)) : Math.max(0.4, Math.pow(0.9, age)));
      let capF = 1, req = 0;
      if (game) { // can the PCs this shop sells run it? (hardware catches up with a game as it ages)
        req = a.req * Math.pow(C.G, -age);
        capF = Math.pow(Math.min(1, (s.pcRel * 1.15) / Math.max(0.05, req)), 1.5);
      }
      out.push({
        key, kind: a.kind, id: a.id, def: a, name: a.name, brand: a.brand, icon: a.icon, group: a.group,
        size: grp.size, pack: grp.pack, age, rel: a.q * Math.pow(grp.decay, -age), price: base * (1 + s.priceAdj),
        cost: base * (1 - a.m) * (1 - d.disc), stock, buyable, target: s.target[key] || 0, capF, req,
      });
    });
    if (CS.Con) CS.Con.addItems(s, d, out);
    if (CS.M) CS.M.decorate(s, d, out);
    return out;
  }

  /* ---------- actions ---------- */
  function buyUnits(s, it, n, d) {
    if (!it.buyable) return 0;
    const used = d.used != null ? d.used : slotsUsed(s);
    const room = Math.floor((d.cap - used + 1e-9) / (it.size || 1));
    const afford = Math.floor(s.cash / it.cost);
    let k = Math.max(0, Math.min(n, room, afford));
    if (it.allocCap != null) k = Math.min(k, Math.max(0, it.allocCap - it.stock)); // launch allocation
    if (!k) return 0;
    if (d.used != null) d.used += k * (it.size || 1);
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
    n = Math.max(0, Math.min(99999, Math.floor(n)));
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
  // How attractive an item is to a segment: value for money, collapsing once the price is beyond their budget
  function itemWeight(seg, rel, price, y, ref) {
    const r = ref || refPrice(y);
    const c = Math.max(0.4, price / r);
    return (Math.pow(rel, seg.a) * Math.pow(c, -seg.b)) / (1 + Math.pow(price / r / seg.c0, 3));
  }
  function pickSegmentProb(live, seg, y) {
    const ws = live.map((i) => itemWeight(seg, i.rel, i.price, y));
    const tot = ws.reduce((a, b) => a + b, 0);
    return { ws, tot, p: Math.min(0.95, 1 - Math.exp(-tot / K)) };
  }

  /* ---------- Reputation ----------
     A 1-5 star rating that drifts toward what recent customers experienced: could they find stock, did they get served,
     were the PCs any good, and did the repair counter keep up. It scales how many shoppers come (-15% at 1★, +15% at 5★). */
  const REP_TAU = 600, REP_RATE_TAU = 120; // seconds: how slowly the rating moves / how far back it remembers
  const REP_FACTORS = [
    { id: 'stock', label: 'Stock on the shelves', w: 0.35, tip: 'Shoppers found what they wanted out of stock. Raise restock targets or hire a buyer.' },
    { id: 'speed', label: 'Checkout speed', w: 0.3, tip: 'Shoppers walked out of long queues. Hire sales staff or add checkouts.' },
    { id: 'quality', label: 'Quality of the PCs you sell', w: 0.25, tip: 'The PCs you sell are behind the times. Stock newer models or build better ones.' },
    { id: 'repairs', label: 'Repairs', w: 0.1, tip: 'Open the Service Desk, and keep up with walk-in repair jobs.' },
  ];
  const repMult = (s) => 0.85 + 0.075 * ((s.rep == null ? 3 : s.rep) - 1);
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  /** Factor scores 0..1 from the remembered rates. */
  function repScores(s, d) {
    const r = s.rate;
    const arr = (r.srv || 0) + (r.busy || 0);
    return {
      stock: r.srv > 1e-6 ? 1 - clamp01((r.so || 0) / r.srv) : 0.5,
      speed: arr > 1e-6 ? 1 - clamp01((2 * (r.busy || 0)) / arr) : 0.5,
      quality: clamp01((s.pcRel - 0.4) / 0.8), // pcRel runs ~0.6-1.25 in play: 0.8 scores 0.5
      repairs: !d.service ? 0.3 : d.svcDemand > 0 ? 0.6 + 0.4 * Math.min(1, d.svcCap / d.svcDemand) : 1,
    };
  }
  function repTarget(sc) {
    return 1 + 4 * REP_FACTORS.reduce((a, f) => a + f.w * sc[f.id], 0);
  }
  function reputationTick(s, d, dt, served, busy, stockouts) {
    const r = s.rate, f = 1 - Math.exp(-dt / REP_RATE_TAU);
    r.srv = (r.srv || 0) + (served / dt - (r.srv || 0)) * f;
    r.busy = (r.busy || 0) + (busy / dt - (r.busy || 0)) * f;
    r.so = (r.so || 0) + (stockouts / dt - (r.so || 0)) * f;
    const target = repTarget(repScores(s, d));
    s.rep = (s.rep == null ? 3 : s.rep) + (target - (s.rep == null ? 3 : s.rep)) * (1 - Math.exp(-dt / REP_TAU));
  }
  /** What the reputation panel shows (web and app): stars, where it is heading, and what each factor costs. */
  function reputationView(s, d) {
    const sc = repScores(s, d);
    const factors = REP_FACTORS.map((f) => ({ id: f.id, label: f.label, score: sc[f.id], cost: 4 * f.w * (1 - sc[f.id]), tip: f.tip }));
    const worst = factors.slice().sort((a, b) => b.cost - a.cost)[0];
    const stars = s.rep == null ? 3 : s.rep, n = Math.round(stars);
    return { stars, label: '★'.repeat(n) + '☆'.repeat(5 - n), target: repTarget(sc), effect: repMult(s) - 1, factors, worst: worst.cost > 0.15 ? worst : null };
  }

  /* ---------- Service Desk ---------- */
  const SVC_BASE = 0.04; // the owner fixes a PC every 25 s
  const SVC_SHARE = 0.18; // walk-in repair jobs per arriving shopper, with a typical service menu
  const WARRANTY_BASE = 0.12, WARRANTY_PRICE = 0.12, WARRANTY_CLAIMS = 0.4, CLAIM_TAU = 900;
  /** Services on offer in year y: list, demand mix (1 = typical menu) and average price per job. */
  const svcCache = { k: -1, v: null };
  function serviceAt(y) {
    const k = Math.round(y * 50);
    if (svcCache.k === k) return svcCache.v;
    y = k / 50; // the bucket's own year, so the result doesn't depend on what ran before
    const list = CS.SERVICES.filter((x) => y >= x.from && y < x.to);
    const w = list.reduce((a, x) => a + x.w, 0);
    const avg = w > 0 ? list.reduce((a, x) => a + x.w * x.price, 0) / w : 0;
    svcCache.k = k;
    svcCache.v = { list, mix: Math.min(1.5, w / 2.5), price: avg * infl(y) };
    return svcCache.v;
  }
  const SVC_ITEM = { key: 'svc', name: 'Repairs & services', kind: 'svc', icon: '🛎️' };
  const WARRANTY_ITEM = { key: 'warranty', name: 'Extended warranties', kind: 'warranty', icon: '📜' };
  /** Repair jobs: walk-ins up to the desk's capacity, paid at the era's going rate. */
  function serviceTick(s, d, dt, rep, events) {
    if (!d.service) return 0;
    const done = Math.min(d.svcDemand, d.svcCap);
    s.stats.svcLost += (d.svcDemand - done) * dt;
    const acc = (s.sAcc || 0) + done * dt;
    const k = Math.floor(acc);
    s.sAcc = acc - k;
    if (k < 1) return 0;
    const rev = k * d.svc.price * d.profit;
    s.cash += rev;
    s.stats.repairs += k;
    s.stats.serviceRevenue += rev;
    s.stats.revenue += rev;
    s.fresh = false;
    if (rep) { rep.sold.svc = (rep.sold.svc || 0) + k; rep.names.svc = SVC_ITEM.name; rep.revenue += rev; }
    if (events) events.push({ it: SVC_ITEM, k, rev });
    return rev;
  }
  /** Everything the Service Desk panel shows (web and app render this as-is). Per-minute figures. */
  function serviceView(s, d) {
    const done = Math.min(d.svcDemand, d.svcCap);
    const desk = CS.UP_BY_ID.svc_desk;
    return {
      open: d.service,
      available: d.y >= desk.year,
      openCost: upCost(s, desk),
      jobs: done * 60,
      walkIns: d.svcDemand * 60,
      capacity: d.svcCap * 60,
      turnedAway: Math.max(0, d.svcDemand - d.svcCap) * 60,
      busy: d.svcDemand - d.svcCap > Math.max(0.01, 0.1 * d.svcDemand), // turning away more than a tenth of walk-ins
      income: done * d.svc.price * d.profit * 60,
      menu: d.svc.list.map((x) => ({ id: x.id, name: x.name, icon: x.icon, price: x.price * infl(d.y) * d.profit })),
      warrantyShare: d.warranty,
      repairs: s.stats.repairs || 0,
      repairRevenue: s.stats.serviceRevenue || 0,
      warranties: s.stats.warranties || 0,
      warrantyRevenue: s.stats.warrantyRevenue || 0,
      claimsPaid: s.stats.claimsPaid || 0,
      claimsDue: s.claims || 0,
    };
  }
  /** What a phone should remind the player about if they leave now: [{ id, seconds (from now), title, body }].
      Used by the app's local notifications (app/src/notify.ts). */
  function remindersAt(s, opt) {
    const d = derive(s);
    const out = [];
    const cap = d.offlineCap;
    opt = opt || {};
    const lead = Math.max(0, Math.min(180, (opt.leadMin || 0))) * 60; // remind this long before earning stops
    out.push({ id: 'night', seconds: cap - lead, title: '🌙 The night shift has clocked off', body: s.name + ' traded for ' + Math.round(cap / 360) / 10 + ' hours without you. Come back to collect the takings and restock.' });
    // nobody restocks (no clerk, no buyers): when do the PCs on the shelf run out? (~half of served shoppers buy one)
    if (!d.restock && !(d.mgr && d.mgr.count)) {
      const pcs = getItems(s, d).filter((i) => (i.kind === 'pre' || i.kind === 'bp') && i.stock > 0).reduce((a, i) => a + i.stock, 0);
      const rate = Math.min(d.lambda, d.serve) * 0.5;
      const secs = rate > 0 ? pcs / rate : Infinity;
      if (pcs > 0 && secs > 120 && secs < cap) out.push({ id: 'empty', seconds: secs, title: '🛒 Your shelves are probably empty', body: 'Nobody is restocking while you are away. Hire a Stock Clerk so the shop keeps selling.' });
    }
    // the next console launch while away (the calendar crawls offline)
    const perSec = (C.OFFLINE_CAL_RATE * calSpeed(s)) / C.YEAR_SECONDS;
    const next = d.aisleConsole && CS.PLATFORMS ? CS.PLATFORMS.filter((p) => p.year > d.y && (p.year - d.y) / perSec < cap).sort((a, b) => a.year - b.year)[0] : null;
    if (next) out.push({ id: 'launch', seconds: (next.year - d.y) / perSec, title: '🎮 ' + next.name + ' launches today', body: 'Queues round the block and stock is limited. Get your allocation in.' });
    // a Franchise Token becomes claimable while away (revenue at today's rate reaches the next token)
    const rev = Math.max(0, s.rate.rev);
    if (rev > 0 && s.stats.revenue >= 0) {
      const secs = (nextTokenAt(s) - s.stats.revenue) / rev;
      if (pendingTokens(s) < 1 && secs > 60 && secs < cap) out.push({ id: 'tokens', seconds: secs, title: '🎫 A Franchise Token is ready', body: 'Your shop has made enough to cash in. Open the HQ tab to claim it.' });
    }
    // a Service Desk that turns jobs away all night, with nobody managing it
    if (d.service && d.svcDemand > d.svcCap * 1.2 && !(d.mgr && d.mgr.cats.svc && d.mgr.cats.svc.on)) {
      out.push({ id: 'service', seconds: Math.min(cap, 3600), title: '🛎️ Your Service Desk is turning jobs away', body: 'More repair jobs are walking in than the desk can handle. Hire technicians in the Service tab, or a Service Desk manager.' });
    }
    const kinds = opt.kinds || {};
    return out.filter((r) => r.seconds >= 60 && kinds[r.id] !== false);
  }
  /** Warranty claims trickle in over time; returns what was paid this step. */
  function payClaims(s, dt) {
    if (!(s.claims > 0)) return 0;
    const pay = s.claims * (1 - Math.exp(-dt / CLAIM_TAU));
    s.claims -= pay;
    s.cash -= pay;
    s.stats.claimsPaid += pay;
    return pay;
  }

  function sellUnits(s, it, k, rep, events, mult) {
    s.stock[it.key] -= k;
    it.stock -= k;
    const rev = k * it.price * (mult || 1);
    s.cash += rev;
    if (it.kind === 'game') s.stats.soldGames += k;
    else if (it.kind === 'acc') s.stats.soldAcc += k;
    else if (it.kind === 'console' || it.kind === 'cgame' || it.kind === 'cacc') CS.Con.stat(s, it, k, rev);
    else s.stats.sold += k;
    if (it.kind === 'game' || it.kind === 'acc') s.stats.addonRevenue += rev;
    let wRev = 0;
    if (s.up.svc_desk && (it.kind === 'pre' || it.kind === 'bp')) {
      // extended warranties: a share of PC buyers pay ~12% of the price; ~40% of that comes back as claims later
      const share = WARRANTY_BASE + CS.UP_BY_ID.warranty.per * (s.up.warranty || 0);
      wRev = k * share * it.price * WARRANTY_PRICE * (mult || 1);
      s.cash += wRev;
      s.claims = (s.claims || 0) + wRev * WARRANTY_CLAIMS;
      s.stats.warranties += k * share;
      s.stats.warrantyRevenue += wRev;
    }
    s.stats.revenue += rev + wRev;
    s.fresh = false;
    if (CS.M) CS.M.noteSale(s, it.key, k);
    if (CS.Con) CS.Con.noteSale(s, it, k);
    if (rep) {
      rep.sold[it.key] = (rep.sold[it.key] || 0) + k;
      rep.names[it.key] = it.name;
      rep.revenue += rev + wRev;
      rep.units += k;
    }
    if (events) {
      events.push({ it, k, rev });
      if (wRev > 0) events.push({ it: WARRANTY_ITEM, k: 0, rev: wRev }); // k 0: a log line, no extra walker
    }
    return rev + wRev;
  }

  function step(s, dt, calRate, rep, events) {
    const wasToday = s.cal >= C.END_CAL;
    if (!wasToday) s.cal = Math.min(C.END_CAL, s.cal + (dt / C.YEAR_SECONDS) * calRate * calSpeed(s));
    s.stats.play += dt;
    s.hustleCd = Math.max(0, s.hustleCd - dt);
    const d = derive(s);
    const items = getItems(s, d);
    d.used = slotsUsed(s); // shelf space in use, kept current by this step's purchases (all of which come before sales)
    let spent = 0;

    // purchasing managers place their own orders
    if (CS.M) spent += CS.M.restock(s, d, items, dt);
    // auto-restock: PCs unit by unit; games & accessories by the case from their own order budget
    if (d.restock > 0) {
      s.rAcc = Math.min(Math.max(6, d.restock * dt * 2), s.rAcc + d.restock * dt);
      s.aAcc = Math.min(Math.max(6, d.restock * dt * 2), (s.aAcc || 0) + d.restock * dt);
      for (const it of items) {
        if (it.kind === 'bp' || it.managed || !it.buyable || it.stock >= it.target) continue;
        const addon = isAddon(it.kind); // ordered by the case, not unit by unit
        const budget = addon ? s.aAcc : s.rAcc;
        if (budget < 1) continue;
        const want = addon ? Math.min(it.pack, it.target - it.stock) : Math.min(Math.floor(budget), it.target - it.stock);
        const k = buyUnits(s, it, want, d);
        if (!k) continue; // out of cash or shelf space
        if (addon) s.aAcc -= 1; else s.rAcc -= k;
        spent += k * it.cost;
      }
    }
    // auto-build blueprints
    if (d.workshop && d.build > 0) {
      s.bAcc = Math.min(Math.max(4, d.build * dt * 2), s.bAcc + d.build * dt);
      for (const it of items) {
        if (s.bAcc < 1) break;
        if (it.kind !== 'bp' || !it.canBuild || it.stock >= it.target) continue;
        const room = Math.floor(d.cap - d.used + 1e-9);
        const k = Math.max(0, Math.min(Math.floor(s.bAcc), it.target - it.stock, room, Math.floor(s.cash / it.cost)));
        if (!k) continue;
        d.used += k;
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
    const so0 = s.stats.stockouts;
    const served = Math.min(d.lambda, d.serve) * dt;
    const busy = Math.max(0, d.lambda - d.serve) * dt;
    s.stats.lost += busy;
    if (rep) rep.busy += busy;
    const live = items.filter((i) => i.stock > 0 && (i.kind === 'pre' || i.kind === 'bp'));
    let revenue = 0, pcExp = 0, soldW = 0, soldN = 0;
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
        if (k > 0) { revenue += sellUnits(s, it, k, rep, events, d.profit); soldN += k; soldW += k * it.rel; }
        pcExp += exp[i];
        sold += exp[i];
        if (k < whole) {
          s.stats.stockouts += whole - k;
          if (rep) rep.stockouts += whole - k;
        }
      }
    }

    if (soldN > 0) s.pcRel += (soldW / soldN - s.pcRel) * Math.min(1, soldN * 0.05);

    // games & accessories: every shopper may add on, PC buyers twice as likely
    const pcShare = served > 0 ? Math.min(1, pcExp / served) : 0;
    const attach = (1 + pcShare) * (1 + d.upsell) * ADDON_SCALE;
    const addLive = served > 0 ? items.filter((i) => (i.kind === 'game' || i.kind === 'acc') && i.stock > 0) : [];
    if (addLive.length) {
      CS.GROUPS.forEach((grp) => {
        const gi = addLive.filter((i) => i.group === grp.id);
        if (!gi.length) return;
        const ref = grp.ref * Math.pow(grp.grow, d.y - 1993);
        const exp = new Array(gi.length).fill(0);
        SEG.forEach((seg) => {
          const ws = gi.map((i) => itemWeight(seg, i.rel, i.price, d.y, ref) * i.capF);
          const tot = ws.reduce((a, b) => a + b, 0);
          if (tot <= 0) return;
          const p = Math.min(0.95, 1 - Math.exp(-tot / K));
          for (let i = 0; i < gi.length; i++) exp[i] += (served * seg.share * p * ws[i] / tot) * grp.A * attach * kindBoost(d, grp.kind);
        });
        gi.forEach((it, i) => {
          const acc = (s.acc[it.key] || 0) + exp[i];
          const whole = Math.floor(acc);
          const k = Math.min(whole, it.stock);
          s.acc[it.key] = acc - whole;
          if (k > 0) revenue += sellUnits(s, it, k, rep, events, d.profit);
        });
      });
    }

    revenue += serviceTick(s, d, dt, rep, events);
    if (CS.M) CS.M.tick(s, d, items, dt);

    // consoles, console games and accessories (their own demand model and platform market)
    if (CS.Con) {
      revenue += CS.Con.sell(s, d, items, Math.min(d.lambda, d.serve), pcShare, dt, rep, events);
      CS.Con.tick(s, dt);
    }

    // safety net: never let the shop get stuck broke with empty shelves
    if (!live.length && s.stats.play - (s.bailAt || -1e9) > 600) { // at most one bailout per 10 minutes of play
      const cheapest = items.filter((i) => i.buyable && (i.kind === 'pre' || i.kind === 'bp')).reduce((m, i) => Math.min(m, i.cost), Infinity);
      if (isFinite(cheapest) && s.cash < cheapest) {
        s.cash = cheapest * 2;
        s.bailAt = s.stats.play;
        s.stats.bailouts = (s.stats.bailouts || 0) + 1;
        if (rep) rep.bailouts = (rep.bailouts || 0) + 1;
        if (events) events.push({ bailout: cheapest * 2 });
      }
    }

    // upkeep (never drives cash negative); warranty claims come out first
    const claims = payClaims(s, dt);
    if (rep) rep.upkeep += claims;
    const upkeep = Math.min(Math.max(0, s.cash), d.upkeep * dt);
    s.cash -= upkeep;
    if (rep) {
      rep.upkeep += upkeep;
      rep.spent += spent;
    }

    reputationTick(s, d, dt, served, busy, s.stats.stockouts - so0);
    if (CS.Offers) CS.Offers.tick(s, d, items, calRate);

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
    const h = seconds > 7200 ? 10 : seconds > 300 ? 2 : 1; // long gaps take 10 s steps: rate-based accumulators make that ~1-3% off and 40% faster
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

  /** Catch up after the game was closed, in one go. Returns a report for the welcome-back screen. */
  function offline(s, elapsed) {
    const job = offlineStart(s, elapsed);
    offlineRun(job, Infinity);
    return job.rep;
  }
  /** The same catch-up in slices, so a phone can keep drawing frames (and show progress) while it runs:
      const job = offlineStart(s, secs); while (!offlineRun(job, 200)) await nextFrame(); use job.rep.
      Same steps, same result as offline(). job.done / job.total give the progress. */
  function offlineStart(s, elapsed) {
    const d0 = derive(s);
    const eff = Math.max(0, Math.min(elapsed, d0.offlineCap));
    const rep = newReport();
    rep.elapsed = elapsed;
    rep.effective = eff;
    rep.capped = elapsed > eff;
    rep.cap = d0.offlineCap;
    rep.cash0 = s.cash;
    rep.year0 = d0.y;
    rep.ach = [];
    s.stats.offline += eff;
    s.lastAway = { elapsed, cap: d0.offlineCap, capped: elapsed > eff };
    return { s, rep, total: eff, left: eff, h: eff > 7200 ? 10 : eff > 300 ? 2 : 1, finished: false };
  }
  /** Runs up to maxSteps steps of a catch-up job. Returns true once it is finished (the report is then complete). */
  function offlineRun(job, maxSteps) {
    let n = 0;
    while (job.left > 1e-9 && n < maxSteps) {
      const dt = Math.min(job.h, job.left);
      const a = step(job.s, dt, C.OFFLINE_CAL_RATE, job.rep);
      if (a) job.rep.ach = job.rep.ach.concat(a);
      job.left -= dt;
      n++;
    }
    if (job.left <= 1e-9 && !job.finished) {
      job.finished = true;
      job.rep.cash1 = job.s.cash;
      job.rep.year1 = yearOf(job.s);
    }
    return job.finished;
  }

  const HUSTLE_CD = 3; // seconds between hustles
  const STREAK_GAP = 4; // a hustle within this many seconds of the cooldown ending keeps the streak going
  const STREAK_MAX = 10;
  /** Active "hard sell": one real customer, rolled randomly, with a boosted chance to buy.
      Keeps up with the shop: the customer is a business placing a bulk order worth ~4 s of the shop's income
      (+0.5 s per streak level), so steady hustling roughly doubles income; back-to-back hustles also raise the odds. */
  /** Current hustle streak, or 0 once the window to keep it going has passed. */
  const hustleStreak = (s) => (s.hustleAt != null && s.stats.play - s.hustleAt <= HUSTLE_CD + STREAK_GAP ? s.hustleStreak || 0 : 0);
  function hustle(s) {
    if (s.hustleCd > 0) return null;
    const since = s.hustleAt == null ? Infinity : s.stats.play - s.hustleAt;
    s.hustleStreak = since <= HUSTLE_CD + STREAK_GAP ? Math.min(STREAK_MAX, (s.hustleStreak || 0) + 1) : 1;
    s.hustleAt = s.stats.play;
    s.hustleCd = HUSTLE_CD;
    s.stats.hustles++;
    const streak = s.hustleStreak;
    const d = derive(s);
    const all = getItems(s, d).filter((i) => i.stock > 0);
    const live = all.filter((i) => i.kind === 'pre' || i.kind === 'bp');
    if (!live.length) return { none: true, streak };
    let r = Math.random(), seg = SEG[SEG.length - 1];
    for (const sg of SEG) {
      if ((r -= sg.share) < 0) { seg = sg; break; }
    }
    const q = pickSegmentProb(live, seg, d.y);
    if (Math.random() > Math.min(0.98, q.p + 0.25 + 0.03 * (streak - 1))) return { passed: true, streak };
    let pick = Math.random() * q.tot, idx = 0;
    for (let i = 0; i < live.length; i++) {
      if ((pick -= q.ws[i]) < 0) { idx = i; break; }
    }
    const it = live[idx];
    const unit = it.price * d.profit;
    const units = Math.max(1, Math.min(it.stock, Math.round((s.rate.rev * (4 + 0.5 * (streak - 1))) / Math.max(1, unit))));
    let rev = sellUnits(s, it, units, null, [], d.profit);
    // a hard-sold PC buyer is likely to add on something from each aisle
    const extras = [];
    CS.GROUPS.forEach((grp) => {
      if (grp.kind !== 'game' && grp.kind !== 'acc') return;
      const gi = all.filter((i) => i.group === grp.id && i.stock > 0);
      if (!gi.length) return;
      const ref = grp.ref * Math.pow(grp.grow, d.y - 1993);
      const ws = gi.map((i) => itemWeight(seg, i.rel, i.price, d.y, ref) * i.capF);
      const tot = ws.reduce((a, b) => a + b, 0);
      if (tot <= 0 || Math.random() > Math.min(0.9, grp.A * 2 * (1 + d.upsell) * kindBoost(d, grp.kind) * (1 - Math.exp(-tot / K)))) return;
      let p2 = Math.random() * tot, j = 0;
      for (let i = 0; i < gi.length; i++) { if ((p2 -= ws[i]) < 0) { j = i; break; } }
      const k = Math.max(1, Math.min(gi[j].stock, Math.round(units / 3)));
      rev += sellUnits(s, gi[j], k, null, [], d.profit);
      extras.push(gi[j]);
    });
    return { sold: it, units, rev, extras, streak };
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

  /* ---------- Franchise Tokens ---------- */
  const tokenMult = (s) => 1 + 0.08 * tl(s, 't_token');
  function pendingTokens(s) {
    const r = s.stats.revenue;
    if (r < C.TOKEN_R0) return 0;
    const K = C.TOKEN_K;
    return Math.floor((K * Math.sqrt(r / C.TOKEN_R0) - (K - 1)) * tokenMult(s));
  }
  /** Run revenue at which the n-th token is earned. */
  function tokenAt(s, n) {
    const K = C.TOKEN_K;
    return C.TOKEN_R0 * Math.pow((n / tokenMult(s) + K - 1) / K, 2);
  }
  const nextTokenAt = (s) => tokenAt(s, pendingTokens(s) + 1);
  /** How strongly shoppers want each item (all segments blended), raw units; compare within a kind. */
  function popularityMap(items, d) {
    const out = {};
    items.forEach((it) => {
      const grp = it.group ? CS.GROUP_BY_ID[it.group] : null;
      const ref = it.ref || (grp ? grp.ref * Math.pow(grp.grow, d.y - 1993) : undefined);
      let v = 0;
      SEG.forEach((seg) => { v += seg.share * itemWeight(seg, it.rel, it.price, d.y, ref) * (it.capF == null ? 1 : it.capF); });
      out[it.key] = v;
    });
    return out;
  }

  /** Cash in: returns the fresh state for the next franchise (tokens, upgrades, trophies carry over), or null. */
  function prestige(s) {
    const gain = pendingTokens(s);
    if (gain < 1) return null;
    const m = s.meta;
    m.tokens += gain;
    m.earned += gain;
    m.resets += 1;
    m.lifeRevenue += s.stats.revenue;
    m.lifeSold += s.stats.sold;
    m.lifeUnits += unitsSold(s.stats);
    m.bestRevenue = Math.max(m.bestRevenue, s.stats.revenue);
    const n = newState(m);
    n.name = s.name;
    n.ach = Object.assign({}, s.ach);
    n.started = s.started;
    n.stats.play = s.stats.play;
    n.stats.offline = s.stats.offline;
    n.stats.hustles = s.stats.hustles;
    n.fresh = true; // until the first sale, opening upgrades bought at HQ still apply to this franchise
    return { state: n, gain };
  }
  const tokenCost = (s, u) => Math.ceil(u.base * Math.pow(u.grow, tl(s, u.id)));
  function buyTokenUp(s, id) {
    const u = CS.TUP_BY_ID[id];
    if (!u) return false;
    const L = tl(s, id), cost = tokenCost(s, u);
    if (L >= u.max || s.meta.tokens < cost) return false;
    s.meta.tokens -= cost;
    s.meta.tup[id] = L + 1;
    if (s.fresh) startBonus(s, id, L, L + 1);
    return true;
  }

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dateStr = (y) => MONTHS[Math.min(11, Math.floor((y % 1) * 12))] + ' ' + Math.floor(y);

  CS.E = {
    SEG, K, ADDON_SCALE, kindBoost, isAddon, sellUnits, itemWeight, popularityMap, infl, refPrice, newState, migrate, serialize, deserialize, yearOf, eraAt, eventsAt, derive,
    partAvail, partRel, partPrice, bpInfo, designInfo, totalStock, getItems, buy, buyUnits, setTarget,
    upLevel, upCost, upUnlocked, buyUp, createBp, deleteBp, step, advance, offline, offlineStart, offlineRun, hustle, newProducts,
    HUSTLE_CD, hustleStreak, remindersAt, reputationView, repMult, serviceAt, serviceView, SVC_ITEM, newReport, checkAch, dateStr, unitsSold, pendingTokens, nextTokenAt, tokenAt, prestige, tokenCost, buyTokenUp, tl, calSpeed, startYear,
  };
  if (typeof module !== 'undefined') module.exports = CS;
})(typeof window !== 'undefined' ? window : globalThis);
