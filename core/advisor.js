/* Shop advisor: suggests the best upgrades and surfaces things worth knowing.
   Pure functions over the game state, so it can be tested headless (tools/advisor-check.js).
   Everything it says is an estimate from current sales; it never changes the game. */
(function (g) {
  const CS = g.CS;
  const E = CS.E;

  const SUF = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi'];
  function n(v) {
    const a = Math.abs(v);
    if (a < 1000) return a < 10 ? v.toFixed(a < 1 ? 2 : 1).replace(/\.0$/, '') : String(Math.round(v));
    let i = Math.min(SUF.length - 1, Math.floor(Math.log10(a) / 3));
    let x = v / Math.pow(10, i * 3);
    let s = x.toFixed(Math.abs(x) < 10 ? 2 : Math.abs(x) < 100 ? 1 : 0);
    if (parseFloat(s) >= 1000 && i < SUF.length - 1) { i++; s = (v / Math.pow(10, i * 3)).toFixed(2); }
    return s + SUF[i];
  }
  const $ = (v) => '$' + n(v);
  function dur(sec) {
    if (!isFinite(sec)) return 'a long while';
    if (sec < 90) return Math.max(1, Math.round(sec)) + 's';
    if (sec < 5400) return Math.round(sec / 60) + ' min';
    if (sec < 172800) return (sec / 3600).toFixed(1).replace(/\.0$/, '') + ' h';
    return Math.round(sec / 86400) + ' days';
  }
  const pct = (v) => Math.round(v * 100) + '%';

  // sales-rate memory so we can talk about "right now" (recent stock-outs, walk-outs) rather than lifetime totals
  const mem = { t: -1, stockouts: 0, lost: 0, rateSO: 0, rateLost: 0 };
  function sample(s) {
    const now = s.stats.play;
    // a different shop (prestige, import, erase, cloud copy) has counters below ours: start over
    if (mem.t < 0 || now < mem.t || s.stats.stockouts < mem.stockouts || s.stats.lost < mem.lost) { mem.t = now; mem.stockouts = s.stats.stockouts; mem.lost = s.stats.lost; return; }
    const dt = now - mem.t;
    if (dt >= 20) {
      mem.rateSO = Math.max(0, (s.stats.stockouts - mem.stockouts) / dt);
      mem.rateLost = Math.max(0, (s.stats.lost - mem.lost) / dt);
      mem.t = now; mem.stockouts = s.stats.stockouts; mem.lost = s.stats.lost;
    }
  }

  function model(s, d, items) {
    const served = Math.min(d.lambda, d.serve);
    const rev = s.rate.rev; // sales per second, smoothed
    let w = 0, m = 0, units = 0;
    items.forEach((it) => {
      const v = CS.M ? CS.M.velocity(s, it.key, 50) : null;
      const r = v ? v.rate : 0;
      if (r > 0 && it.price > 0) { w += r * it.price; m += r * (it.price - it.cost); units += r; }
    });
    let margin = w > 0 ? m / w : 0.2;
    let gross = rev * margin;
    // very early on there is no sales history: estimate from what is on the shelves
    if (gross < 0.01) {
      const stocked = items.filter((i) => i.stock > 0 && (i.kind === 'pre' || i.kind === 'bp'));
      if (stocked.length) {
        const avg = stocked.reduce((a, i) => a + (i.price - i.cost), 0) / stocked.length;
        gross = served * 0.6 * avg;
      }
    }
    return { served, rev, margin, gross, net: gross - d.upkeep, perShopper: served > 0 ? gross / served : 0, units };
  }

  /* ---------- upgrade scoring ---------- */
  function cloneWith(s, id) {
    const c = Object.assign({}, s);
    c.up = Object.assign({}, s.up);
    c.up[id] = (c.up[id] || 0) + 1;
    return c;
  }
  function gainOf(u, s, d, pm, ctx) {
    const L = E.upLevel(s, u.id);
    const per = (x) => '≈ +' + $(x * 60) + '/min';
    switch (u.kind) {
      case 'lambda': case 'loyal': case 'serve': case 'serveMult': {
        const d2 = E.derive(cloneWith(s, u.id));
        const dServed = Math.min(d2.lambda, d2.serve) - pm.served;
        const gain = dServed * pm.perShopper - Math.max(0, d2.upkeep - d.upkeep);
        if (dServed <= 0) return null;
        const what = u.kind === 'serve' || u.kind === 'serveMult'
          ? 'Customers are queueing: serves ' + n(dServed) + ' more per second'
          : 'Checkout has room: brings ' + n(dServed) + ' more customers per second';
        return { gain, why: what + ', ' + per(gain) + '.' };
      }
      case 'disc': {
        const cogs = Math.max(0, pm.rev - pm.gross);
        return { gain: u.per * cogs, why: 'Cuts what you pay suppliers by ' + pct(u.per) + ', ' + per(u.per * cogs) + '.' };
      }
      case 'attach': {
        if (!d.aisleGame && !d.aisleAcc) return null;
        const base = pm.gross * 0.15;
        return { gain: base * u.per, why: 'Cashiers sell more games and accessories (+' + pct(u.per) + '), ' + per(base * u.per) + '.' };
      }
      case 'cap': {
        if (ctx.util < 0.85) return null;
        const gain = pm.gross * Math.min(0.15, (0.5 * u.per) / Math.max(1, d.cap));
        return { gain, why: 'Shelves are ' + pct(ctx.util) + ' full, so sales are capped by space: +' + u.per + ' spaces, ' + per(gain) + '.' };
      }
      case 'restock': {
        if (ctx.noAutomation && ctx.soldAny) return { gain: pm.gross * 0.25, why: 'Nobody restocks for you. A clerk keeps the shelves full, even while you are away.' };
        if (ctx.restockShort) return { gain: pm.gross * 0.12, why: 'Orders (' + n(d.restock) + '/s) are slower than sales (' + n(pm.units) + '/s): shelves keep running dry.' };
        return null;
      }
      case 'build': {
        if (!ctx.buildShort) return null;
        return { gain: pm.gross * 0.1, why: 'Your blueprints have unfilled build targets: more builders turn parts into sales.' };
      }
      case 'aisle_acc': return d.aisleAcc || pm.gross <= 0 ? null : { gain: pm.gross * 0.2, why: 'Keyboards, monitors and modems carry fat margins and PC buyers add them on.' };
      case 'aisle_console': return d.aisleConsole || pm.gross <= 0 ? null : { gain: pm.gross * 0.15, why: 'Consoles bring gamers in, and their games and accessories carry the margin. Every console you sell grows your game business.' };
      case 'aisle_game': return d.aisleGame || pm.gross <= 0 ? null : { gain: pm.gross * 0.12, why: 'PC games sell to almost every shopper. Better PCs mean better game sales.' };
      case 'office': return d.office || pm.gross <= 0 || !(s.up.clerk > 0) ? null : { gain: pm.gross * 0.05, why: 'Buyers watch trends and manage your stock levels, so you do not have to.' };
      case 'workshop': return d.workshop || d.y < 1996 || pm.gross <= 0 ? null : { gain: pm.gross * 0.2, why: 'Build and sell your own PCs: fatter margins than prebuilts.' };
      case 'night': {
        if (!(s.lastAway && s.lastAway.capped)) return null;
        return { gain: pm.gross * 0.12, why: 'You were away ' + dur(s.lastAway.elapsed) + ' but the shop only traded for ' + dur(s.lastAway.cap) + '. Longer unattended hours earn more.' };
      }
      default: return null;
    }
  }

  const TOKEN_ORDER = ['t_income', 't_profit', 't_cash', 't_kit', 't_supply', 't_cap', 't_night', 't_build', 't_token'];

  function analyze(s, d, items) {
    sample(s);
    const pm = model(s, d, items);
    const total = E.totalStock(s);
    const util = d.cap > 0 ? total / d.cap : 0;
    const pcItems = items.filter((i) => i.kind === 'pre' || i.kind === 'bp');
    const mgrOn = !!(d.mgr && Object.values(d.mgr.cats).some((c) => c && c.on));
    const deficit = items.reduce((a, i) => a + Math.max(0, i.target - i.stock) * (i.size || 1), 0);
    const ctx = {
      util,
      soldAny: s.stats.sold > 0,
      noAutomation: d.restock <= 0 && !mgrOn,
      restockShort: d.restock > 0 && !mgrOn && pm.units > 0 && d.restock < pm.units * 0.9 && deficit > 0,
      buildShort: d.workshop && s.bps.some((b) => (b.target || 0) > (s.stock['b:' + b.id] || 0)) && d.build > 0 && s.bps.length > 0,
    };

    /* ---- recommended upgrades ---- */
    const recs = [];
    CS.UPGRADES.forEach((u) => {
      if (!E.upUnlocked(s, u) || E.upLevel(s, u.id) >= u.max) return;
      const gv = gainOf(u, s, d, pm, ctx);
      if (!gv || !(gv.gain > 0)) return;
      const cost = E.upCost(s, u);
      recs.push({
        kind: 'up', id: u.id, name: u.name, icon: u.icon, lvl: E.upLevel(s, u.id), max: u.max, cost,
        afford: s.cash >= cost, payback: cost / gv.gain, gainPerMin: gv.gain * 60, why: gv.why,
        eta: s.cash >= cost ? 0 : (pm.net > 0.01 ? (cost - s.cash) / pm.net : Infinity),
      });
    });
    recs.sort((a, b) => a.payback - b.payback);
    // keep strong ideas first, but always show something affordable-ish when it pays back within an hour
    const seenKind = new Set();
    const varied = recs.filter((r) => { const k = CS.UP_BY_ID[r.id].kind; if (seenKind.has(k)) return false; seenKind.add(k); return true; });
    const strong = varied.filter((r) => r.payback < 3600).slice(0, 3);
    const top = strong.length ? strong : varied.slice(0, 1);

    // spend unspent Franchise Tokens
    const tokens = s.meta.tokens;
    let tokenRec = null;
    if (tokens > 0) {
      for (const id of TOKEN_ORDER) {
        const u = CS.TUP_BY_ID[id];
        if (E.tl(s, id) >= u.max) continue;
        const cost = E.tokenCost(s, u);
        if (cost <= tokens) { tokenRec = { kind: 'tup', id, name: u.name, icon: u.icon, lvl: E.tl(s, id), max: u.max, cost, afford: true, why: u.desc + '. You have ' + n(tokens) + ' unspent tokens.' }; break; }
      }
    }

    /* ---- insights ---- */
    const ins = [];
    const add = (p, lv, icon, text) => ins.push({ p, lv, icon, text });
    const year = d.y;

    if (!ctx.soldAny && total === 0) add(100, 'warn', '👋', 'Buy a computer in the Stock tab, then hustle it. Every sale funds the next upgrade.');
    else if (!pcItems.some((i) => i.stock > 0)) add(95, 'bad', '🚫', 'No computers in stock: customers are leaving empty-handed' + (mem.rateSO > 0.01 ? ' (about ' + n(mem.rateSO * 60) + ' a minute)' : '') + '.');

    if (d.lambda > d.serve * 1.1 && d.lambda > 0.1) add(85, 'warn', '⏳', 'Checkout is your bottleneck: ' + n(d.lambda) + ' customers/s arrive but only ' + n(d.serve) + '/s can be served (' + pct(1 - d.serve / d.lambda) + ' walk out). Upgrade checkout before buying more marketing.');
    else if (d.serve > d.lambda * 1.8 && d.lambda > 0.1) add(55, 'info', '📣', 'Checkout can handle ' + n(d.serve / d.lambda) + '× more customers than arrive now. Marketing upgrades will pay off.');

    if (util >= 0.9 && ctx.soldAny) add(80, 'warn', '📦', 'Shelves are ' + pct(util) + ' full (' + total + '/' + d.cap + '). Expand the shop floor, or let a buyer trim slow movers.');

    if (mem.rateSO > 0.02 && pcItems.some((i) => i.stock > 0)) add(75, 'warn', '🛒', 'About ' + n(mem.rateSO * 60) + ' customers a minute find their product sold out. Raise restock targets on your best sellers.');

    // earners and fading lines
    const ranked = items.map((it) => {
      const v = CS.M ? CS.M.velocity(s, it.key, 50) : null;
      return { it, v, profit: v ? v.rate * (it.price - it.cost) : 0 };
    }).filter((x) => x.v && x.v.rate > 0).sort((a, b) => b.profit - a.profit);
    if (ranked.length >= 2) {
      const t = ranked[0];
      add(40, 'good', '🏅', 'Top earner: ' + t.it.name + ' (about ' + $(t.profit * 60) + ' profit a minute, ' + pct(t.profit / Math.max(1e-9, ranked.reduce((a, x) => a + x.profit, 0))) + ' of the total).');
    }
    const fading = ranked.filter((x) => x.v.trend < -0.4 && x.v.a * 60 > 0.5 && x.it.stock > 0).slice(0, 2);
    fading.forEach((x) => add(50, 'info', '↘', x.it.name + ' is selling ' + pct(-x.v.trend) + ' slower than usual. Do not restock heavily' + (x.it.age > 2 ? ' (it is ' + x.it.age.toFixed(1) + ' years old)' : '') + '.'));
    const rising = ranked.filter((x) => x.v.trend > 0.5 && x.v.a * 60 > 0.5).slice(0, 1);
    rising.forEach((x) => add(52, 'good', '↗', x.it.name + ' is selling ' + pct(x.v.trend) + ' faster than usual. Make sure it stays in stock.'));

    // old stock sitting around
    const oldUnits = items.filter((i) => (i.kind === 'pre' && i.age > 4) || (i.kind === 'game' && i.age > 3)).reduce((a, i) => a + i.stock, 0);
    if (oldUnits >= 5) add(48, 'info', '🕸️', oldUnits + ' units of old models are taking up shelf space. Stop reordering them, or cut their price.');

    // money and margins
    if (d.upkeep > 0 && pm.rev > 0 && d.upkeep > pm.rev * 0.35) add(78, 'warn', '💸', 'Wages and rent are ' + pct(d.upkeep / pm.rev) + ' of your sales (' + $(d.upkeep * 60) + '/min). Check that staff upgrades pay for themselves.');
    if (pm.rev > 1) add(30, 'info', '💰', 'You net about ' + $(Math.max(0, pm.net) * 60) + ' a minute after wages (average margin ' + pct(pm.margin) + ').');
    if (s.priceAdj <= -0.1 && pm.rev > 1) add(42, 'info', '🏷️', 'Your pricing policy is ' + Math.round(s.priceAdj * 100) + '%, so you give away margin. Raise it if shelves empty slowly.');
    const best = recs[0];
    if (best && s.cash > best.cost * 25 && best.payback < 1800) add(60, 'warn', '🏦', 'You are sitting on ' + $(s.cash) + ' while upgrades pay back in minutes. Spend it.');

    // product lines
    if (!d.aisleAcc && s.stats.sold >= 15) add(58, 'info', '🖱️', 'Accessories Wall (Upgrades → Shop): PC buyers add on keyboards and monitors at 30–70% margins.');
    if (d.aisleAcc || d.aisleGame) {
      const addons = items.filter((i) => (i.kind === 'game' || i.kind === 'acc') && i.stock > 0).length;
      if (addons < 4 && s.stats.sold >= 30) add(56, 'info', '🧺', 'Only ' + addons + ' game/accessory lines are on the shelves. Stock a few of each so shoppers can add something on.');
    }
    if (d.aisleGame) {
      const hard = items.filter((i) => i.kind === 'game' && i.buyable && i.age < 1 && i.capF < 0.5).length;
      if (hard) add(44, 'info', '🎮', hard + ' new game' + (hard > 1 ? 's are' : ' is') + ' too demanding for the PCs you sell. Stock faster computers to sell them.');
    }
    if (d.workshop) {
      if (!s.bps.length) add(66, 'info', '🛠️', 'The workshop is open but you have no blueprint. Design a PC in the Workshop tab.');
      else {
        const dead = s.bps.filter((b) => !(items.find((i) => i.key === 'b:' + b.id) || {}).canBuild);
        if (dead.length) add(64, 'warn', '⚠️', '"' + dead[0].name + '" uses discontinued parts. Design a fresh blueprint.');
        else if (s.bps.every((b) => !(b.target > 0))) add(62, 'info', '🔧', 'Your blueprints have no build target, so nothing is being built. Set an auto-build target.');
      }
    }

    // buyers
    if (d.office && CS.M) {
      const unstaffed = CS.MGR_CATS.filter((c) => !c.designer && !s.mgr[c.id] && CS.M.available(d, c.id));
      if (unstaffed.length) add(46, 'info', '👔', 'No buyer for ' + unstaffed.map((c) => c.name).join(', ') + '. A buyer sets stock levels and orders for you.');
      const dz = CS.MGR_CATS.find((c) => c.designer);
      if (dz && !s.mgr.design && CS.M.available(d, 'design') && s.bps.length < d.benchSlots) add(44, 'info', '📐', 'Hire a PC Designer (Buyers tab): it designs custom-PC blueprints from market demand, prices them and retires obsolete ones.');
      if (s.mgr.design && s.mgrCfg.design.on && s.bps.length >= d.benchSlots && s.bps.filter((b) => b.by === 'designer').length < s.mgrCfg.design.maxDesigns) add(52, 'info', '🪑', 'The PC Designer has no free blueprint slots. Buy a Design Bench so it can add designs.');
      CS.MGR_CATS.forEach((c) => {
        const mg = s.mgr[c.id];
        if (mg && !s.mgrCfg[c.id].on) add(54, 'warn', '😴', c.name + (c.designer ? ' ' : ' buyer ') + mg.name + ' is off duty and still being paid.');
        const l = mg && mg.log && mg.log.find((x) => /budget reached/.test(x.txt) && s.stats.play - x.t < 600);
        if (l) add(68, 'warn', '💸', c.name + ' is held back by the cash reserve / order limit. Loosen it, or earn more.');
      });
    }

    // upcoming events
    const KIND_LABEL = { game: 'PC games', acc: 'accessories', console: 'consoles', cgame: 'console games', cacc: 'console accessories' };
    // scan the next ~4 months in small steps: retail seasons can be just a couple of weeks long
    const evNow = E.eventsAt(year), soonNew = [];
    for (let dy = 0.02; dy <= 0.3 + 1e-9; dy += 0.02) {
      E.eventsAt(year + dy).list.forEach((e) => {
        if (!evNow.list.some((x) => x.id === e.id) && !soonNew.some((x) => x.id === e.id)) soonNew.push(e);
      });
    }
    soonNew.filter((e) => !e.launch).forEach((e) => {
      const months = Math.max(1, Math.round((e.from - year) * 12));
      add(72, e.demand && e.demand < 1 ? 'warn' : 'info', '📅', e.name + ' in about ' + months + ' month' + (months > 1 ? 's' : '') + ': ' + (e.demand ? (e.demand > 1 ? 'demand +' : 'demand ') + Math.round((e.demand - 1) * 100) + '%' : e.kinds ? 'more shoppers pick up ' + Object.keys(e.kinds).map((k) => KIND_LABEL[k] || k).join(' and ') + '. Stock up' : 'prices will swing') + (e.demand > 1 ? '. Build up stock.' : e.partCost || e.gpuCost || e.preCost ? '. Stock up before prices rise.' : '.'));
    });
    evNow.list.forEach((e) => add(38, 'info', '📣', e.name + ' is on: ' + e.text));

    // console platforms: launches, allocation, and games without an installed base
    if (CS.Con && d.aisleConsole) {
      CS.Con.upcoming(year, 0.6).forEach((p) => {
        const months = Math.max(1, Math.round((p.year - year) * 12));
        add(73, 'info', '🎮', p.name + ' launches in about ' + months + ' month' + (months > 1 ? 's' : '') + '. Expect a rush, but supply will be limited: get consoles in early.');
      });
      items.filter((i) => i.kind === 'console' && i.limited).forEach((i) => add(71, 'warn', '🔥', i.name + ' is in its launch window: demand is hot but you can only hold about ' + i.allocCap + '. Each one you sell builds your game sales.'));
      const stockedPlats = {};
      items.forEach((i) => { if (i.kind === 'cgame' && i.stock > 0) stockedPlats[i.plat] = (stockedPlats[i.plat] || 0) + i.stock; });
      CS.Con.market(s, d).filter((m) => m.share > 0.06 && m.base < 3 && stockedPlats[m.plat.id]).slice(0, 1).forEach((m) => add(57, 'info', '💿', 'You stock ' + m.plat.name + ' games but have sold almost no ' + m.plat.name + ' consoles. Sell some and its games will sell much better.'));
      const topShare = CS.Con.market(s, d)[0];
      if (topShare && topShare.share > 0.08 && !items.some((i) => i.kind === 'console' && i.plat === topShare.plat.id && i.stock > 0) && items.some((i) => i.kind === 'console' && i.plat === topShare.plat.id && i.buyable)) add(59, 'info', '🛒', topShare.plat.name + ' is the most-owned console (' + pct(topShare.share) + ' of shoppers) and you have none in stock.');
    } else if (CS.Con && !d.aisleConsole && s.stats.sold >= 40) add(53, 'info', '🎮', 'Console Corner (Upgrades → Shop): consoles bring in gamers, and their games and accessories earn the margin.');

    // unattended trading
    const pcStock = pcItems.reduce((a, i) => a + i.stock, 0);
    if (pm.units > 0.01 && ctx.noAutomation && pcStock > 0) {
      add(70, 'warn', '🌙', 'Nobody restocks while you are away: your shelves hold about ' + dur(pcStock / pm.units) + ' of sales. Hire a Stock Clerk or buyers so the shop trades overnight.');
    } else if (s.lastAway && s.lastAway.capped) add(36, 'info', '⏰', 'Last time you were away ' + dur(s.lastAway.elapsed) + ' but the shop only traded for ' + dur(s.lastAway.cap) + '.');

    // franchise tokens
    const pend = E.pendingTokens(s);
    if (pend >= 1) {
      const next = E.nextTokenAt(s);
      const eta = pm.rev > 0.01 ? (next - s.stats.revenue) / pm.rev : Infinity;
      add(34, 'good', '🎫', pend + ' Franchise Token' + (pend > 1 ? 's' : '') + ' ready. The next needs ' + $(next - s.stats.revenue) + ' more sales (about ' + dur(eta) + ')' + (eta > 3600 ? ', so cashing in now is a good call.' : '. Waiting a little longer is worth it.'));
    } else if (year >= 2010 && s.cal > 0) {
      const need = CS.C.TOKEN_R0 - s.stats.revenue;
      if (need > 0 && pm.rev > 0.01) add(26, 'info', '🎫', 'Franchise Tokens start at ' + $(CS.C.TOKEN_R0) + ' in total sales: ' + $(need) + ' to go (about ' + dur(need / pm.rev) + ').');
    }

    // what is coming
    const nextUp = CS.UPGRADES.filter((u) => u.year > year && (!u.req || s.up[u.req])).sort((a, b) => a.year - b.year)[0];
    if (nextUp && nextUp.year - year < 1.5) add(24, 'info', '🔭', 'Coming in ' + nextUp.year + ': ' + nextUp.name + '.');

    ins.sort((a, b) => b.p - a.p);
    return { recs: top, tokenRec, insights: ins.slice(0, 6), more: Math.max(0, ins.length - 6), all: ins, model: pm };
  }

  CS.Advisor = { analyze, fmt: { n, $, dur } };
  if (typeof module !== 'undefined') module.exports = CS;
})(typeof window !== 'undefined' ? window : globalThis);
