/* Decision events: now and then during active play a choice card arrives (a bulk order, a cheap container of stock,
   a reviewer, an ad deal...). It waits 90 s; ignored offers are declined. Offers never arrive during offline catch-up.
   Loaded after engine.js and before advisor.js; the engine calls CS.Offers.tick from step() and reads s.boost in derive(). */
(function (g) {
  const CS = g.CS;
  const E = CS.E;

  const WAIT = 90; // seconds an offer stays open
  const GAP = [180, 360]; // seconds of play between offers
  const clampRep = (v) => Math.max(1, Math.min(5, v));
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const $ = (n) => '$' + (n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e4 ? Math.round(n / 1e3) + 'K' : Math.round(n).toLocaleString('en-US'));
  const pcsInStock = (items) => items.filter((i) => (i.kind === 'pre' || i.kind === 'bp') && i.stock > 0);
  const byKey = (s, key) => E.getItems(s, E.derive(s)).find((i) => i.key === key);
  const income = (s, secs) => Math.max(0, s.rate.rev) * secs;
  const boost = (s, demand, secs, label) => { s.boost = { demand, until: s.stats.play + secs, label }; };

  /* Each template: years it can appear, weight, make(s, d, items) -> offer params or null, and its choices.
     A choice's run(s, o) applies it and returns the message for the toast / sales log. */
  const T = [
    {
      id: 'bulk', from: 1993, to: 2100, w: 1.2, icon: '🏫',
      make(s, d, items) {
        const it = pcsInStock(items).sort((a, b) => b.stock - a.stock)[0];
        if (!it || it.stock < 5) return null;
        const unit = it.price * 0.9 * d.profit;
        // a few PCs early on; later about 20 s of the shop's takings, never more than 60% of the stock
        const units = Math.max(3, Math.min(Math.round(it.stock * 0.6), Math.round(income(s, 20) / unit)));
        const who = d.y < 2000 ? pick(['The school district', "A dentist's office", 'The local newspaper'])
          : d.y < 2015 ? pick(['The school district', 'A call centre', 'A start-up', 'The city council'])
          : pick(['A school academy trust', 'A start-up that just raised money', 'The council', 'An esports team']);
        return { key: it.key, name: it.name, units, unit, who };
      },
      title: (o) => o.who + ' wants ' + o.units + ' PCs',
      text: (o) => o.who + ' wants ' + o.units + '× ' + o.name + ' at ' + $(o.unit) + ' each (10% off), paid today. Good for your name around town.',
      choices: [
        { label: (o) => 'Sell ' + o.units + ' for ' + $(o.units * o.unit), run(s, o) {
          const it = byKey(s, o.key);
          const k = it ? Math.min(o.units, it.stock) : 0;
          if (!k) return { text: 'Too late: those PCs are gone.' };
          const rev = E.sellUnits(s, it, k, null, null, o.unit / it.price);
          s.rep = clampRep(s.rep + 0.1);
          return { text: '🏫 Sold ' + k + '× ' + it.name + ' to ' + o.who.replace(/^The /, 'the ').replace(/^A /, 'a ') + '.', rev };
        } },
        { label: () => 'Not at that price', run: () => ({ text: 'You passed on the bulk order.' }) },
      ],
    },
    {
      id: 'clearance', from: 1993, to: 2100, w: 1, icon: '📦',
      make(s, d, items) {
        const old = items.filter((i) => i.kind === 'pre' && i.buyable && i.age >= 1 && i.age < 4).sort((a, b) => b.rel - a.rel)[0];
        if (!old) return null;
        const units = Math.max(4, Math.round(d.cap * 0.12));
        const cost = old.cost * 0.6;
        if (s.cash < cost * units * 0.5) return null;
        return { key: old.key, name: old.name, units, cost };
      },
      title: () => 'A distributor is clearing stock',
      text: (o) => 'A container of ' + o.units + '× ' + o.name + ' (last year\'s model) at ' + $(o.cost) + ' each: 40% under list. Needs shelf space.',
      choices: [
        { label: (o) => 'Buy them for ' + $(o.units * o.cost), run(s, o) {
          const d = E.derive(s);
          const room = Math.max(0, Math.floor(d.cap - E.totalStock(s)));
          const k = Math.min(o.units, room, Math.floor(s.cash / o.cost));
          if (k < 1) return { text: 'No room (or cash) for the container.' };
          s.cash -= k * o.cost;
          s.stock[o.key] = (s.stock[o.key] || 0) + k;
          return { text: '📦 ' + k + '× ' + o.name + ' unloaded into the stock room.' };
        } },
        { label: () => 'Pass', run: () => ({ text: 'You let the container go.' }) },
      ],
    },
    {
      id: 'review', from: 1995, to: 2100, w: 0.7, icon: '📝',
      make(s, d, items) {
        const it = pcsInStock(items).sort((a, b) => b.rel - a.rel)[0];
        if (!it) return null;
        const where = d.y < 2005 ? pick(['PC Monthly', 'Byte-Size Magazine']) : d.y < 2015 ? pick(['a tech blog', 'GadgetWire']) : d.y < 2027 ? pick(['a big video channel', 'a streaming channel']) : 'a holo-review network';
        const odds = Math.max(0.2, Math.min(0.9, 0.25 + 0.55 * (it.rel - 0.6)));
        return { key: it.key, name: it.name, where, odds };
      },
      title: (o) => 'A reviewer from ' + o.where + ' wants a free PC',
      text: (o) => 'They want your best machine, a ' + o.name + ', for free. A rave review brings crowds; a bad one hurts. Your odds look ' + (o.odds > 0.65 ? 'good' : o.odds > 0.4 ? 'even' : 'poor') + '.',
      choices: [
        { label: () => 'Send one over', run(s, o) {
          const it = byKey(s, o.key);
          if (!it || it.stock < 1) return { text: 'You have none left to send.' };
          s.stock[o.key] -= 1;
          if (Math.random() < o.odds) {
            s.rep = clampRep(s.rep + 0.5);
            boost(s, 1.25, 120, 'Rave review');
            return { text: '🌟 A rave review from ' + o.where + '! Shoppers are flocking in.' };
          }
          s.rep = clampRep(s.rep - 0.3);
          return { text: '👎 The review from ' + o.where + ': "fine, I guess". Ouch.' };
        } },
        { label: () => 'No freebies', run: () => ({ text: 'You turned the reviewer away.' }) },
      ],
    },
    {
      id: 'ad', from: 1993, to: 2100, w: 0.8, icon: '📣',
      make(s, d) {
        const cost = Math.max(400 * E.infl(d.y), income(s, 6));
        const what = d.y < 2000 ? 'a full-page newspaper ad' : d.y < 2010 ? 'a banner on a busy portal' : d.y < 2027 ? 'a week of influencer posts' : 'a holo-billboard downtown';
        return { cost, what };
      },
      title: () => 'An ad deal',
      text: (o) => 'A sales rep offers ' + o.what + ' for ' + $(o.cost) + ': about +30% shoppers for the next two minutes.',
      choices: [
        { label: (o) => 'Run it for ' + $(o.cost), run(s, o) {
          if (s.cash < o.cost) return { text: 'Not enough cash for the ad.' };
          s.cash -= o.cost;
          boost(s, 1.3, 120, 'Ad campaign');
          return { text: '📣 The ad is running: +30% shoppers.' };
        } },
        { label: () => 'No thanks', run: () => ({ text: 'You skipped the ad.' }) },
      ],
    },
    {
      id: 'y2k', from: 1999.0, to: 1999.95, w: 4, icon: '🐛',
      make(s) { return { cost: Math.max(1500, income(s, 4)) }; },
      title: () => 'A Y2K consultant drops by',
      text: (o) => 'For ' + $(o.cost) + ' he will certify your shop "Y2K Compliant" with a very official sticker. Customers are nervous.',
      choices: [
        { label: (o) => 'Buy the sticker (' + $(o.cost) + ')', run(s, o) {
          if (s.cash < o.cost) return { text: 'Not enough cash.' };
          s.cash -= o.cost;
          s.rep = clampRep(s.rep + 0.4);
          return { text: '🐛 Certified Y2K Compliant. Customers relax.' };
        } },
        { label: () => 'It\'s a scam', run: () => ({ text: 'You showed the consultant the door.' }) },
      ],
    },
    {
      id: 'miner', from: 2017, to: 2022.5, w: 1.2, icon: '⛏️',
      make(s, d, items) {
        const it = pcsInStock(items).sort((a, b) => b.rel - a.rel)[0];
        if (!it || it.stock < 4) return null;
        const unit = it.price * 1.3 * d.profit;
        const units = Math.max(3, Math.min(Math.round(it.stock * 0.7), Math.round(income(s, 20) / unit)));
        return { key: it.key, name: it.name, units, unit };
      },
      title: () => 'A crypto miner wants your best PCs',
      text: (o) => 'They will take ' + o.units + '× ' + o.name + ' at ' + $(o.unit) + ' each (30% over list). Your gamer customers will not be happy.',
      choices: [
        { label: (o) => 'Sell for ' + $(o.units * o.unit), run(s, o) {
          const it = byKey(s, o.key);
          const k = it ? Math.min(o.units, it.stock) : 0;
          if (!k) return { text: 'Too late: those PCs are gone.' };
          const rev = E.sellUnits(s, it, k, null, null, o.unit / it.price);
          s.rep = clampRep(s.rep - 0.3);
          return { text: '⛏️ ' + k + ' rigs gone to the mine. Gamers grumble online.', rev };
        } },
        { label: () => 'Keep them for gamers', run(s) { s.rep = clampRep(s.rep + 0.1); return { text: 'You kept the PCs for gamers. They noticed.' }; } },
      ],
    },
  ];
  const BY_ID = {};
  T.forEach((t) => (BY_ID[t.id] = t));

  /** Called from step(): expire an ignored offer, or (in live play only) maybe start a new one. */
  function tick(s, d, items, calRate) {
    const now = s.stats.play;
    if (s.offer && now > s.offer.until) { s.offer = null; s.stats.offersMissed = (s.stats.offersMissed || 0) + 1; }
    if (s.boost && now > s.boost.until) s.boost = null;
    if (s.offer || calRate < 1 || s.stats.sold < 10) return;
    if (s.offerAt == null) { s.offerAt = now + GAP[0]; return; }
    if (now < s.offerAt) return;
    s.offerAt = now + GAP[0] + Math.random() * (GAP[1] - GAP[0]);
    const pool = T.filter((t) => d.y >= t.from && d.y < t.to);
    let total = pool.reduce((a, t) => a + t.w, 0);
    for (let tries = 0; tries < 4 && pool.length; tries++) {
      let r = Math.random() * total, t = pool[0];
      for (const x of pool) { if ((r -= x.w) < 0) { t = x; break; } }
      const o = t.make(s, d, items);
      if (o) { s.offer = Object.assign({ id: t.id, at: now, until: now + WAIT }, o); return; }
    }
  }

  /** The open offer as the UI shows it, or null. */
  function view(s) {
    const o = s.offer;
    const t = o && BY_ID[o.id];
    if (!t) return null;
    return { id: o.id, at: o.at, icon: t.icon, title: t.title(o), text: t.text(o), left: Math.max(0, o.until - s.stats.play), choices: t.choices.map((c) => c.label(o)) };
  }
  /** The active boost from an offer (ad, review), or null. */
  const activeBoost = (s) => (s.boost && s.stats.play <= s.boost.until ? { label: s.boost.label, demand: s.boost.demand, left: s.boost.until - s.stats.play } : null);

  /** Take choice `i` of the open offer. Returns { text, rev? } for a toast / the sales log, or null. */
  function resolve(s, i) {
    const o = s.offer;
    const t = o && BY_ID[o.id];
    if (!t || !t.choices[i]) return null;
    s.offer = null;
    if (i === 0) s.stats.offersTaken = (s.stats.offersTaken || 0) + 1;
    return t.choices[i].run(s, o);
  }

  CS.OFFERS = T;
  CS.Offers = { tick, view, resolve, activeBoost, WAIT };
  if (typeof module !== 'undefined') module.exports = CS;
})(typeof window !== 'undefined' ? window : globalThis);
