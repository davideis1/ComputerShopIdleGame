/* Purchasing managers: one buyer per category who watches demand trends and sets (and pays for)
   the shop's stock levels. Loaded after engine.js; the engine calls into CS.M at a few hook points. */
(function (g) {
  const CS = g.CS;
  const E = CS.E;

  const DECIDE_EVERY = 15; // seconds of play between a manager's planning rounds
  const TAU_LONG = 900, TAU_SHORT = 200; // sales-velocity memory (seconds)
  const MAX_LEVEL = 10;
  const wageInfl = (y) => Math.pow(1.02, y - 1993);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  CS.MGR_CATS = [
    { id: 'pre', name: 'Computers', icon: '🖥️', kinds: ['pre'], needs: null, tab: 'pre' },
    { id: 'bp', name: 'Custom Builds', icon: '🛠️', kinds: ['bp'], needs: 'workshop', tab: 'pre' },
    { id: 'game', name: 'PC Games', icon: '💿', kinds: ['game'], needs: 'aisleGame', tab: 'game' },
    { id: 'acc', name: 'Accessories', icon: '🖱️', kinds: ['acc'], needs: 'aisleAcc', tab: 'acc' },
    { id: 'con', name: 'Consoles', icon: '🎮', kinds: ['console', 'cgame', 'cacc'], needs: 'aisleConsole', tab: 'con' },
  ];
  const CAT = {};
  CS.MGR_CATS.forEach((c) => (CAT[c.id] = c));
  const catOfKind = (k) => (k === 'console' || k === 'cgame' || k === 'cacc' ? 'con' : k);

  CS.MGR_SKILLS = [
    { id: 'forecast', name: 'Forecasting', icon: '🔮', desc: 'Reads demand trends. Lv2 shows trend arrows, Lv4 anticipates events, Lv6 times purchases around shortages, Lv8 plans new releases without test orders.' },
    { id: 'negotiate', name: 'Negotiation', icon: '🤝', desc: '-0.5% purchase cost per level on everything in the category.' },
    { id: 'logistics', name: 'Logistics', icon: '🚚', desc: 'Faster ordering and more products stocked at once.' },
  ];

  CS.MGR_TRAITS = {
    frugal: { name: 'Frugal', icon: '🪙', desc: 'Drives a hard bargain and works cheap.', skills: { negotiate: 3 }, wage: 0.9, preset: 'lean' },
    visionary: { name: 'Visionary', icon: '🔭', desc: 'Spots trends before anyone else.', skills: { forecast: 3 }, wage: 1.05, preset: 'trend' },
    workhorse: { name: 'Workhorse', icon: '🐂', desc: 'Gets orders in fast and keeps shelves full.', skills: { logistics: 3 }, wage: 1.0, preset: 'balanced' },
    gambler: { name: 'Gambler', icon: '🎲', desc: 'Overreacts to trends and buys big. High risk, high stock.', skills: { forecast: -1, logistics: 1 }, wage: 1.0, preset: 'stockup', overreact: true },
    perfectionist: { name: 'Perfectionist', icon: '🧐', desc: 'Good at everything, and paid for it.', skills: { forecast: 1, negotiate: 1, logistics: 1 }, wage: 1.25, preset: 'balanced' },
    rookie: { name: 'Rookie', icon: '🌱', desc: 'Cheap and keen, but has a lot to learn.', skills: { forecast: -1, negotiate: -1, logistics: -1 }, wage: 0.65, preset: 'lean' },
    veteran: { name: 'Veteran', icon: '🎖️', desc: 'Seen every product cycle since the 486.', skills: { forecast: 4, negotiate: 4, logistics: 4 }, wage: 1.6, preset: 'balanced' },
  };
  const NAMES = ['Penny Pincher', 'Hank Hoarder', 'Trendy Tina', 'Stocky Stu', 'Bargain Barb', 'Forecast Fran', 'Lenny Logistics', 'Margin Mike',
    'Clearance Carl', 'Bulk Betty', 'Pallet Pete', 'Invoice Ivy', 'Haggling Hal', 'Shelf Sheila', 'Orders Oscar', 'Supply Sue', 'Quota Quentin',
    'Barcode Bea', 'Ledger Larry', 'Cargo Cleo', 'Rebate Rita', 'Wholesale Walt', 'Tariff Tom', 'Crate Connie'];

  CS.MGR_PRESETS = {
    balanced: { label: 'Balanced', desc: 'Moderate stock, follows trends sensibly.', cfg: { priority: 'balanced', coverage: null, safety: 20, sensitivity: 50, testSize: 3, mdOn: false, minMargin: 0, age: 'current' } },
    lean: { label: 'Lean (just-in-time)', desc: 'Little stock, little cash tied up, few products.', cfg: { priority: 'margin', coverage: 1.5, safety: 5, sensitivity: 40, testSize: 1, mdOn: false, minMargin: 10, age: 'current' } },
    stockup: { label: 'Stock-up (never run out)', desc: 'Deep shelves, big safety buffer.', cfg: { priority: 'volume', coverage: 8, safety: 40, sensitivity: 50, testSize: 6, mdOn: false, minMargin: 0, age: 'current' } },
    trend: { label: 'Trend chaser', desc: 'Reacts quickly, backs new releases, drops fading lines.', cfg: { priority: 'profit', coverage: 3, safety: 15, sensitivity: 90, testSize: 8, mdOn: true, mdAge: 2, mdPct: 20, minMargin: 0, age: 'new' } },
    clearance: { label: 'Clearance', desc: 'Sells through older stock with markdowns.', cfg: { priority: 'volume', coverage: 4, safety: 10, sensitivity: 30, testSize: 0, mdOn: true, mdAge: 2, mdPct: 35, minMargin: 0, age: 'any' } },
    margin: { label: 'Margin hunter', desc: 'Only stocks products with healthy margins.', cfg: { priority: 'margin', coverage: 2.5, safety: 15, sensitivity: 50, testSize: 2, mdOn: false, minMargin: 25, age: 'current' } },
  };

  const defaults = (cat) => ({
    on: true, preset: 'balanced', priority: 'balanced',
    coverage: { pre: 3, bp: 3, game: 4, acc: 5, con: 4 }[cat], safety: 20, maxSkus: cat === 'acc' ? 14 : cat === 'con' ? 12 : 6,
    reserveCash: 0, maxOrderPct: 50, maxSpacePct: { pre: 60, bp: 30, game: 20, acc: 30, con: 25 }[cat],
    age: 'current', maxAge: { pre: 2, bp: 99, game: 1.5, acc: 4, con: 3 }[cat], minMargin: 0, maxPrice: 0, blocked: [], groups: [], platforms: [],
    sensitivity: 50, anticipate: true, preBuy: true, testSize: 3, mdOn: false, mdAge: 3, mdPct: 25, log: true, pins: {},
  });

  /* ---------- state ---------- */
  function init(s) {
    s.mgr = s.mgr || { pre: null, bp: null, game: null, acc: null };
    s.mgrCfg = s.mgrCfg || {};
    s.mgrPool = s.mgrPool || {};
    s.mAcc = s.mAcc || {};
    s.vel = s.vel || {};
    CS.MGR_CATS.forEach((c) => {
      if (s.mgr[c.id] === undefined) s.mgr[c.id] = null;
      if (s.mgrCfg[c.id]) s.mgrCfg[c.id] = Object.assign(defaults(c.id), s.mgrCfg[c.id]);
    });
  }
  const cfgOf = (s, cat) => s.mgrCfg[cat] || (s.mgrCfg[cat] = defaults(cat));

  function effSkills(s, mg) {
    const hq = E.tl(s, 't_mgr');
    const o = {};
    ['forecast', 'negotiate', 'logistics'].forEach((k) => (o[k] = Math.min(MAX_LEVEL + 2, mg.skills[k] + hq)));
    return o;
  }
  const wageFor = (skills, trait) => (0.5 + 0.12 * (skills.forecast + skills.negotiate + skills.logistics)) * (CS.MGR_TRAITS[trait].wage || 1);

  /* ---------- hooks used by the engine ---------- */
  function derive(s, d) {
    const out = { office: d.office, cats: {}, wages: 0, count: 0 };
    const infl = wageInfl(d.y);
    const wageF = Math.max(0.2, 1 - 0.08 * E.tl(s, 't_mgr_wage')); // HQ: Loyalty Bonuses
    CS.MGR_CATS.forEach((c) => {
      const mg = s.mgr && s.mgr[c.id];
      if (!mg) { out.cats[c.id] = null; return; }
      const cfg = cfgOf(s, c.id);
      const eff = effSkills(s, mg);
      const L = eff.logistics;
      out.cats[c.id] = {
        eff, on: !!cfg.on, disc: Math.min(0.07, 0.005 * eff.negotiate) + 0.005 * E.tl(s, 't_mgr_deal'),
        rate: (0.4 + 0.25 * L + d.restock * (0.4 + 0.06 * L)) * (1 + 0.15 * E.tl(s, 't_mgr_speed')), // orders per second; clerk crews help
        maxSkus: (Math.min(16, 3 + L) + 2 * E.tl(s, 't_mgr_wide')) * (c.id === 'acc' || c.id === 'con' ? 2 : 1), wage: mg.wage * infl * wageF,
      };
      out.wages += mg.wage * infl * wageF;
      out.count++;
    });
    return out;
  }

  /** Called at the end of getItems: category deals, markdowns and the "managed" flags. */
  function decorate(s, d, items) {
    if (!d.mgr || !d.mgr.count) return;
    for (const it of items) {
      const cat = catOfKind(it.kind);
      const m = d.mgr.cats[cat];
      if (!m || !m.on) continue;
      const cfg = cfgOf(s, cat);
      it.mgrCat = cat;
      it.rawCost = it.cost;
      it.cost = it.cost * (1 - m.disc);
      const pin = cfg.pins[it.key];
      it.pin = pin || '';
      it.managed = !pin;
      if (cfg.mdOn && it.kind !== 'bp' && it.age > cfg.mdAge) it.price *= 1 - cfg.mdPct / 100;
    }
  }

  function noteSale(s, key, k) {
    const now = s.stats.play;
    const v = s.vel[key] || (s.vel[key] = { a: 0, b: 0, t: now, t0: now });
    const dt = Math.max(0, now - v.t);
    v.a = v.a * Math.exp(-dt / TAU_LONG) + k / TAU_LONG;
    v.b = v.b * Math.exp(-dt / TAU_SHORT) + k / TAU_SHORT;
    v.t = now;
  }
  /** Sales rate (units/s) for an item: a blend of a long and a short moving average, `sens` (0-100) picks the mix. */
  function velocity(s, key, sens) {
    const v = s.vel[key];
    if (!v) return null;
    const now = s.stats.play;
    const dt = Math.max(0, now - v.t);
    // bias-correct the averages while they are still warming up after the first sale
    const age = Math.max(1, now - (v.t0 == null ? now - 3600 : v.t0));
    const a = (v.a * Math.exp(-dt / TAU_LONG)) / (1 - Math.exp(-age / TAU_LONG));
    const b = (v.b * Math.exp(-dt / TAU_SHORT)) / (1 - Math.exp(-age / TAU_SHORT));
    if (a < 1e-7 && b < 1e-7) return { a: 0, b: 0, rate: 0, trend: 0 };
    const w = sens / 100;
    return { a, b, rate: a * (1 - w) + b * w, trend: a > 1e-7 ? b / a - 1 : 0 };
  }

  /* ---------- demand model (same maths the shop uses to sell) ---------- */
  function modelRates(set, d, served, pcShareHint) {
    const out = {};
    const SEG = E.SEG, K = E.K;
    const pcs = set.filter((i) => i.kind === 'pre' || i.kind === 'bp');
    let pcRate = 0;
    if (pcs.length) {
      const ex = new Array(pcs.length).fill(0);
      SEG.forEach((seg) => {
        const ws = pcs.map((i) => E.itemWeight(seg, i.rel, i.price, d.y));
        const tot = ws.reduce((a, b) => a + b, 0);
        if (tot <= 0) return;
        const p = Math.min(0.95, 1 - Math.exp(-tot / K));
        for (let i = 0; i < pcs.length; i++) ex[i] += (served * seg.share * p * ws[i]) / tot;
      });
      pcs.forEach((i, k) => { out[i.key] = ex[k]; pcRate += ex[k]; });
    }
    const pcShare = served > 0 && pcs.length ? clamp(pcRate / served, 0, 1) : pcShareHint;
    const attach = (1 + pcShare) * (1 + d.upsell) * E.ADDON_SCALE;
    CS.GROUPS.forEach((grp) => {
      if (grp.kind !== 'game' && grp.kind !== 'acc') return;
      const gi = set.filter((i) => i.group === grp.id);
      if (!gi.length) return;
      const ref = grp.ref * Math.pow(grp.grow, d.y - 1993);
      const ex = new Array(gi.length).fill(0);
      SEG.forEach((seg) => {
        const ws = gi.map((i) => E.itemWeight(seg, i.rel, i.price, d.y, ref) * i.capF);
        const tot = ws.reduce((a, b) => a + b, 0);
        if (tot <= 0) return;
        const p = Math.min(0.95, 1 - Math.exp(-tot / K));
        for (let i = 0; i < gi.length; i++) ex[i] += ((served * seg.share * p * ws[i]) / tot) * grp.A * attach;
      });
      gi.forEach((i, k) => (out[i.key] = ex[k]));
    });
    if (CS.Con && set.some((i) => i.kind === 'console' || i.kind === 'cgame' || i.kind === 'cacc')) {
      Object.assign(out, CS.Con.rates(set, d, served, pcShare).rates);
    }
    return out;
  }

  /* ---------- planning ---------- */
  function note(mg, cfg, now, key, txt, every) {
    if (!cfg.log) return;
    mg.lastNote = mg.lastNote || {};
    if (mg.lastNote[key] != null && now - mg.lastNote[key] < (every || 300)) return;
    mg.lastNote[key] = now;
    (mg.log = mg.log || []).unshift({ t: now, txt });
    if (mg.log.length > 40) mg.log.length = 40;
  }

  function decide(s, d, items, cat, mg, cfg, m) {
    const now = s.stats.play;
    const eff = m.eff;
    const pins = cfg.pins;
    const pool = items.filter((i) => i.mgrCat === cat.id);
    const served = Math.min(d.lambda, d.serve);
    const trait = CS.MGR_TRAITS[mg.trait] || {};

    const ageOk = (i) => {
      if (i.kind === 'bp') return i.canBuild;
      if (!i.buyable) return false;
      if (cfg.age === 'any') return true;
      if (cfg.age === 'new') return i.age <= 1;
      return i.age <= cfg.maxAge;
    };
    const elig = pool.filter((i) => !pins[i.key] && ageOk(i)
      && (cfg.minMargin <= 0 || ((i.price - i.cost) / i.price) * 100 >= cfg.minMargin)
      && (!cfg.maxPrice || i.price <= cfg.maxPrice)
      && !cfg.blocked.includes(i.brand)
      && (cat.id !== 'acc' || !cfg.groups.length || cfg.groups.includes(i.group))
      && (cat.id !== 'con' || !cfg.platforms.length || cfg.platforms.includes(i.plat)));

    // rank by the manager's priority, using each item's standalone appeal to shoppers
    const pop = E.popularityMap(elig, d);
    const maxPop = Math.max(1e-9, ...elig.map((i) => pop[i.key]));
    const maxProfit = Math.max(1e-9, ...elig.map((i) => (i.price - i.cost) * pop[i.key]));
    const score = (i) => {
      const p = pop[i.key] / maxPop, pr = ((i.price - i.cost) * pop[i.key]) / maxProfit, mgn = (i.price - i.cost) / i.price;
      switch (cfg.priority) {
        case 'volume': return p;
        case 'margin': return mgn * Math.sqrt(p);
        case 'profit': return pr;
        default: return 0.5 * p + 0.5 * pr;
      }
    };
    const limit = Math.max(1, Math.min(cfg.maxSkus, m.maxSkus));
    const top = elig.slice().sort((a, b) => score(b) - score(a)).slice(0, limit);

    // what would sell, if exactly these were on the shelves (plus whatever other managers/you stock)
    const others = items.filter((i) => i.mgrCat !== cat.id && (i.stock > 0 || i.target > 0) && !top.includes(i));
    const stockedPcs = items.filter((i) => (i.kind === 'pre' || i.kind === 'bp') && i.stock > 0);
    const hint = stockedPcs.length ? clamp(Object.values(modelRates(stockedPcs, d, served, 0.6)).reduce((a, b) => a + b, 0) / Math.max(served, 1e-9), 0.2, 1) : 0.5;
    const rates = modelRates(top.concat(others), d, served, hint);

    // trends: events ahead and price swings
    const evNow = E.eventsAt(d.y), evSoon = E.eventsAt(d.y + 0.25);
    let demandF = 1, covF = 1, stance = '';
    if (cfg.anticipate && eff.forecast >= 4) {
      demandF = evSoon.demand / evNow.demand;
      if (Math.abs(demandF - 1) > 0.05) {
        const e = evSoon.list.find((x) => x.demand) || evNow.list.find((x) => x.demand);
        note(mg, cfg, now, 'ev' + (e ? e.id : ''), (demandF > 1 ? '📈 ' : '📉 ') + (e ? e.name : 'Market shift') + ' ahead: expecting ' + (demandF > 1 ? '+' : '') + Math.round((demandF - 1) * 100) + '% demand.', 900);
      }
    }
    if (cfg.preBuy && eff.forecast >= 6 && (cat.id === 'pre' || cat.id === 'bp')) {
      const cost = (ev) => (cat.id === 'pre' ? ev.preCost : ev.partCost * Math.sqrt(ev.gpuCost));
      const cn = cost(evNow), cs = cost(evSoon);
      if (cs > cn * 1.15) { covF = 1.6; stance = 'prebuy'; note(mg, cfg, now, 'prebuy', '🛒 Prices are about to jump (+' + Math.round((cs / cn - 1) * 100) + '%). Stocking up early.', 900); }
      else if (cn > 1.2 && cs >= cn * 0.97) { covF = 0.6; stance = 'wait'; note(mg, cfg, now, 'wait', '⏳ Prices are inflated right now (+' + Math.round((cn - 1) * 100) + '%). Buying only what is needed.', 900); }
    }
    const wM = clamp(0.15 + 0.085 * eff.forecast, 0.15, 1);
    const sens = trait.overreact ? Math.min(100, cfg.sensitivity + 15) : cfg.sensitivity;

    const prevSet = new Set(mg.plan ? mg.plan.map((p) => p.k) : []);
    const targets = {}, plan = [];
    top.forEach((i) => {
      const vm = rates[i.key] || 0;
      const vel = velocity(s, i.key, sens);
      const hasObs = vel && (vel.a > 1e-7 || vel.b > 1e-7);
      let v, tr = 0;
      if (hasObs) {
        tr = vel.trend;
        const adj = 1 + clamp(tr, -0.5, 1) * (sens / 100) * (trait.overreact ? 1.6 : 1);
        v = wM * vm + (1 - wM) * vel.rate * adj;
      } else {
        v = vm * (0.5 + 0.05 * Math.min(10, eff.forecast)); // never stocked it: a cautious guess
      }
      v *= demandF;
      const cover = cfg.coverage * 60 * (1 + cfg.safety / 100) * covF * (trait.overreact ? 1.25 : 1);
      let target = Math.ceil(v * cover);
      let why = tr > 0.25 ? 'rising' : tr < -0.25 ? 'fading' : 'steady';
      const fresh = i.age < 0.6 && !hasObs;
      if (fresh && cfg.testSize > 0 && !(eff.forecast >= 8)) {
        const test = cfg.testSize * (i.pack || 1);
        if (target < test) { target = test; why = 'test order'; }
        else why = 'new release';
      } else if (fresh) why = 'new release';
      const keep = prevSet.has(i.key) || i.stock > 0; // hysteresis: don't drop a line the moment demand wobbles
      if (v * cover < (keep ? 0.15 : 0.5) && why !== 'test order') target = 0;
      if (target > 0) {
        targets[i.key] = target;
        plan.push({ k: i.key, name: i.name, t: target, v: v * 60, tr: eff.forecast >= 2 ? tr : null, why });
      }
    });

    // keep within the shelf-space allowance
    const allowed = (cfg.maxSpacePct / 100) * d.cap;
    const byKey = {};
    pool.forEach((i) => (byKey[i.key] = i));
    let used = 0;
    Object.keys(targets).forEach((k) => (used += targets[k] * (byKey[k].size || 1)));
    if (used > allowed && used > 0) {
      const f = allowed / used;
      Object.keys(targets).forEach((k) => { targets[k] = Math.max(k in targets && targets[k] > 0 ? 1 : 0, Math.floor(targets[k] * f)); });
      note(mg, cfg, now, 'space', '📦 Hit the shelf-space limit (' + cfg.maxSpacePct + '% of shelves). Trimming targets.', 600);
    }
    plan.forEach((p) => { p.t = targets[p.k] || 0; });

    // apply: managed items outside the plan are run down to zero
    const prev = mg.plan ? mg.plan.map((p) => p.k) : [];
    pool.forEach((i) => {
      if (pins[i.key] === 'pin') return;
      const t = pins[i.key] === 'skip' ? 0 : targets[i.key] || 0;
      E.setTarget(s, i.key, t);
    });
    plan.forEach((p) => {
      if (!prev.includes(p.k)) note(mg, cfg, now, 'add' + p.k, '➕ Stocking ' + p.name + ' (' + p.why + ', target ' + p.t + ').', 1200);
      else if (p.tr != null && Math.abs(p.tr) > 0.4) note(mg, cfg, now, 'tr' + p.k, (p.tr > 0 ? '↗ ' : '↘ ') + p.name + ' is selling ' + Math.abs(Math.round(p.tr * 100)) + '% ' + (p.tr > 0 ? 'faster' : 'slower') + ' than usual.', 600);
    });
    prev.forEach((k) => {
      if (!(k in targets) && byKey[k]) note(mg, cfg, now, 'drop' + k, '➖ Phasing out ' + byKey[k].name + (byKey[k].age > 2 ? ' (' + byKey[k].age.toFixed(1) + ' years old)' : '') + '.', 1200);
    });
    mg.plan = plan;
    mg.planT = now;
    mg.stance = stance;
    // forget velocity records of long-dead items
    for (const k in s.vel) if (now - s.vel[k].t > 7200) delete s.vel[k];
  }

  function tick(s, d, items, dt) {
    if (!d.mgr || !d.mgr.count) return;
    CS.MGR_CATS.forEach((c) => {
      const m = d.mgr.cats[c.id];
      if (!m || !m.on) return;
      const mg = s.mgr[c.id];
      mg.tAcc = (mg.tAcc || 0) + dt;
      if (mg.tAcc >= DECIDE_EVERY || mg.planT == null) {
        mg.tAcc = 0;
        decide(s, d, items, c, mg, cfgOf(s, c.id), m);
      }
    });
  }

  /** The managers place their own orders (so a shop can run on managers alone). Returns cash spent. */
  function restock(s, d, items, dt) {
    if (!d.mgr || !d.mgr.count) return 0;
    let spent = 0;
    CS.MGR_CATS.forEach((c) => {
      if (c.id === 'bp') return; // custom PCs are built by technicians; the manager only plans how many
      const m = d.mgr.cats[c.id];
      if (!m || !m.on) return;
      const mg = s.mgr[c.id], cfg = cfgOf(s, c.id);
      s.mAcc[c.id] = Math.min(Math.max(6, m.rate * dt * 2), (s.mAcc[c.id] || 0) + m.rate * dt);
      const list = items.filter((i) => i.mgrCat === c.id && i.managed && i.buyable && i.stock < i.target)
        .sort((a, b) => (b.target - b.stock) / b.target - (a.target - a.stock) / a.target);
      for (const it of list) {
        const budget = s.mAcc[c.id];
        if (budget < 1) break;
        const addon = E.isAddon(it.kind);
        const want = addon ? Math.min(it.pack, it.target - it.stock) : Math.min(Math.floor(budget), it.target - it.stock);
        const avail = s.cash - cfg.reserveCash;
        const byPct = cfg.maxOrderPct >= 100 ? Infinity : Math.floor((avail * cfg.maxOrderPct) / 100 / it.cost);
        const k = E.buyUnits(s, it, Math.min(want, byPct), d);
        if (!k) {
          if (avail < it.cost || byPct < 1) note(mg, cfg, s.stats.play, 'budget', '💸 Order budget reached (cash reserve / order limit). Waiting for cash.', 600);
          continue;
        }
        s.mAcc[c.id] -= addon ? 1 : k;
        spent += k * it.cost;
        mg.stats.ordered += k;
        mg.stats.spent += k * it.cost;
        mg.stats.saved += k * ((it.rawCost || it.cost) - it.cost);
      }
    });
    return spent;
  }

  /* ---------- player actions ---------- */
  function candidates(s, catId) {
    if (!s.mgrPool[catId] || !s.mgrPool[catId].length) {
      const used = new Set();
      const keys = Object.keys(CS.MGR_TRAITS);
      s.mgrPool[catId] = [0, 1, 2].map(() => {
        let name;
        do name = NAMES[Math.floor(Math.random() * NAMES.length)]; while (used.has(name));
        used.add(name);
        const trait = keys[Math.floor(Math.random() * keys.length)];
        const t = CS.MGR_TRAITS[trait];
        const skills = {};
        ['forecast', 'negotiate', 'logistics'].forEach((k) => {
          skills[k] = clamp(1 + Math.floor(Math.random() * 3) + ((t.skills && t.skills[k]) || 0), 1, MAX_LEVEL);
        });
        return { name, trait, skills, wage: wageFor(skills, trait) };
      });
    }
    return s.mgrPool[catId];
  }
  // HQ upgrades trim the one-off costs; the first few hires of a franchise can be free (Succession Plan)
  const bonusFor = (s, wage, y) => (s.freeHires > 0 ? 0 : Math.round(wage * wageInfl(y) * 1800 * Math.max(0.2, 1 - 0.15 * E.tl(s, 't_mgr_recruit'))));
  const refreshCost = (s, d) => Math.round(500 * Math.pow(1.025, d.y - 1993) * Math.max(0.2, 1 - 0.15 * E.tl(s, 't_mgr_recruit')));
  const trainCost = (s, mg, skill, d) => Math.round(1200 * Math.pow(1.55, mg.skills[skill] - 1) * Math.pow(1.025, d.y - 1993) * Math.max(0.2, 1 - 0.1 * E.tl(s, 't_mgr_academy')));

  function available(d, cat) {
    return d.office && (!CAT[cat].needs || d[CAT[cat].needs]);
  }

  function hire(s, catId, idx) {
    const d = E.derive(s);
    if (!available(d, catId) || s.mgr[catId]) return { ok: false, err: 'Not available.' };
    const c = candidates(s, catId)[idx];
    if (!c) return { ok: false, err: 'No such candidate.' };
    const bonus = bonusFor(s, c.wage, d.y);
    if (s.cash < bonus) return { ok: false, err: 'Not enough cash for the signing bonus.' };
    s.cash -= bonus;
    if (s.freeHires > 0) s.freeHires--;
    s.mgr[catId] = { name: c.name, trait: c.trait, skills: Object.assign({}, c.skills), wage: c.wage, hiredAt: s.stats.play, stats: { ordered: 0, spent: 0, saved: 0 }, plan: [], log: [], tAcc: 0, planT: null };
    s.mgrPool[catId] = null;
    if (!s.mgrCfg[catId]) { // first hire in this category: start from the trait's favourite preset
      const cfg = defaults(catId);
      s.mgrCfg[catId] = cfg;
      applyPreset(s, catId, CS.MGR_TRAITS[c.trait].preset || 'balanced');
    }
    cfgOf(s, catId).on = true;
    (s.mgr[catId].log).unshift({ t: s.stats.play, txt: '👋 ' + c.name + ' joins as ' + CAT[catId].name + ' buyer.' });
    return { ok: true };
  }
  function fire(s, catId) {
    const mg = s.mgr[catId];
    if (!mg) return { ok: false };
    const d = E.derive(s);
    const sev = Math.round(mg.wage * wageInfl(d.y) * 3600);
    if (s.cash < sev) return { ok: false, err: 'Severance is ' + sev + ' (one hour of wages).', cost: sev };
    s.cash -= sev;
    s.mgr[catId] = null;
    return { ok: true, cost: sev };
  }
  function refresh(s, catId) {
    const d = E.derive(s);
    const cost = refreshCost(s, d);
    if (s.cash < cost) return false;
    s.cash -= cost;
    s.mgrPool[catId] = null;
    candidates(s, catId);
    return true;
  }
  function train(s, catId, skill) {
    const mg = s.mgr[catId];
    if (!mg || mg.skills[skill] >= MAX_LEVEL) return false;
    const d = E.derive(s);
    const cost = trainCost(s, mg, skill, d);
    if (s.cash < cost) return false;
    s.cash -= cost;
    mg.skills[skill]++;
    mg.wage = wageFor(mg.skills, mg.trait);
    return true;
  }
  function applyPreset(s, catId, presetId) {
    const p = CS.MGR_PRESETS[presetId];
    if (!p) return;
    const cfg = cfgOf(s, catId);
    const base = defaults(catId);
    const o = Object.assign({}, p.cfg);
    if (o.coverage == null) o.coverage = base.coverage;
    Object.assign(cfg, o);
    cfg.preset = presetId;
  }
  function setCfg(s, catId, key, val) {
    const cfg = cfgOf(s, catId);
    if (!(key in cfg) || key === 'pins') return;
    cfg[key] = val;
    if (key !== 'on' && key !== 'preset' && key !== 'log' && key !== 'reserveCash' && key !== 'maxOrderPct' && key !== 'maxSpacePct' && key !== 'maxSkus' && key !== 'blocked' && key !== 'groups' && key !== 'maxPrice' && key !== 'maxAge' && key !== 'anticipate' && key !== 'preBuy') cfg.preset = 'custom';
    if (key === 'preset') applyPreset(s, catId, val);
  }
  function setPin(s, catId, key, mode) {
    const cfg = cfgOf(s, catId);
    if (!mode) delete cfg.pins[key];
    else cfg.pins[key] = mode;
    if (mode === 'skip') E.setTarget(s, key, 0);
  }

  CS.M = {
    init, derive, decorate, noteSale, velocity, tick, restock, candidates, hire, fire, refresh, train, applyPreset, setCfg, setPin,
    cfgOf, defaults, bonusFor, refreshCost, trainCost, available, effSkills, wageFor, MAX_LEVEL, wageInfl, DECIDE_EVERY,
  };
  if (typeof module !== 'undefined') module.exports = CS;
})(typeof window !== 'undefined' ? window : globalThis);
