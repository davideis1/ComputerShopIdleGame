/* Headless balance check:  node tools/sim.js [minutes] [runs] [options]
   A bot plays the full game (core/: consoles, buyers, PC Designer, names) so we can see how cash, income and
   Franchise Tokens progress. Runs are seeded, so the same command prints the same numbers.
     minutes      play time per franchise (default 250, about the whole 1993 -> today calendar)
     runs         franchises to play; between runs it claims tokens and buys HQ upgrades (default 1)
     --bot=full   (default) hires buyers and the PC Designer once the Purchasing Office opens, opens Console Corner
     --bot=classic  the original bot: stocks prebuilts, add-ons and its own blueprints by hand, no buyers or consoles
     --seed=N     random seed (default 1)
     --quiet      only the summary table (what CI runs)
     --items      also list what the shop stocks at the end
   Exits non-zero if the economy breaks (NaN/negative-infinite cash, no revenue, the calendar stalls). */
const args = process.argv.slice(2);
const opt = (k, d) => { const a = args.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };
const flag = (k) => args.includes('--' + k);
const pos = args.filter((x) => !x.startsWith('--'));
const mins = +pos[0] || 250;
const runs = +pos[1] || 1;
const mode = opt('bot', 'full');
const quiet = flag('quiet');
if (!['full', 'classic'].includes(mode)) { console.error('unknown --bot=' + mode); process.exit(2); }

// Seed Math.random before the core loads (customers, events and buyer candidates all use it).
let seed = (+opt('seed', 1) >>> 0) || 1;
Math.random = () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const CS = require('../core');
const E = CS.E;
const log = (...a) => { if (!quiet) console.log(...a); };
const fmt = (n) => (n >= 1e12 ? (n / 1e12).toFixed(2) + 'T' : n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : n.toFixed(0));
const problems = [];

function bestParts(d, tiers) {
  const parts = {};
  CS.SLOTS.forEach((sl) => {
    const tier = tiers[sl.id] || 'Standard';
    const c = CS.PARTS.filter((p) => p.slot === sl.id && E.partAvail(p, d.y) && p.tier === tier && !p.rolling).sort((x, y) => y.year - x.year)[0]
      || CS.PARTS.filter((p) => p.slot === sl.id && E.partAvail(p, d.y)).pop();
    parts[sl.id] = c.id;
  });
  return parts;
}
// expected margin per arriving customer from each item, using the real demand model
function scoreItems(items, d) {
  const score = new Map(items.map((i) => [i.key, 0]));
  E.SEG.forEach((seg) => {
    const ws = items.map((i) => E.itemWeight(seg, i.rel, i.price, d.y));
    const tot = ws.reduce((a, b) => a + b, 0);
    const pb = Math.min(0.95, 1 - Math.exp(-tot / 0.8));
    items.forEach((i, k) => score.set(i.key, score.get(i.key) + (seg.share * pb * ws[k] / tot) * (i.price - i.cost)));
  });
  return score;
}

// Full bot: once the office is open, hand each category to a buyer (cheapest signing bonus) as cash allows.
const HIRE_ORDER = ['pre', 'game', 'acc', 'design', 'con', 'bp'];
function hireBuyers(s, reserve) {
  const d = E.derive(s);
  if (!d.office) {
    const u = CS.UP_BY_ID.purchasing;
    if (E.upUnlocked(s, u) && s.cash > E.upCost(s, u) * 1.5 + reserve) E.buyUp(s, 'purchasing');
    return;
  }
  if (!s.up.aisle_console && s.cash > E.upCost(s, CS.UP_BY_ID.aisle_console) * 2 + reserve && E.upUnlocked(s, CS.UP_BY_ID.aisle_console)) E.buyUp(s, 'aisle_console');
  for (const cat of HIRE_ORDER) {
    if (s.mgr[cat] || !CS.M.available(E.derive(s), cat)) continue;
    const pool = CS.M.candidates(s, cat);
    const bonus = (c) => CS.M.bonusFor(s, c.wage, d.y);
    const idx = pool.map((c, i) => i).sort((a, b) => bonus(pool[a]) - bonus(pool[b]))[0];
    if (s.cash > bonus(pool[idx]) * 2 + reserve) CS.M.hire(s, cat, idx);
    break; // one hire per bot round, in order
  }
}

