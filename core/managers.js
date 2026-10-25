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
    // not a stock buyer: designs custom-PC blueprints from market demand (see designTick)
    { id: 'design', name: 'PC Designer', icon: '📐', kinds: [], needs: 'workshop', tab: 'pre', designer: true,
      skillNames: { forecast: 'Market sense', negotiate: 'Engineering', logistics: 'Throughput' },
      skillDescs: {
        forecast: 'Reads the market. Lv2 lets the designer set prices automatically, Lv4 waits out parts that are about to be replaced.',
        negotiate: '+1% quality on every custom PC you build per level.',
        logistics: 'Faster design cycles and more concepts considered each round.',
      } },
    // not a stock buyer either: keeps the Service Desk's repair capacity ahead of walk-ins (see svcTick)
    { id: 'svc', name: 'Service Desk', icon: '🛎️', kinds: [], needs: 'service', tab: 'svc', designer: true, svc: true,
      skillNames: { forecast: 'Planning', negotiate: 'Haggling', logistics: 'Speed' },
      skillDescs: {
        forecast: 'Plans ahead: +3% spare repair capacity per level on top of your headroom setting.',
        negotiate: '-0.5% off every upgrade the manager buys, per level.',
        logistics: 'Reviews the desk more often and can buy more per review (1 more every 3 levels).',
      } },
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

  /* ---------- PC designer ---------- */
  const DESIGN_EVERY = 150; // seconds between design rounds at Throughput 0
  // part tier per slot for each concept ('I' = integrated graphics, 'F' = free OS where allowed)
  const ARCH = {
    office: { name: 'Office', t: { case: 'Budget', cpu: 'Budget', ram: 'Budget', storage: 'Budget', gpu: 'I', os: 'Standard' } },
    budget: { name: 'Budget', t: { case: 'Budget', cpu: 'Budget', ram: 'Budget', storage: 'Budget', gpu: 'Budget', os: 'F' } },
    value: { name: 'Value', t: { case: 'Budget', cpu: 'Standard', ram: 'Standard', storage: 'Budget', gpu: 'Budget', os: 'Standard' } },
    standard: { name: 'Standard', t: { case: 'Standard', cpu: 'Standard', ram: 'Standard', storage: 'Standard', gpu: 'Standard', os: 'Standard' } },
    gamer: { name: 'Gamer', t: { case: 'Standard', cpu: 'Standard', ram: 'Standard', storage: 'Standard', gpu: 'Premium', os: 'Standard' } },
    creator: { name: 'Creator', t: { case: 'Standard', cpu: 'Premium', ram: 'Premium', storage: 'Premium', gpu: 'Standard', os: 'Standard' } },
    power: { name: 'Power', t: { case: 'Standard', cpu: 'Premium', ram: 'Premium', storage: 'Premium', gpu: 'Premium', os: 'Standard' } },
    flagship: { name: 'Flagship', t: { case: 'Premium', cpu: 'Premium', ram: 'Premium', storage: 'Premium', gpu: 'Premium', os: 'Premium' } },
  };
  const ARCH_ORDER = ['standard', 'value', 'gamer', 'budget', 'power', 'office', 'creator', 'flagship'];
  CS.DESIGN_ARCH = ARCH;
  CS.DESIGN_PRESETS = {
    demand: { label: 'Follow demand', desc: 'Designs whatever the model says will earn the most.', cfg: { tiers: ['Budget', 'Standard', 'Premium'], diversity: 0.85, maxDesigns: 4 } },
    budget: { label: 'Bargain bin', desc: 'Affordable machines for the volume crowd.', cfg: { tiers: ['Budget', 'Standard'], diversity: 0.85, maxDesigns: 3 } },
    premium: { label: 'High end', desc: 'Standard and Premium parts only, for enthusiasts.', cfg: { tiers: ['Standard', 'Premium'], diversity: 0.85, maxDesigns: 3 } },
    range: { label: 'Full range', desc: 'Spreads designs across the price ladder.', cfg: { tiers: ['Budget', 'Standard', 'Premium'], diversity: 0.4, maxDesigns: 6 } },
  };
  /* ---------- Service Desk manager ---------- */
  const SVC_EVERY = 45; // seconds between reviews at Speed 0
  CS.SVC_PRESETS = {
    balanced: { label: 'Balanced', desc: 'A little spare capacity, spends up to a quarter of your cash per review.', cfg: { headroom: 10, maxSpendPct: 25, techs: true, warranty: true } },
    lean: { label: 'Lean', desc: 'Just enough capacity, careful with cash.', cfg: { headroom: 0, maxSpendPct: 10, techs: true, warranty: true } },
    ahead: { label: 'Stay ahead', desc: 'Plenty of spare capacity so no job is ever turned away.', cfg: { headroom: 30, maxSpendPct: 50, techs: true, warranty: true } },
  };
  const svcDefaults = () => ({ on: true, preset: 'balanced', headroom: 10, maxSpendPct: 25, reserveCash: 0, techs: true, warranty: true, log: true, pins: {} });
  const designDefaults = () => ({
    on: true, preset: 'demand', tiers: ['Budget', 'Standard', 'Premium'], diversity: 0.85, maxDesigns: 4, reserveSlots: 0,
    priceMode: 'auto', fixedMarkup: 0.6, minMarkup: 0.25, maxMarkup: 1.5, minMargin: 0, maxBuildCost: 0,
    allowIgp: true, allowFree: true, refreshAge: 3, autoRetire: true, setTargets: true, coverage: 3, reserveCash: 0,
    namePrefix: '', log: true, pins: {},
  });

  const defaults = (cat) => cat === 'svc' ? svcDefaults() : cat === 'design' ? designDefaults() : ({
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
    const out = { office: d.office, cats: {}, wages: 0, count: 0, designBonus: 0 };
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
      if (c.id === 'design' && cfg.on && d.workshop) out.designBonus = 0.01 * eff.negotiate;
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
        for (let i = 0; i < gi.length; i++) ex[i] += ((served * seg.share * p * ws[i]) / tot) * grp.A * attach * E.kindBoost(d, grp.kind);
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

  /* ---------- the designer's round ---------- */
  const markupGrid = (lo, hi, step) => { const o = []; for (let m = lo; m <= hi + 1e-9; m += step) o.push(Math.round(m * 100) / 100); return o; };
  const newestPart = (slot, tier, y) => CS.PARTS.filter((p) => p.slot === slot && !p.rolling && p.tier === tier && E.partAvail(p, y)).sort((a, b) => b.year - a.year)[0];

  function conceptParts(arch, cfg, y) {
    const parts = {};
    for (const sl of CS.SLOTS) {
      let want = ARCH[arch].t[sl.id], p = null;
      if (want === 'I') p = cfg.allowIgp ? CS.PART_BY_ID.gpu_igp : null;
      else if (want === 'F') p = cfg.allowFree ? CS.PART_BY_ID.os_free : null;
      if (want === 'I') want = 'Budget';
      if (want === 'F') want = 'Standard';
      if (!p) {
        if (!cfg.tiers.includes(want) && !(sl.id === 'os' || sl.id === 'case')) {
          // the allowed tier closest to the one the concept asks for
          const order = ['Budget', 'Standard', 'Premium'];
          const allowed = order.filter((x) => cfg.tiers.includes(x));
          if (!allowed.length) return null;
          want = allowed.reduce((a, b) => (Math.abs(order.indexOf(b) - order.indexOf(want)) < Math.abs(order.indexOf(a) - order.indexOf(want)) ? b : a));
        }
        p = newestPart(sl.id, want, y);
      }
      if (!p) return null;
      parts[sl.id] = p.id;
    }
    return parts;
  }
  const partsKey = (parts) => CS.SLOTS.map((sl) => parts[sl.id]).join('|');

  /** Modelled profit per second of a PC lineup (same demand model the shop sells with). */
  function lineupProfit(set, d, served) {
    const rates = modelRates(set, d, served, 0.6);
    let sum = 0;
    for (const i of set) sum += (rates[i.key] || 0) * (i.price - i.cost);
    return { sum, rates };
  }
  const virt = (key, info, markup, name) => ({ key, kind: 'bp', name, rel: info.rel, cost: info.cost, price: info.cost * (1 + markup), canBuild: true, stock: 0, target: 0 });

  function bestMarkup(cand, base, d, served, cfg, grid) {
    let best = null;
    const before = lineupProfit(base, d, served).sum;
    for (const mk of grid) {
      if (cfg.minMargin > 0 && (mk / (1 + mk)) * 100 < cfg.minMargin) continue;
      const it = Object.assign({}, cand, { price: cand.cost * (1 + mk) });
      const gain = lineupProfit(base.concat([it]), d, served).sum - before;
      if (!best || gain > best.gain) best = { markup: mk, gain, rate: 0 };
    }
    return best;
  }

  function designTick(s, d, items, mg, cfg, m) {
    const now = s.stats.play;
    const eff = m.eff, L = eff.logistics;
    const served = Math.max(0.05, Math.min(d.lambda, d.serve));
    const own = s.bps.filter((b) => b.by === 'designer');
    const grid = markupGrid(Math.max(0, cfg.minMarkup), Math.max(cfg.minMarkup, cfg.maxMarkup), Math.max(0.05, 0.25 - 0.02 * L));
    const autoPrice = cfg.priceMode === 'auto' && eff.forecast >= 2;
    const ageOf = (b) => d.y - Math.max.apply(null, CS.SLOTS.filter((sl) => !CS.PART_BY_ID[b.parts[sl.id]].rolling).map((sl) => CS.PART_BY_ID[b.parts[sl.id]].year));

    // 1. retire designs that are discontinued or stale
    const bpItem = (b) => items.find((i) => i.key === 'b:' + b.id);
    own.forEach((b) => {
      const it = bpItem(b);
      const dead = it && !it.canBuild;
      const stale = ageOf(b) > cfg.refreshAge;
      if (!dead && !(stale && s.bps.length >= d.benchSlots - cfg.reserveSlots)) return;
      b.target = 0;
      if (cfg.autoRetire && !(s.stock['b:' + b.id] > 0)) {
        if (cfg.pins[b.id] === 'pin') return;
        E.deleteBp(s, b.id);
        note(mg, cfg, now, 'ret' + b.id, '🗑️ Retired ' + b.name + (dead ? ' (parts discontinued)' : ' (' + ageOf(b).toFixed(1) + ' years old)') + '.', 60);
      } else if (dead) note(mg, cfg, now, 'sell' + b.id, '⏳ ' + b.name + ' is discontinued. Selling off the last units.', 900);
    });

    // 2. the lineup the designs compete in
    const live = s.bps.filter((b) => b.by === 'designer' && bpItem(b) && bpItem(b).canBuild);
    const market = items.filter((i) => (i.kind === 'pre' && (i.stock > 0 || i.target > 0)) || (i.kind === 'bp' && i.canBuild && !live.some((b) => 'b:' + b.id === i.key) && (i.stock > 0 || i.target > 0)));
    const lineup = () => market.concat(live.map((b) => { const it = bpItem(b); return it ? Object.assign({}, it, { price: E.bpInfo(b, d).price }) : null; }).filter(Boolean));

    // 3. keep prices tuned to the market
    if (autoPrice) {
      live.forEach((b) => {
        if (cfg.pins[b.id] === 'pin') return;
        const others = lineup().filter((i) => i.key !== 'b:' + b.id);
        const info = E.bpInfo(b, d);
        const best = bestMarkup(virt('b:' + b.id, info, 0, b.name), others, d, served, cfg, grid);
        if (best && Math.abs(best.markup - b.markup) >= 0.05) {
          const next = Math.round((b.markup + (best.markup - b.markup) * 0.5) * 100) / 100; // ease toward the target
          note(mg, cfg, now, 'px' + b.id, '🏷️ Repriced ' + b.name + ' to +' + Math.round(next * 100) + '% markup.', 600);
          b.markup = clamp(next, 0, 2);
        }
      });
    }

    // 4. design something new if there is room and it earns its keep
    const free = d.benchSlots - cfg.reserveSlots - s.bps.length;
    let created = null, bestCand = null;
    const waitGen = eff.forecast >= 4 && CS.PARTS.some((p) => !p.rolling && p.year > d.y && p.year <= d.y + 0.3);
    if (live.length < cfg.maxDesigns && free > 0 && !waitGen) {
      const base = lineup();
      const before = lineupProfit(base, d, served).sum;
      const have = new Set(s.bps.map((b) => partsKey(b.parts)));
      const cnt = Math.min(ARCH_ORDER.length, 3 + Math.floor(L / 2));
      const ownedArch = new Set(live.map((b) => b.arch));
      ARCH_ORDER.slice(0, cnt).forEach((a) => {
        const parts = conceptParts(a, cfg, d.y);
        if (!parts || have.has(partsKey(parts))) return;
        const info = E.bpInfo({ parts, markup: 0 }, d);
        if (cfg.maxBuildCost && info.cost > cfg.maxBuildCost) return;
        const cand = virt('b:new', info, 0, a);
        const mks = autoPrice ? grid : [clamp(cfg.fixedMarkup, 0, 2)];
        const best = bestMarkup(cand, base, d, served, cfg, mks);
        if (!best) return;
        const fee = designFee(info.cost);
        let gain = best.gain * (ownedArch.has(a) ? cfg.diversity : 1);
        if (gain <= before * 0.02 + 1e-9) return;
        if (!bestCand || gain > bestCand.gain) bestCand = { a, parts, markup: best.markup, gain, fee, info };
      });
      if (bestCand && s.cash - cfg.reserveCash >= bestCand.fee) {
        const nm = ((cfg.namePrefix ? cfg.namePrefix + ' ' : '') + ARCH[bestCand.a].name + ' ' + Math.floor(d.y) + '-' + (s.bpSeq)).slice(0, 28);
        const r = E.createBp(s, nm, bestCand.parts, bestCand.markup);
        if (r.ok) {
          s.cash -= bestCand.fee;
          r.bp.by = 'designer'; r.bp.arch = bestCand.a; r.bp.born = now;
          mg.stats.ordered++; mg.stats.spent += bestCand.fee;
          created = r.bp;
          live.push(r.bp);
          note(mg, cfg, now, 'new' + r.bp.id, '📐 Designed ' + nm + ' (' + ARCH[bestCand.a].name + ', +' + Math.round(bestCand.markup * 100) + '% markup, design fee $' + Math.round(bestCand.fee) + ').', 5);
        }
      } else if (bestCand) note(mg, cfg, now, 'fee', '💸 Next design (' + ARCH[bestCand.a].name + ') needs $' + Math.round(bestCand.fee) + ' for the design fee.', 900);
      else if (!live.length) note(mg, cfg, now, 'none', '🤔 No design beats the current lineup yet.', 1800);
    } else if (waitGen && live.length < cfg.maxDesigns) note(mg, cfg, now, 'wait', '⏳ A new parts generation is imminent. Holding off on new designs.', 1800);
    else if (free <= 0 && live.length < cfg.maxDesigns) note(mg, cfg, now, 'slots', '🪑 No free blueprint slots. Buy a Design Bench or free one up.', 1800);

    // 5. plan: how many of each to keep on the shelf
    const hasBuyer = d.mgr.cats.bp && d.mgr.cats.bp.on;
    const rates = lineupProfit(lineup(), d, served).rates;
    const plan = [];
    live.forEach((b) => {
      const v = rates['b:' + b.id] || 0;
      const target = Math.ceil(v * cfg.coverage * 60 * 1.2);
      if (cfg.setTargets && !hasBuyer && cfg.pins[b.id] !== 'pin') b.target = v * cfg.coverage * 60 * 1.2 < 0.4 ? 0 : target;
      plan.push({ k: 'b:' + b.id, name: b.name, t: hasBuyer ? (b.target || 0) : (cfg.setTargets ? b.target : 0), v: v * 60, tr: null, why: ARCH[b.arch] ? ARCH[b.arch].name : 'design' });
    });
    mg.plan = plan;
    mg.planT = now;
    mg.stance = '';
  }
  function designFee(cost) { return 12 * cost; }

  /** One review of the Service Desk: buy repair capacity until it covers walk-ins plus headroom, and keep Warranty Pitch growing. */
  function svcTick(s, d, mg, cfg, m) {
    const now = s.stats.play;
    mg.planT = now;
    const want = d.svcDemand * (1 + cfg.headroom / 100 + 0.03 * m.eff.forecast);
    const buys = 1 + Math.floor(m.eff.logistics / 3);
    let budget = Math.max(0, (s.cash - cfg.reserveCash) * (cfg.maxSpendPct / 100));
    const buy = (u) => {
      const cost = E.upCost(s, u);
      if (cost > budget || s.cash - cost < cfg.reserveCash || !E.buyUp(s, u.id)) return false;
      const back = cost * m.disc; // haggling: a refund on what it just paid
      s.cash += back;
      budget -= cost - back;
      mg.stats.ordered++; mg.stats.spent += cost - back; mg.stats.saved += back;
      return true;
    };
    if (cfg.techs) {
      for (let i = 0; i < buys; i++) {
        const dd = E.derive(s);
        const gap = want - dd.svcCap;
        if (gap <= 1e-9) break;
        const opts = CS.UPGRADES.filter((u) => u.kind === 'svc' && E.upUnlocked(s, u) && E.upLevel(s, u.id) < u.max);
        // the cheapest upgrade that closes the gap on its own, else the best capacity for the money
        const fits = opts.filter((u) => u.per >= gap).sort((a, b) => E.upCost(s, a) - E.upCost(s, b))[0];
        const u = fits || opts.sort((a, b) => b.per / E.upCost(s, b) - a.per / E.upCost(s, a))[0];
        if (!u || !buy(u)) {
          if (u) note(mg, cfg, now, 'svcbudget', '💸 Wanted ' + u.name + ' but it is over this review\'s budget (' + cfg.maxSpendPct + '% of cash).', 600);
          break;
        }
        note(mg, cfg, now, 'svcbuy' + u.id, '➕ Added ' + u.name + ' (capacity ' + Math.round(dd.svcCap * 60) + ' → ' + Math.round(E.derive(s).svcCap * 60) + ' jobs/min).', 120);
      }
    }
    if (cfg.warranty) {
      const u = CS.UP_BY_ID.warranty;
      if (E.upUnlocked(s, u) && E.upLevel(s, u.id) < u.max && buy(u)) note(mg, cfg, now, 'svcwarr', '📜 Bought Warranty Pitch level ' + E.upLevel(s, u.id) + ' (' + Math.round(E.derive(s).warranty * 100) + '% of PC buyers).', 120);
    }
    const d2 = E.derive(s);
    mg.plan = [
      { k: 'svc:cap', name: 'Repair capacity (jobs/min)', t: Math.round(d2.svcCap * 60), v: d2.svcDemand * 60, tr: null, why: 'walk-ins' },
      { k: 'svc:warr', name: 'PC buyers taking a warranty (%)', t: Math.round(d2.warranty * 100), v: 0, tr: null, why: 'of PC sales' },
    ];
    if (d2.svcDemand > d2.svcCap * 1.05) note(mg, cfg, now, 'svcshort', '🚪 Still turning away ' + Math.round((d2.svcDemand - d2.svcCap) * 60) + ' jobs a minute (nothing affordable or unlocked).', 900);
  }

  function tick(s, d, items, dt) {
    if (!d.mgr || !d.mgr.count) return;
    CS.MGR_CATS.forEach((c) => {
      const m = d.mgr.cats[c.id];
      if (!m || !m.on) return;
      const mg = s.mgr[c.id];
      mg.tAcc = (mg.tAcc || 0) + dt;
      if (c.svc) {
        if (mg.tAcc >= SVC_EVERY / (1 + 0.25 * m.eff.logistics) || mg.planT == null) {
          mg.tAcc = 0;
          svcTick(s, d, mg, cfgOf(s, c.id), m);
        }
        return;
      }
      if (c.designer) {
        if (mg.tAcc >= DESIGN_EVERY / (1 + 0.25 * m.eff.logistics) || mg.planT == null) {
          mg.tAcc = 0;
          designTick(s, d, items, mg, cfgOf(s, c.id), m);
        }
        return;
      }
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
      if (c.id === 'bp' || c.designer) return; // custom PCs are built by technicians; the manager only plans how many
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
        // add-ons come in packs, one order each; order as many packs as the gap needs (the budget allowing).
        // (One pack per item per step used to cap a best-seller at ~10 units/s, and a tenth of that offline.)
        const packs = addon ? Math.max(1, Math.min(Math.floor(budget), Math.ceil((it.target - it.stock) / it.pack))) : 0;
        const want = addon ? Math.min(packs * it.pack, it.target - it.stock) : Math.min(Math.floor(budget), it.target - it.stock);
        const avail = s.cash - cfg.reserveCash;
        const byPct = cfg.maxOrderPct >= 100 ? Infinity : Math.floor((avail * cfg.maxOrderPct) / 100 / it.cost);
        const k = E.buyUnits(s, it, Math.min(want, byPct), d);
        if (!k) {
          if (avail < it.cost || byPct < 1) note(mg, cfg, s.stats.play, 'budget', '💸 Order budget reached (cash reserve / order limit). Waiting for cash.', 600);
          continue;
        }
        s.mAcc[c.id] -= addon ? Math.ceil(k / it.pack) : k;
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
      applyPreset(s, catId, CAT[catId].svc ? 'balanced' : CAT[catId].designer ? 'demand' : CS.MGR_TRAITS[c.trait].preset || 'balanced');
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
    const p = (CAT[catId].svc ? CS.SVC_PRESETS : CAT[catId].designer ? CS.DESIGN_PRESETS : CS.MGR_PRESETS)[presetId];
    if (!p) return;
    const cfg = cfgOf(s, catId);
    if (CAT[catId].designer) { Object.assign(cfg, JSON.parse(JSON.stringify(p.cfg)), { preset: presetId }); return; } // designer and Service Desk
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
    if (key !== 'on' && key !== 'preset' && key !== 'log' && key !== 'reserveCash' && key !== 'maxOrderPct' && key !== 'maxSpacePct' && key !== 'maxSkus' && key !== 'blocked' && key !== 'groups' && key !== 'maxPrice' && key !== 'maxAge' && key !== 'anticipate' && key !== 'preBuy' && !CAT[catId].designer) cfg.preset = 'custom';
    if (CAT[catId].designer && ['tiers', 'diversity', 'maxDesigns', 'headroom', 'maxSpendPct'].includes(key)) cfg.preset = 'custom';
    if (key === 'preset') applyPreset(s, catId, val);
  }
  /** Hand an auto-designed blueprint over to the player (the designer leaves it alone). */
  function takeOver(s, bpId) {
    const b = s.bps.find((x) => x.id === bpId);
    if (!b) return false;
    delete b.by; delete b.arch;
    return true;
  }
  function setPin(s, catId, key, mode) {
    const cfg = cfgOf(s, catId);
    if (!mode) delete cfg.pins[key];
    else cfg.pins[key] = mode;
    if (mode === 'skip') E.setTarget(s, key, 0);
  }

  CS.M = {
    init, derive, decorate, noteSale, velocity, tick, restock, candidates, hire, fire, refresh, train, applyPreset, setCfg, setPin,
    designFee, svcTick, takeOver, cfgOf, defaults, bonusFor, refreshCost, trainCost, available, effSkills, wageFor, MAX_LEVEL, wageInfl, DECIDE_EVERY,
  };
  if (typeof module !== 'undefined') module.exports = CS;
})(typeof window !== 'undefined' ? window : globalThis);