function bot(s) {
  const d = E.derive(s);
  const has = (cat) => mode === 'full' && !!s.mgr && !!s.mgr[cat];
  const all = E.getItems(s, d).filter((i) => i.buyable || i.canBuild);
  const sc = scoreItems(all, d);
  const pre = all.filter((i) => i.kind === 'pre').sort((a, b) => sc.get(b.key) - sc.get(a.key));
  const sellRate = Math.min(d.lambda, d.serve) * 0.7;
  const per = Math.max(2, Math.ceil((sellRate * 40) / 4));
  const reserve = (pre[0] ? pre[0].cost : 1000) * 2;
  if (!has('pre')) pre.forEach((i, idx) => E.setTarget(s, i.key, idx < 4 ? per : 0));
  // add-ons: open aisles when affordable, stock the two best items per group
  [['aisle_acc', 2e3], ['aisle_games', 4e3]].forEach(([id, min]) => {
    if (!s.up[id] && s.cash > min + (pre[0] ? pre[0].cost * 2 : 1000) && d.y >= 1994) E.buyUp(s, id);
  });
  const addons = E.getItems(s, d).filter((i) => (i.kind === 'game' || i.kind === 'acc') && i.buyable && !has(i.kind));
  CS.GROUPS.forEach((grp) => {
    const gi = addons.filter((i) => i.group === grp.id).sort((a, b) => (b.price - b.cost) * b.rel * b.capF - (a.price - a.cost) * a.rel * a.capF);
    gi.forEach((i, idx) => E.setTarget(s, i.key, idx < 2 ? Math.max(i.pack * 2, Math.ceil(sellRate * 30 * grp.A)) : 0));
  });
  if (d.workshop && !has('design')) {
    const fresh = s.bps.filter((b) => E.bpInfo(b, d).avail && d.y - Math.max(...Object.values(b.parts).map((id) => CS.PART_BY_ID[id].year)) < 2.5);
    if (fresh.length < 2 && s.bps.length >= d.benchSlots) {
      const dead = s.bps.find((b) => !s.stock['b:' + b.id]);
      if (dead) E.deleteBp(s, dead.id);
    }
    if (fresh.length < 2 && s.bps.length < d.benchSlots) {
      const prem = fresh.length === 1;
      const parts = bestParts(d, prem ? { cpu: 'Premium', gpu: 'Premium' } : {});
      E.createBp(s, (prem ? 'Elite ' : 'Rig ') + Math.floor(d.y), parts, prem ? 0.9 : 0.8);
    }
  }
  if (d.workshop && !has('bp') && !has('design')) {
    const bi = E.getItems(s, d).filter((i) => i.kind === 'bp' && i.canBuild);
    s.bps.forEach((b) => (b.target = bi.find((i) => i.id === b.id) ? per : 0));
  }
  if (mode === 'full') hireBuyers(s, reserve);
  // buy upgrades: balance lambda vs serve vs restock vs capacity
  for (let n = 0; n < 6; n++) {
    const dd = E.derive(s);
    const avail = CS.UPGRADES.filter((u) => E.upUnlocked(s, u) && E.upLevel(s, u.id) < u.max);
    const eff = (u) => u.per / E.upCost(s, u);
    const pick = (kind) => avail.filter((u) => u.kind === kind).sort((a, b) => eff(b) - eff(a))[0];
    const need = [];
    const sr = Math.min(dd.lambda, dd.serve) * 0.8;
    if (dd.restock < sr * 1.3) need.push(pick('restock'));
    if (dd.cap < sr * 120 + 12) need.push(pick('cap'));
    if (dd.lambda > dd.serve) need.push(pick('serve'));
    else need.push(pick('lambda'));
    if (dd.serve > dd.lambda * 1.5) need.push(pick('lambda'));
    if (!dd.workshop && dd.y >= 1997 && s.cash > 40000) need.push(CS.UP_BY_ID.workshop);
    if (dd.workshop) {
      if (dd.build < sr * 0.2) need.push(pick('build'));
      need.push(pick('buildMult'));
    }
    need.push(pick('disc'));
    let bought = false;
    for (const u of need.filter(Boolean)) {
      if (s.cash > E.upCost(s, u) + reserve && E.buyUp(s, u.id)) { bought = true; break; }
    }
    if (!bought) break;
  }
}

const SPLIT = { pre: 'pre', bp: 'custom', game: 'add-on', acc: 'add-on', console: 'console', cgame: 'console', cacc: 'console' };
/** Play one franchise for `mins` minutes of real time; returns its numbers. */
function play(s, run) {
  const split = {};
  const marks = {};
  let lastY = 0, firstToken = null;
  for (let t = 0; t < mins * 60; t++) {
    if (t % 5 === 0) bot(s);
    const evs = [];
    E.step(s, 1, 1, null, evs);
    evs.forEach((e) => { if (e.it) { const k = SPLIT[e.it.kind] || e.it.kind; split[k] = (split[k] || 0) + e.rev; } });
    const y = Math.floor(E.yearOf(s));
    if (firstToken == null && t % 60 === 0 && E.pendingTokens(s) > 0) firstToken = t / 60;
    if ([2000, 2010, 2020].includes(y) && marks[y] == null) marks[y] = t / 60;
    if (s.cal >= 33.79 && marks.today == null) marks.today = t / 60;
    if (y !== lastY && t % 5 === 0) {
      lastY = y;
      const d = E.derive(s);
      if (run === 1) log(
        `${(t / 60).toFixed(0).padStart(4)}m  ${y}  cash $${fmt(s.cash).padStart(8)}  rev/s ${fmt(s.rate.rev).padStart(7)}  upkeep/s ${fmt(d.upkeep).padStart(6)}  λ ${d.lambda.toFixed(2)} serve ${d.serve.toFixed(2)} restock ${d.restock.toFixed(1)} cap ${d.cap}  sold ${fmt(s.stats.sold)} built ${fmt(s.stats.built)}  buyers ${Object.values(s.mgr || {}).filter(Boolean).length}  runRev ${fmt(s.stats.revenue)} tokens ${E.pendingTokens(s)}`,
      );
    }
  }
  if (!Number.isFinite(s.cash) || !Number.isFinite(s.stats.revenue)) problems.push(`run ${run}: cash/revenue is not a number`);
  if (!(s.stats.revenue > 0)) problems.push(`run ${run}: no revenue`);
  if (E.yearOf(s) < 1993 + Math.min(30, mins / 8)) problems.push(`run ${run}: calendar only reached ${E.yearOf(s).toFixed(1)}`);
  const tot = Object.values(split).reduce((a, b) => a + b, 0) || 1;
  const share = (k) => (100 * (split[k] || 0)) / tot;
  return { revenue: s.stats.revenue, tokens: E.pendingTokens(s), marks, firstToken, share, year: E.yearOf(s) };
}

const PRIORITY = ['t_income', 't_profit', 't_cash', 't_kit', 't_cap', 't_supply', 't_token', 't_night', 't_build'];
const t0 = Date.now();
let s = E.newState();
const rows = [];
for (let run = 1; run <= runs; run++) {
  let bought = 0;
  if (run > 1) {
    const p = E.prestige(s);
    if (!p) { problems.push(`run ${run - 1}: no tokens to claim`); break; }
    s = p.state;
    for (let guard = 0; guard < 500; guard++) {
      // first affordable upgrade in priority order
      const pick = PRIORITY.map((id) => CS.TUP_BY_ID[id]).filter((u) => E.tl(s, u.id) < u.max && E.tokenCost(s, u) <= s.meta.tokens)[0];
      if (!pick) break;
      E.buyTokenUp(s, pick.id); bought++;
    }
  }
  const r = play(s, run);
  rows.push({ run, bought, ...r });
  if (run === 1) {
    log('revenue split', ['pre', 'custom', 'add-on', 'console'].map((k) => k + ' ' + r.share(k).toFixed(1) + '%').join(', '));
    log('add-on share incl. console games & accessories (stats)', (100 * s.stats.addonRevenue / s.stats.revenue).toFixed(1) + '%', 'games', fmt(s.stats.soldGames), 'acc', fmt(s.stats.soldAcc), 'consoles', fmt(s.stats.soldConsoles || 0), 'pcRel', s.pcRel.toFixed(2));
    // Offline equivalence check: 8h offline vs 10 minutes online from the same save
    const a = E.deserialize(E.serialize(s));
    const b = E.deserialize(E.serialize(s));
    let t1 = Date.now();
    const rep = E.offline(a, 8 * 3600);
    log('offline 8h -> year', E.yearOf(a).toFixed(2), 'cash', fmt(a.cash), 'units', fmt(rep.units), 'revenue', fmt(rep.revenue), '(sim ms', Date.now() - t1 + ')');
    t1 = Date.now();
    E.advance(b, 600, 1);
    log('600s online -> cash', fmt(b.cash), '(sim ms', Date.now() - t1 + ')');
    if (!Number.isFinite(a.cash) || !Number.isFinite(b.cash)) problems.push('offline/online catch-up broke the cash');
    if (flag('items')) {
      const d = E.derive(s);
      log('year', d.y.toFixed(1), 'items with targets:');
      E.getItems(s, d).filter((i) => i.target > 0 || i.stock > 0)
        .forEach((i) => log(' ', i.key.padEnd(18), 'price', fmt(i.price).padStart(7), 'cost', fmt(i.cost).padStart(7), 'rel', i.rel.toFixed(2), 'tgt', i.target, 'stock', i.stock));
    }
  }
}

// Summary: one row per franchise. tok/h = tokens claimable at the end / hours played; the key prestige-pacing number.
const m = (v) => (v == null ? '   -' : String(Math.round(v)).padStart(4));
console.log(`\nsim.js ${mins}m x ${runs}, bot=${mode}, seed=${opt('seed', 1)}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
console.log('run  HQ ups  2000  2010  2020  today  1st tok  revenue    tokens  tok/h   pre  cust  addon  cons');
rows.forEach((r) => console.log(
  `${String(r.run).padStart(3)}  ${String(r.bought).padStart(6)}  ${m(r.marks[2000])}m ${m(r.marks[2010])}m ${m(r.marks[2020])}m ${m(r.marks.today)}m  ${m(r.firstToken)}m   ${fmt(r.revenue).padStart(8)}  ${String(r.tokens).padStart(6)}  ${(r.tokens / (mins / 60)).toFixed(1).padStart(5)}  ${['pre', 'custom', 'add-on', 'console'].map((k) => r.share(k).toFixed(0).padStart(4) + '%').join(' ')}`,
));
if (problems.length) { console.error('\nPROBLEMS:\n' + problems.join('\n')); process.exit(1); }
