/* UI, persistence and the main loop. */
(function () {
  const CS = window.CS, E = CS.E, C = CS.C;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));

  /* ---------- formatting ---------- */
  const SUF = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc'];
  function num(n) {
    if (!isFinite(n)) return '∞';
    const a = Math.abs(n);
    if (a < 1000) return a < 10 && n % 1 ? n.toFixed(2) : a < 100 && n % 1 ? n.toFixed(1) : Math.round(n).toString();
    let i = Math.min(SUF.length - 1, Math.floor(Math.log10(a) / 3));
    let v = n / Math.pow(10, i * 3);
    let s = v.toFixed(Math.abs(v) < 10 ? 2 : Math.abs(v) < 100 ? 1 : 0);
    if (Math.abs(parseFloat(s)) >= 1000 && i < SUF.length - 1) { i++; v = n / Math.pow(10, i * 3); s = v.toFixed(2); } // 999.9K -> 1.00M
    return s + SUF[i];
  }
  const money = (n) => (n < 0 ? '-$' : '$') + num(Math.abs(n) < 1000 ? Math.round(Math.abs(n)) : Math.abs(n));
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function dur(sec) {
    sec = Math.round(sec);
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    if (h) return h + 'h ' + m + 'm';
    if (m) return m + 'm ' + (sec % 60) + 's';
    return sec + 's';
  }
  function setText(el, t) {
    if (el._t !== t) { el.textContent = t; el._t = t; }
  }
  function setHtml(el, h) {
    if (el._h !== h) { el.innerHTML = h; el._h = h; }
  }
  function setDis(el, v) {
    v = !!v;
    if (el._d !== v) { el.disabled = v; el._d = v; }
  }

  /* ---------- persistence ----------
     The account's server save is the source of truth (see api/save.php). localStorage keeps a
     per-user backup so a dropped connection or crash never loses progress. */
  const BOOT = window.CSIG;
  const settings = BOOT.settings; // {theme, showTicker, showWalkers}, stored in user_settings
  const LOCAL_KEY = C.SAVE_KEY + '-u' + BOOT.user.id;
  let S, hiddenAt = 0, noSave = false, rev = BOOT.rev || 0, saving = false, conflict = false, forceNext = false;
  let sync = { state: 'ok', at: Date.now() };
  const api = (name) => BOOT.base + '/api/' + name + '.php';
  const TAB = (() => { // survives reloads of this tab, differs between tabs
    try {
      let v = sessionStorage.getItem('csig-tab');
      if (!v) { v = Math.random().toString(36).slice(2, 12) + Date.now().toString(36); sessionStorage.setItem('csig-tab', v); }
      return v;
    } catch (e) { return Math.random().toString(36).slice(2, 12); }
  })();
  function post(name, body) {
    return fetch(api(name), {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': BOOT.csrf },
      body: JSON.stringify(Object.assign({ tab: TAB }, body)),
    }).then((r) => r.json().catch(() => ({ ok: false, error: 'bad_response' })).then((j) => { j.status = r.status; return j; }));
  }
  function readLocal() {
    try {
      const str = localStorage.getItem(LOCAL_KEY);
      return str ? E.deserialize(str) : null;
    } catch (e) { return null; }
  }
  function legacyLocal() { // saves from before accounts existed
    try {
      const str = localStorage.getItem(C.SAVE_KEY);
      return str ? E.deserialize(str) : null;
    } catch (e) { return null; }
  }
  function clearLocal(legacyToo) {
    try {
      localStorage.removeItem(LOCAL_KEY);
      if (legacyToo) { localStorage.removeItem(C.SAVE_KEY); localStorage.removeItem(C.SAVE_KEY + '-bak'); }
    } catch (e) { /* ignore */ }
  }
  function save(force) {
    if (noSave || !S || conflict) return Promise.resolve();
    S.saved = Date.now();
    const str = E.serialize(S);
    try { localStorage.setItem(LOCAL_KEY, str); } catch (e) { /* storage blocked */ }
    if (saving) return Promise.resolve();
    saving = true;
    return post('save', { state: str, rev, force: force === true || forceNext })
      .then((j) => {
        if (j.ok) { rev = j.rev; forceNext = false; sync = { state: 'ok', at: Date.now() }; clearLocal(true); try { localStorage.setItem(LOCAL_KEY, str); } catch (e) { /* ignore */ } }
        else if (j.status === 409) onConflict();
        else if (j.status === 401 || j.status === 403) onSessionLost();
        else sync.state = 'error';
      })
      .catch(() => { sync.state = 'error'; })
      .then(() => { saving = false; });
  }
  function beaconSave() { // last-gasp save while the page is closing
    if (noSave || !S || conflict || saving) return;
    // A tab closed after a while in the background: the save made when it was hidden already holds this state, and
    // re-saving it now would stamp a new server time and drop the hidden time from the next offline catch-up.
    if (hiddenAt && Date.now() - hiddenAt > 10000) return;
    S.saved = Date.now();
    const str = E.serialize(S);
    try { localStorage.setItem(LOCAL_KEY, str); } catch (e) { /* ignore */ }
    try { navigator.sendBeacon(api('save'), new Blob([JSON.stringify({ state: str, rev, csrf: BOOT.csrf, tab: TAB })], { type: 'text/plain' })); } catch (e) { /* ignore */ }
  }
  function onConflict() {
    conflict = true;
    modal('Shop open somewhere else', '<p>This shop was saved from another tab or device since you loaded it. Reload to continue from the latest save, or overwrite it with the progress in this tab.</p>', [
      { label: 'Reload latest', cls: 'primary', fn: () => { noSave = true; location.reload(); return false; } },
      { label: 'Overwrite with this tab', fn: () => { conflict = false; save(true); } },
    ]);
  }
  let sessionWarned = false;
  function onSessionLost() {
    sync.state = 'error';
    if (sessionWarned) return;
    sessionWarned = true;
    modal('You were logged out', '<p>Your login expired, so progress is only being kept on this device. Log in again in a new tab — this tab will keep playing, and newer progress is offered back when you reload.</p>', [
      { label: 'Log in', cls: 'primary', fn: () => { window.open(BOOT.base + '/login.php', '_blank'); } },
      { label: 'Close' },
    ]);
  }
  function flushSave() { // wait out any in-flight save, then save
    return new Promise((resolve) => {
      const attempt = () => { if (saving) setTimeout(attempt, 100); else save().then(resolve); };
      attempt();
    });
  }
  function saveSettings(patch) {
    Object.assign(settings, patch);
    post('settings', patch).then((j) => { if (!j.ok && (j.status === 401 || j.status === 403)) onSessionLost(); }).catch(() => {});
  }
  const encode = (str) => btoa(unescape(encodeURIComponent(str)));
  function decode(txt) {
    txt = txt.trim();
    if (txt[0] === '{') return txt;
    return decodeURIComponent(escape(atob(txt)));
  }

  /* ---------- toasts & modal ---------- */
  function toast(html, ms) {
    const box = $('#toasts');
    while (box.children.length > 3) box.firstChild.remove();
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = html;
    box.appendChild(t);
    setTimeout(() => t.classList.add('out'), ms || 3500);
    setTimeout(() => t.remove(), (ms || 3500) + 450);
  }
  function modal(title, bodyHtml, buttons) {
    const m = $('#modal');
    m.innerHTML = '<div class="panel"><div class="title">' + esc(title) + '</div><div class="pbody">' + bodyHtml + '</div><div class="btns"></div></div>';
    const bx = $('.btns', m);
    (buttons || [{ label: 'OK' }]).forEach((b) => {
      const btn = document.createElement('button');
      btn.textContent = b.label;
      if (b.cls) btn.className = b.cls;
      btn.onclick = () => {
        if (!b.fn || b.fn(m) !== false) closeModal();
      };
      bx.appendChild(btn);
    });
    m.hidden = false;
    return m;
  }
  function closeModal() {
    $('#modal').hidden = true;
    $('#modal').innerHTML = '';
  }

  /* ---------- keyed list helper ---------- */
  function syncList(box, entries, keyOf, create, update) {
    const map = box._map || (box._map = new Map());
    const seen = new Set();
    let order = '';
    entries.forEach((e) => {
      const k = keyOf(e);
      seen.add(k);
      let n = map.get(k);
      if (!n) { n = create(e); map.set(k, n); }
      update(n, e);
      order += k + '|';
    });
    for (const [k, n] of map) if (!seen.has(k)) { n.el.remove(); map.delete(k); }
    if (box._order !== order) {
      entries.forEach((e) => box.appendChild(map.get(keyOf(e)).el));
      box._order = order;
    }
  }
  function node(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstChild;
  }

  /* ---------- tabs ---------- */
  let tab = 'shop';
  let newStock = false, newUp = false, newHQ = false;
  function switchTab(name) {
    tab = name;
    $$('.tab').forEach((t) => (t.hidden = t.id !== 'tab-' + name));
    $$('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.tab === name));
    if (name === 'catalog') newStock = false;
    if (name === 'upgrades') newUp = false;
    if (name === 'franchise') newHQ = false;
    render(true);
    window.scrollTo(0, 0);
  }

  /* ---------- SHOP tab ---------- */
  const logLines = [];
  let logDirty = true;
  function logSale(text, amt) {
    logLines.unshift({ text, amt });
    if (logLines.length > 7) logLines.pop();
    logDirty = true;
  }
  let shopRefs;
  function buildShop() {
    $('#tab-shop').innerHTML = `
      <div class="panel"><div class="title"><span>Storefront</span><span id="stockInfo" class="num"></span></div>
        <div class="scene"><div class="sign" id="sign"></div><div class="street" id="street"></div><div class="shopfront" id="shelf"></div></div></div>
      <button id="hustle" class="primary" data-act="hustle"><span id="hustleTxt">🤝 Hustle a customer</span><span class="hbar" id="hbar"></span></button>
      <div id="alerts" class="list"></div>
      <div class="panel" id="advisor"><div class="title"><span>💡 Advisor</span><button class="small" data-act="advtoggle" id="advToggle" aria-label="Show or hide the advisor">▾</button></div>
        <div class="pbody" id="advBody">
          <div class="advsec"><b class="advh">Suggested next steps</b><div class="list" id="advRecs"></div><small id="advNoRec"></small></div>
          <div class="advsec"><b class="advh">Good to know</b><ul id="advIns"></ul><small id="advMore"></small></div>
          <small class="advnote">Estimates from your recent sales. Payback = how long an upgrade takes to earn back its cost.</small>
        </div></div>
      <div class="panel"><div class="title"><span>⭐ Reputation</span><span id="repStars" class="num"></span></div><div class="pbody" id="repBody"></div></div>
      <div class="panel"><div class="title">Shop Report</div><div class="pbody"><div class="grid" id="statGrid"></div></div></div>
      <div class="panel" id="svcPanel" hidden><div class="title"><span>🛎️ Service Desk</span><span id="svcRate" class="num"></span></div><div class="pbody" id="svcBody"></div></div>
      <div class="panel"><div class="title">Recent Sales</div><div class="pbody"><ul id="log"></ul></div></div>
      <div class="panel"><div class="title">The Times</div><div class="pbody" id="times"></div></div>`;
    const defs = [
      ['cust', 'Customers / min'], ['serve', 'Checkout capacity / min'], ['sell', 'Revenue / min'],
      ['rest', 'Auto-restock / min'], ['up', 'Wages & rent / min'], ['lost', 'Walk-outs (busy)'],
      ['sold', 'Computers sold'], ['built', 'Computers built'], ['games', 'Games sold'], ['acc', 'Accessories sold'], ['cons', 'Consoles sold'], ['cgm', 'Console games sold'],
    ];
    const grid = $('#statGrid');
    shopRefs = { cells: {} };
    defs.forEach(([id, label]) => {
      const m = node(`<div class="mini"><small>${label}</small><b class="num">–</b></div>`);
      grid.appendChild(m);
      shopRefs.cells[id] = $('b', m);
    });
  }
  /** Reputation panel: the stars, where they are heading, and what each factor costs. */
  function renderReputation(d) {
    const v = E.reputationView(S, d);
    setText($('#repStars'), v.label + ' ' + v.stars.toFixed(1));
    const dir = v.target > v.stars + 0.05 ? '↗ rising to ' + v.target.toFixed(1) : v.target < v.stars - 0.05 ? '↘ falling to ' + v.target.toFixed(1) : 'steady';
    setHtml($('#repBody'), `<div>${dir} · ${v.effect >= 0 ? '+' : ''}${Math.round(v.effect * 100)}% shoppers</div>`
      + v.factors.map((f) => `<div class="repf"><small>${esc(f.label)}</small><span class="repbar"><i style="width:${Math.round(f.score * 100)}%"></i></span><small class="num">${f.cost >= 0.05 ? '−' + f.cost.toFixed(1) + '★' : '✓'}</small></div>`).join('')
      + (v.worst ? `<small class="warn">${esc(v.worst.tip)}</small>` : ''));
  }
  /** Service Desk panel: a teaser with an Open button, then jobs, capacity, the era's service menu and warranties. */
  function renderService(d) {
    const v = E.serviceView(S, d);
    $('#svcPanel').hidden = !v.available;
    if (!v.available) return;
    setText($('#svcRate'), v.open ? money(v.income) + '/min' : '');
    if (!v.open) {
      setHtml($('#svcBody'), `<div>Fix customers' computers and sell extended warranties: steady money that takes no shelf space.</div>
        <button class="primary" data-act="up" data-id="svc_desk" ${S.cash < v.openCost ? 'disabled' : ''}>Open the Service Desk for ${money(v.openCost)}</button>`);
      return;
    }
    const mini = (l, x) => `<div class="mini"><small>${l}</small><b class="num">${x}</b></div>`;
    setHtml($('#svcBody'), `<div class="grid">${mini('Repair jobs / min', num(v.jobs))}${mini('Walk-ins / min', num(v.walkIns))}${mini('Capacity / min', num(v.capacity))}${mini('PC buyers taking a warranty', Math.round(v.warrantyShare * 100) + '%')}${mini('Repairs done', num(v.repairs))}${mini('Repair income', money(v.repairRevenue))}${mini('Warranties sold', num(v.warranties))}${mini('Warranty income', money(v.warrantyRevenue))}${mini('Claims paid', money(v.claimsPaid))}${mini('Claims still to come', money(v.claimsDue))}</div>`
      + (v.busy ? `<div class="warn">🚪 Turning away ${num(v.turnedAway)} jobs a minute. Hire technicians in Upgrades → Service.</div>` : '')
      + `<small>On the menu: ${v.menu.map((x) => x.icon + ' ' + esc(x.name) + ' ' + money(x.price)).join(' · ')}</small>`);
  }
  function spawnWalker(buy) {
    const st = $('#street');
    if (!st || tab !== 'shop' || !settings.showWalkers || st.children.length > 6) return;
    const w = document.createElement('span');
    w.className = 'walker' + (buy ? ' buy' : '');
    w.textContent = ['🧑', '👩', '👨', '🧓', '👧', '🧑‍🎓', '🧑‍💼'][Math.floor(Math.random() * 7)];
    w.style.animationDuration = 2.8 + Math.random() * 1.6 + 's';
    w.addEventListener('animationend', (e) => { if (e.animationName === 'walk') w.remove(); });
    st.appendChild(w);
  }
  function floatText(parent, text, x) {
    const f = document.createElement('span');
    f.className = 'float';
    f.textContent = text;
    f.style.left = (x == null ? 40 + Math.random() * 20 : x) + '%';
    f.style.top = '10px';
    parent.appendChild(f);
    setTimeout(() => f.remove(), 1300);
  }

  /* ---------- advisor box ---------- */
  let advCache = { at: 0, data: null };
  const advOpen = () => { try { return localStorage.getItem('csig-adv') !== '0'; } catch (e) { return true; } };
  function createRecCard(r) {
    const el = node(`<div class="card rec"><div class="icon rci"></div><div class="info"><b class="rnm"></b><small class="rwhy"></small><div class="tags"><span class="tag rpb"></span><span class="tag rlv"></span></div></div><div class="acts"><button class="primary grow rbuy"></button></div></div>`);
    return { el, ic: $('.rci', el), nm: $('.rnm', el), why: $('.rwhy', el), pb: $('.rpb', el), lv: $('.rlv', el), buy: $('.rbuy', el) };
  }
  function renderAdvisor(d, items) {
    const open = advOpen();
    $('#advBody').hidden = !open;
    setText($('#advToggle'), open ? '▾' : '▸');
    if (!open) return;
    const now = performance.now();
    if (!advCache.data || now - advCache.at > 2000) { advCache = { at: now, data: CS.Advisor.analyze(S, d, items) }; }
    const a = advCache.data, fm = CS.Advisor.fmt;
    const recs = a.recs.concat(a.tokenRec ? [a.tokenRec] : []);
    syncList($('#advRecs'), recs, (r) => r.kind + r.id, createRecCard, (n, r) => {
      const tok = r.kind === 'tup';
      setText(n.ic, r.icon);
      setText(n.nm, r.name);
      setText(n.why, r.why);
      setText(n.pb, tok ? 'Permanent' : 'Pays back in ~' + fm.dur(r.payback));
      setText(n.lv, r.max > 1 ? 'Lv ' + r.lvl + ' → ' + (r.lvl + 1) : 'One-off');
      n.buy.dataset.act = tok ? 'tup' : 'up';
      n.buy.dataset.id = r.id;
      const cur = r.afford ? (tok ? 'Buy — ' + num(r.cost) + ' 🎫' : 'Buy — ' + money(r.cost)) : 'Save up — ' + money(r.cost) + (isFinite(r.eta) ? ' (about ' + fm.dur(r.eta) + ')' : '');
      setText(n.buy, cur);
      setDis(n.buy, !r.afford);
    });
    setText($('#advNoRec'), recs.length ? '' : 'No upgrade stands out right now. Keep the shelves stocked and the sales will tell us more.');
    setHtml($('#advIns'), a.insights.map((i) => `<li class="adv-${i.lv}"><span>${i.icon}</span><span>${esc(i.text)}</span></li>`).join('') || '<li><small>Nothing to report yet.</small></li>');
    setText($('#advMore'), a.more ? '+' + a.more + ' lower-priority notes hidden' : '');
  }

  function renderShop(d, items) {
    const total = E.totalStock(S);
    setText($('#stockInfo'), 'Shelves ' + total + '/' + d.cap);
    setText($('#sign'), S.name);
    // shelf icons
    let icons = '', n = 0;
    items.forEach((it) => {
      for (let i = 0; i < Math.min(it.stock, 10) && n < 44; i++, n++) icons += it.icon;
    });
    if (total > n) icons += ' <small style="color:#fff">+' + (total - n) + '</small>';
    setHtml($('#shelf'), icons || '<span class="empty">The shelves are empty…</span>');

    // hustle
    const hb = $('#hustle');
    const streak = E.hustleStreak(S);
    setText($('#hustleTxt'), (S.hustleCd > 0 ? '🤝 Hustling… ' + Math.ceil(S.hustleCd) + 's' : '🤝 Hustle a customer') + (streak > 1 ? '  🔥' + streak : ''));
    $('#hbar').style.width = (S.hustleCd > 0 ? 100 * (1 - S.hustleCd / E.HUSTLE_CD) : 0) + '%';
    setDis(hb, S.hustleCd > 0);

    // alerts
    const al = [];
    const active = items.filter((i) => i.stock > 0).length;
    if (S.stats.sold === 0 && total === 0) al.push(['warn', '👋 Welcome! Open the <b>Stock</b> tab, buy a computer, then hit <b>Hustle</b> to sell it. Set an <b>auto-restock</b> target once you hire a Stock Clerk (Upgrades).']);
    else if (!active) al.push(['bad', '🚫 Shelves are empty — customers are walking out! Restock in the Stock tab.']);
    else if (d.lambda > d.serve * 1.05 && !advOpen()) al.push(['warn', '⏳ Customers are waiting in line (' + d.lambda.toFixed(2) + '/s arriving vs ' + d.serve.toFixed(2) + '/s served). Upgrade checkout or hire sales staff.']);
    if (d.y >= 1995 && !d.office && S.stats.sold >= 60 && (S.up.clerk || 0) > 0) al.push(['warn', '👔 Tip: a <b>Purchasing Office</b> (Upgrades → Shop) lets you hire buyers who manage your stock levels for you.']);
    if (S.stats.sold >= 15 && !d.aisleAcc) al.push(['warn', '🖱️ Tip: open the <b>Accessories Wall</b> (Upgrades → Shop). Keyboards, monitors and modems carry fat margins, and PC buyers add them on.']);
    else if (S.stats.sold >= 60 && !d.aisleGame) al.push(['warn', '💿 Tip: open the <b>Software Aisle</b> (Upgrades → Shop) to sell PC games.']);
    if (total >= d.cap && !advOpen()) al.push(['warn', '📦 Shelves are full. Expand the shop floor to stock more.']);
    if (!(S.up.clerk > 0) && S.stats.sold > 0 && S.stats.sold < 40) al.push(['warn', '💡 Tip: a <b>Stock Clerk</b> restocks automatically — even while you are away.']);
    if (d.upkeep * 60 > 0 && S.rate.rev < d.upkeep * 0.9 && S.stats.sold > 5) al.push(['bad', '💸 Wages & rent are exceeding your sales.']);
    setHtml($('#alerts'), al.map((a) => `<div class="alert ${a[0]}">${a[1]}</div>`).join(''));

    // stats
    const c = shopRefs.cells;
    setText(c.cust, num(d.lambda * 60));
    setText(c.serve, num(d.serve * 60));
    setText(c.sell, money(S.rate.rev * 60));
    setText(c.rest, d.restock ? num(d.restock * 60) : 'none');
    setText(c.up, money(d.upkeep * 60));
    setText(c.lost, num(S.stats.lost));
    setText(c.sold, num(S.stats.sold));
    setText(c.built, num(S.stats.built));
    setText(c.games, num(S.stats.soldGames));
    setText(c.acc, num(S.stats.soldAcc));
    setText(c.cons, num(S.stats.soldConsoles || 0));
    setText(c.cgm, num((S.stats.soldCGames || 0) + (S.stats.soldCAcc || 0)));
    renderService(d);
    renderReputation(d);

    renderAdvisor(d, items);

    if (logDirty) {
      setHtml($('#log'), logLines.length ? logLines.map((l) => `<li><span>${esc(l.text)}</span><b class="good num">${l.amt ? '+' + money(l.amt) : ''}</b></li>`).join('') : '<li><small>No sales yet.</small></li>');
      logDirty = false;
    }
    const era = E.eraAt(d.y);
    let t = `<div><b>${esc(era.name)}</b> <small>(${era.from}+)</small></div><div>${esc(era.blurb)}</div>`;
    d.ev.list.forEach((e) => (t += `<div class="warn">📣 <b>${esc(e.name)}</b> — ${esc(e.text)}</div>`));
    if (S.cal >= C.END_CAL) t += '<div class="good">🏁 You reached <b>October 2035</b>, the end of the roadmap! The calendar stops here — keep growing your empire, or open a new franchise.</div>';
    setHtml($('#times'), t);
  }

  /* ---------- STOCK tab ---------- */
  /* ---------- list filters (remembered per browser) ---------- */
  const FILT_KEY = 'csig-filters';
  const FILT = { cat: { age: 'all', shelf: 'all', sort: 'new', group: 'all', q: '', ctype: 'all', plat: 'all' }, bp: { f: 'all', sort: 'new' }, up: { f: 'all' }, hq: { f: 'all' }, tro: { f: 'all' } };
  try { const o = JSON.parse(localStorage.getItem(FILT_KEY) || '{}'); Object.keys(FILT).forEach((k) => Object.assign(FILT[k], o[k] || {})); } catch (e) { /* defaults */ }
  const fget = (path) => { const [a, b] = path.split('.'); return FILT[a][b]; };
  function fset(path, v) {
    const [a, b] = path.split('.');
    FILT[a][b] = v;
    try { localStorage.setItem(FILT_KEY, JSON.stringify(FILT)); } catch (e) { /* ignore */ }
  }
  const chipRow = (path, opts) => '<div class="chips fchips">' + opts.map(([v, l]) => `<button data-act="fchip" data-flt="${path}" data-v="${v}">${l}</button>`).join('') + '</div>';
  const selectEl = (path, opts, label) => `<label class="fsel"><small>${label}</small><select data-flt="${path}">${opts.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>`;
  function syncFilterUI(root) { // reflect state in chips / selects / search boxes without fighting the user's focus
    $$('[data-act=fchip]', root).forEach((b) => b.classList.toggle('on', fget(b.dataset.flt) === b.dataset.v));
    $$('select[data-flt], input[data-flt]', root).forEach((el) => {
      if (document.activeElement !== el && el.value !== fget(el.dataset.flt)) el.value = fget(el.dataset.flt);
    });
  }
  const isCurrent = (it) => it.buyable && (it.kind === 'game' || it.kind === 'cgame' ? it.age <= 1.5 : it.kind === 'acc' || it.kind === 'cacc' ? it.age <= 4 : it.kind === 'console' ? it.age <= 3 : it.age <= 2);
  const CAT_SORTS = {
    new: (a, b) => a.age - b.age || a.price - b.price,
    pop: (a, b) => (popNorm[b.key] || 0) - (popNorm[a.key] || 0),
    profit: (a, b) => (b.price - b.cost) - (a.price - a.cost),
    margin: (a, b) => (b.price - b.cost) / b.price - (a.price - a.cost) / a.price,
    cheap: (a, b) => a.price - b.price,
    pricey: (a, b) => b.price - a.price,
    stock: (a, b) => b.stock - a.stock,
    name: (a, b) => (a.brand + a.name).localeCompare(b.brand + b.name),
  };

  let catFilter = 'pre';
  function buildCatalog() {
    $('#tab-catalog').innerHTML = `
      <div class="panel"><div class="title"><span>Stock Room</span><span id="catCap" class="num"></span></div>
        <div class="pbody">
          <div class="chips" id="catChips"><button data-act="catfilter" data-f="pre" class="on">🖥️ Computers</button><button data-act="catfilter" data-f="game">💿 Games</button><button data-act="catfilter" data-f="acc">🖱️ Accessories</button><button data-act="catfilter" data-f="con">🎮 Consoles</button></div>
          <div class="bar"><i id="catBar"></i></div>
          <div class="ftools">
            <div class="frow"><small>Age</small>${chipRow('cat.age', [['all', 'All'], ['current', 'Current'], ['old', 'Older']])}</div>
            <div class="frow"><small>Shelf</small>${chipRow('cat.shelf', [['all', 'All'], ['stocked', 'In stock'], ['empty', 'Not stocked']])}</div>
            <div class="frow">${selectEl('cat.sort', [['new', 'Newest first'], ['pop', 'Most popular'], ['profit', 'Profit per sale'], ['margin', 'Margin %'], ['cheap', 'Price: low to high'], ['pricey', 'Price: high to low'], ['stock', 'Most in stock'], ['name', 'Name A–Z']], 'Sort')}
              <label class="fsel" id="grpSel"><small>Group</small><select data-flt="cat.group" id="grpSelect"></select></label></div>
            <div class="frow" id="conSel" hidden>
              <label class="fsel"><small>Show</small><select data-flt="cat.ctype"><option value="all">Everything</option><option value="console">Consoles</option><option value="cgame">Console games</option><option value="cacc">Console accessories</option></select></label>
              <label class="fsel"><small>Platform</small><select data-flt="cat.plat" id="platSelect"></select></label></div>
            <input type="text" data-flt="cat.q" placeholder="Search name or brand…" id="catSearch" autocomplete="off">
          </div>
          <div class="field"><label><span>Pricing policy (all retail items)</span><b id="priceLbl"></b></label>
            <input type="range" id="priceAdj" min="-20" max="30" step="5"></div>
          <small id="clerkNote"></small>
        </div></div>
      <div id="catNotice"></div>
      <div class="panel" id="conMarket" hidden><div class="title">Console market</div><div class="pbody" id="conMarketBody"></div></div>
      <div class="empty-note" id="catEmpty" hidden>Nothing matches these filters.</div>
      <div class="list two" id="catList"></div>`;
    $('#priceAdj').addEventListener('input', (e) => { S.priceAdj = +e.target.value / 100; });
  }
  function ageTag(it) {
    if (!it.buyable) return 'Clearance';
    if (it.age < 0.7) return 'New!';
    if (it.kind === 'game' || it.kind === 'cgame') return it.age > 1.5 ? 'Bargain bin' : 'Current';
    if (it.kind === 'acc' || it.kind === 'cacc') return it.age > 4 ? 'Older model' : 'Current';
    if (it.kind === 'console') return it.limited ? 'Launch' : it.age > 3 ? 'Older model' : 'Current';
    if (it.age > 4) return 'Old stock';
    if (it.age > 2) return 'Aging';
    return 'Current';
  }
  function createItemCard(it) {
    const el = node(`<div class="card" data-key="${it.key}">
      <div class="icon">${it.icon}</div>
      <div class="info"><b class="nm"></b><small class="sub"></small>
        <div class="tags"><span class="tag t-age"></span><span class="tag t-perf"></span><span class="tag t-extra" hidden></span><span class="tag t-pop"></span></div>
        <div class="nums"><span>Price <b class="pp num"></b></span><span>Cost <b class="cc num"></b></span><span>Profit <b class="pf num good"></b></span></div>
        <div>In stock: <b class="stk num"></b></div></div>
      <div class="acts">
        <button data-act="buy" data-n="1">Buy 1</button><button data-act="buy" data-n="5">+5</button><button data-act="buy" data-n="max">Max</button>
        <div class="stepper"><span class="lbl">Auto-restock to</span>
          <button data-act="tgt" data-d="-1">−</button><b class="tg num">0</b><button data-act="tgt" data-d="1">+</button></div>
        <div class="mgrow" hidden><span class="mginfo"></span><button class="small" data-act="mgpin"></button><button class="small" data-act="mgskip"></button></div>
      </div></div>`);
    const r = (s) => $(s, el);
    const refs = { stepper: r('.stepper'), mgrow: r('.mgrow'), mginfo: r('.mginfo'), mgpin: r('[data-act=mgpin]'), mgskip: r('[data-act=mgskip]'), el, nm: r('.nm'), sub: r('.sub'), age: r('.t-age'), perf: r('.t-perf'), extra: r('.t-extra'), pop: r('.t-pop'), pp: r('.pp'), cc: r('.cc'), pf: r('.pf'), stk: r('.stk'), tg: r('.tg'), lbl: r('.lbl'), btns: $$('button', el), buy2: $('[data-act=buy][data-n="5"]', el) };
    return refs;
  }
  // show who sets this item's stock level when a purchasing manager is on duty
  function updateMgrRow(n, it) {
    n.mgrow.hidden = !it.mgrCat;
    if (!it.mgrCat) { n.stepper.hidden = false; return; }
    n.stepper.hidden = !!it.managed;
    setText(n.mginfo, it.managed ? '👔 Manager sets the target: ' + it.target : it.pin === 'skip' ? '🚫 Manager skips this' : '📌 You set this one');
    setText(n.mgpin, it.pin === 'pin' ? 'Hand to manager' : 'Set it myself');
    setText(n.mgskip, it.pin === 'skip' ? 'Allow again' : 'Never stock');
  }
  let popNorm = {};
  function updateItemCard(n, it, d, clerk) {
    setText(n.nm, (it.brand ? it.brand + ' ' : '') + it.name);
    const addon = E.isAddon(it.kind);
    const con = it.kind === 'console' || it.kind === 'cgame' || it.kind === 'cacc';
    setText(n.sub, it.kind === 'console' ? it.brand + ' · ' + it.def.year : it.kind === 'cgame' ? 'Game · ' + it.def.year : it.kind === 'cacc' ? CS.GROUP_BY_ID[it.group].name + ' · ' + it.def.year : addon ? (it.kind === 'acc' ? CS.GROUP_BY_ID[it.group].name + ' · ' : 'PC game · ') + it.def.year : it.def.year + ' model');
    setText(n.age, ageTag(it));
    n.age.classList.toggle('new', it.age < 0.7 && it.buyable);
    setText(n.perf, (it.kind === 'console' ? 'Appeal ' : addon ? 'Hype ' : 'Performance ') + Math.round(it.rel * 100) + '%');
    setText(n.pop, '🔥 Demand ' + Math.round(((popNorm[it.key] || 0) * 100)) + '%');
    n.extra.hidden = !(it.kind === 'game' || con);
    if (it.kind === 'game') setText(n.extra, it.capF >= 0.95 ? '✅ Runs on your PCs' : it.capF >= 0.5 ? '⚠️ Marginal on your PCs' : '🚫 Too demanding for your PCs');
    else if (it.kind === 'console') setText(n.extra, it.limited ? '🔥 Launch frenzy · max ' + it.allocCap + ' per order window' : it.hype > 0.3 ? '🔥 Still hot' : (CS.PLAT_BY_ID[it.plat].hand ? '🕹️ Handheld' : '🎮 Home console'));
    else if (con) setText(n.extra, '👥 ' + Math.round((it.owners || 0) * 100) + '% of shoppers own ' + CS.PLAT_BY_ID[it.plat].name);
    if (addon && n.buy2.dataset.n !== String(it.pack)) { n.buy2.dataset.n = String(it.pack); setText(n.buy2, '+' + it.pack); }
    setText(n.pp, money(it.price));
    setText(n.cc, money(it.cost));
    setText(n.pf, money(it.price - it.cost) + ' (' + Math.round(((it.price - it.cost) / it.price) * 100) + '%)');
    setText(n.stk, String(it.stock));
    setText(n.tg, String(it.target));
    setText(n.lbl, clerk ? 'Auto-restock to' : '🔒 Needs Stock Clerk');
    const room = d.cap - E.totalStock(S);
    updateMgrRow(n, it);
    n.btns.forEach((b) => {
      if (b.dataset.act === 'buy') setDis(b, !it.buyable || S.cash < it.cost || room < (it.size || 1));
      else if (b.dataset.act === 'tgt') setDis(b, !clerk || !it.buyable);
    });
  }
  const STATUS_LABEL = { launching: '🔥 Launching', peak: '⭐ Peak', fading: '↘ Fading', legacy: '🕰️ Legacy' };
  function renderConMarket(d) {
    const rows = CS.Con.market(S, d).filter((m) => m.share > 0.004 || m.base > 0.5).slice(0, 9);
    setHtml($('#conMarketBody'), '<small>Console games and accessories sell to people who own that platform. The more of its consoles you sell, the more of your shoppers (and repeat buyers) own one.</small>' +
      rows.map((m) => `<div class="cmrow"><span class="cmn">${esc(m.plat.name)}</span><span class="cmst">${STATUS_LABEL[m.status] || ''}</span><div class="bar cmbar" title="Share of shoppers who own it"><i style="width:${Math.min(100, m.share * 400)}%"></i></div><span class="cmv num">${(m.share * 100).toFixed(0)}% own · your base ${num(m.base)} · loyalty ${Math.round(m.loyalty * 100)}%</span></div>`).join(''));
  }
  function renderCatalog(d, items) {
    const total = E.totalStock(S);
    setText($('#catCap'), total + ' / ' + d.cap + ' shelf spaces');
    $('#catBar').style.width = Math.min(100, (100 * total) / d.cap) + '%';
    const pa = $('#priceAdj');
    if (document.activeElement !== pa) pa.value = Math.round(S.priceAdj * 100);
    setText($('#priceLbl'), (S.priceAdj >= 0 ? '+' : '') + Math.round(S.priceAdj * 100) + '%');
    const clerk = (S.up.clerk || 0) + (S.up.warehouse || 0) + (S.up.robot || 0) > 0;
    setText($('#clerkNote'), clerk ? 'Higher prices = more profit per sale but fewer buyers. Lower prices attract bargain hunters.' : 'Hire a Stock Clerk in Upgrades to unlock auto-restocking.');
    $$('#catChips button').forEach((b) => b.classList.toggle('on', b.dataset.f === catFilter));
    const unlocked = catFilter === 'pre' || (catFilter === 'game' ? d.aisleGame : catFilter === 'con' ? d.aisleConsole : d.aisleAcc);
    const aisle = CS.UP_BY_ID[catFilter === 'game' ? 'aisle_games' : catFilter === 'con' ? 'aisle_console' : 'aisle_acc'];
    setHtml($('#catNotice'), unlocked ? '' : `<div class="panel"><div class="pbody"><b>${aisle.icon} ${esc(aisle.name)}</b><div>${esc(aisle.desc)}</div><button class="primary" data-act="up" data-id="${aisle.id}" ${S.cash < aisle.base ? 'disabled' : ''}>Open for ${money(aisle.base)}</button></div></div>`);
    // filters & sorting
    const kindsFor = { pre: ['pre'], game: ['game'], acc: ['acc'], con: ['console', 'cgame', 'cacc'] }[catFilter];
    const kindItems = items.filter((i) => kindsFor.includes(i.kind));
    const pop = E.popularityMap(kindItems, d);
    const maxPop = {}; // demand is compared within a group (a keyboard against other keyboards)
    kindItems.forEach((i) => { const g = i.group || ''; maxPop[g] = Math.max(maxPop[g] || 1e-9, pop[i.key]); });
    popNorm = {};
    kindItems.forEach((i) => (popNorm[i.key] = pop[i.key] / maxPop[i.group || '']));
    const gs = $('#grpSelect');
    if (catFilter === 'acc') {
      const sig = CS.GROUPS.filter((g) => g.kind === 'acc').map((g) => g.id).join();
      if (gs._sig !== sig) { gs._sig = sig; gs.innerHTML = '<option value="all">All groups</option>' + CS.GROUPS.filter((g) => g.kind === 'acc').map((g) => `<option value="${g.id}">${g.icon} ${esc(g.name)}</option>`).join(''); }
    }
    $('#grpSel').hidden = catFilter !== 'acc';
    $('#conSel').hidden = catFilter !== 'con';
    $('#conMarket').hidden = catFilter !== 'con' || !d.aisleConsole;
    if (catFilter === 'con') {
      const ps = $('#platSelect');
      const sig = CS.PLATFORMS.filter((p) => p.year <= d.y).map((p) => p.id).join();
      if (ps._sig !== sig) { ps._sig = sig; ps.innerHTML = '<option value="all">All platforms</option>' + CS.PLATFORMS.filter((p) => p.year <= d.y).map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join(''); }
      renderConMarket(d);
    }
    const F = FILT.cat, q = F.q.trim().toLowerCase();
    const sort = CAT_SORTS[F.sort] || CAT_SORTS.new;
    const list = kindItems.filter((i) => {
      if (F.age === 'current' && !isCurrent(i)) return false;
      if (F.age === 'old' && isCurrent(i)) return false;
      if (F.shelf === 'stocked' && !(i.stock > 0 || i.target > 0)) return false;
      if (F.shelf === 'empty' && (i.stock > 0 || i.target > 0)) return false;
      if (catFilter === 'acc' && F.group !== 'all' && i.group !== F.group) return false;
      if (catFilter === 'con' && F.ctype !== 'all' && i.kind !== F.ctype) return false;
      if (catFilter === 'con' && F.plat !== 'all' && i.plat !== F.plat) return false;
      if (q && !(i.brand + ' ' + i.name).toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => (b.buyable - a.buyable) || sort(a, b, pop));
    syncFilterUI($('#tab-catalog'));
    $('#catEmpty').hidden = !!list.length || !unlocked;
    syncList($('#catList'), list, (i) => i.key, createItemCard, (n, it) => updateItemCard(n, it, d, clerk));
  }

  /* ---------- BUYERS tab (purchasing managers) ---------- */
  const M = CS.M;
  const MC_SPEC = [
    { grp: 'Strategy', ctl: [
      { k: 'preset', t: 'select', l: 'Preset', o: () => Object.entries(CS.MGR_PRESETS).map(([v, p]) => [v, p.label]).concat([['custom', 'Custom (your own settings)']]) },
      { k: 'priority', t: 'select', l: 'Prioritise', o: [['balanced', 'Balanced'], ['profit', 'Profit per sale'], ['volume', 'Best sellers'], ['margin', 'Highest margin']] },
      { k: 'coverage', t: 'range', l: 'Stock cover', min: 0.5, max: 20, step: 0.5, f: (v) => v + ' min of sales' },
      { k: 'safety', t: 'range', l: 'Safety buffer', min: 0, max: 100, step: 5, f: (v) => v + '%' },
      { k: 'maxSkus', t: 'range', l: 'Products stocked at once', min: 1, max: 'skus', step: 1, f: (v) => v },
    ] },
    { grp: 'Budget & space', ctl: [
      { k: 'reserveCash', t: 'num', l: 'Never spend below ($)', min: 0, hide: ['bp'] },
      { k: 'maxOrderPct', t: 'range', l: 'Max share of free cash per order', min: 5, max: 100, step: 5, f: (v) => v + '%', hide: ['bp'] },
      { k: 'maxSpacePct', t: 'range', l: 'Shelf-space allowance', min: 5, max: 100, step: 5, f: (v) => v + '% of shelves' },
    ] },
    { grp: 'What to stock', ctl: [
      { k: 'age', t: 'select', l: 'Age policy', o: [['current', 'Current models only'], ['new', 'New releases only (up to 1 year)'], ['any', 'Anything still orderable']], hide: ['bp'] },
      { k: 'maxAge', t: 'range', l: '"Current" means up to', min: 0.5, max: 8, step: 0.5, f: (v) => v + ' years old', hide: ['bp'] },
      { k: 'minMargin', t: 'range', l: 'Minimum margin', min: 0, max: 60, step: 5, f: (v) => (v ? v + '%' : 'any') },
      { k: 'maxPrice', t: 'num', l: 'Max unit price ($, 0 = no limit)', min: 0 },
      { k: 'blocked', t: 'chips', l: 'Never buy from (tap to block)', hide: ['bp'] },
      { k: 'groups', t: 'chips', l: 'Only these groups (none selected = all)', only: ['acc'] },
      { k: 'platforms', t: 'chips', l: 'Only these platforms (none selected = all)', only: ['con'] },
    ] },
    { grp: 'Trends & pricing', ctl: [
      { k: 'sensitivity', t: 'range', l: 'Trend sensitivity', min: 0, max: 100, step: 5, f: (v) => (v < 34 ? 'slow & steady' : v < 67 ? 'moderate' : 'quick to react') },
      { k: 'anticipate', t: 'toggle', l: 'Plan ahead for market events', req: ['forecast', 4] },
      { k: 'preBuy', t: 'toggle', l: 'Time purchases around price spikes', req: ['forecast', 6], only: ['pre', 'bp'] },
      { k: 'testSize', t: 'range', l: 'Test order for new releases', min: 0, max: 12, step: 1, f: (v) => (v ? v + ' units' : 'none'), hide: ['bp'] },
      { k: 'mdOn', t: 'toggle', l: 'Mark down older stock', hide: ['bp'] },
      { k: 'mdAge', t: 'range', l: '…once older than', min: 0.5, max: 6, step: 0.5, f: (v) => v + ' years', hide: ['bp'] },
      { k: 'mdPct', t: 'range', l: '…by', min: 5, max: 60, step: 5, f: (v) => v + '% off', hide: ['bp'] },
    ] },
    { grp: 'Reports', ctl: [{ k: 'log', t: 'toggle', l: 'Keep a notebook of decisions' }] },
  ];
  const DESIGN_SPEC = [
    { grp: 'Strategy', ctl: [
      { k: 'preset', t: 'select', l: 'Preset', o: () => Object.entries(CS.DESIGN_PRESETS).map(([v, p]) => [v, p.label]).concat([['custom', 'Custom (your own settings)']]) },
      { k: 'maxDesigns', t: 'range', l: 'Designs to keep at once', min: 1, max: 'bench', step: 1, f: (v) => v },
      { k: 'reserveSlots', t: 'range', l: 'Keep blueprint slots free for me', min: 0, max: 'bench', step: 1, f: (v) => (v ? v + ' slot' + (v > 1 ? 's' : '') : 'none') },
      { k: 'tiers', t: 'chips', l: 'Part tiers to use (tap to toggle)' },
      { k: 'diversity', t: 'range', l: 'Appetite for a second design of the same kind', min: 0, max: 1, step: 0.05, f: (v) => (v >= 0.85 ? 'happy to' : v >= 0.5 ? 'sometimes' : 'avoid') },
    ] },
    { grp: 'Pricing', ctl: [
      { k: 'priceMode', t: 'select', l: 'Pricing', o: [['auto', 'Follow the market (needs Market sense 2)'], ['fixed', 'Fixed markup']] },
      { k: 'fixedMarkup', t: 'range', l: 'Fixed markup', min: 0, max: 1.5, step: 0.05, f: (v) => '+' + Math.round(v * 100) + '%' },
      { k: 'minMarkup', t: 'range', l: 'Lowest markup to try', min: 0, max: 1.5, step: 0.05, f: (v) => '+' + Math.round(v * 100) + '%' },
      { k: 'maxMarkup', t: 'range', l: 'Highest markup to try', min: 0, max: 2, step: 0.05, f: (v) => '+' + Math.round(v * 100) + '%' },
      { k: 'minMargin', t: 'range', l: 'Minimum margin', min: 0, max: 60, step: 5, f: (v) => (v ? v + '%' : 'any') },
      { k: 'maxBuildCost', t: 'num', l: 'Max build cost per PC ($, 0 = no limit)', min: 0 },
    ] },
    { grp: 'Parts & stock', ctl: [
      { k: 'allowIgp', t: 'toggle', l: 'Use integrated graphics in cheap designs' },
      { k: 'allowFree', t: 'toggle', l: 'Use the free OS in budget designs' },
      { k: 'setTargets', t: 'toggle', l: 'Set auto-build targets (unless a Custom Builds buyer is on duty)' },
      { k: 'coverage', t: 'range', l: 'Stock cover', min: 0.5, max: 20, step: 0.5, f: (v) => v + ' min of sales' },
      { k: 'reserveCash', t: 'num', l: 'Never pay a design fee below ($)', min: 0 },
      { k: 'refreshAge', t: 'range', l: 'Replace designs older than', min: 1, max: 6, step: 0.5, f: (v) => v + ' years (when slots are needed)' },
      { k: 'autoRetire', t: 'toggle', l: 'Delete obsolete designs once sold out' },
    ] },
    { grp: 'Reports', ctl: [
      { k: 'namePrefix', t: 'text', l: 'Name prefix for new designs', maxlength: 12 },
      { k: 'log', t: 'toggle', l: 'Keep a notebook of decisions' },
    ] },
  ];
  const specFor = (cat) => (CS.MGR_CATS.find((c) => c.id === cat).designer ? DESIGN_SPEC : MC_SPEC);
  const brandCache = {};
  function brandsOf(cat) {
    if (!brandCache[cat]) {
      const set = new Set();
      if (cat === 'pre') CS.PRODUCTS.forEach((p) => set.add(p.brand));
      else if (cat === 'con') CS.PLATFORMS.forEach((p) => set.add(p.maker));
      else CS.ADDONS.filter((a) => a.kind === cat).forEach((a) => set.add(a.brand));
      brandCache[cat] = Array.from(set).sort();
    }
    return brandCache[cat];
  }
  const MGCOL_KEY = 'csig-mgcol';
  const mgCol = {};
  try { Object.assign(mgCol, JSON.parse(localStorage.getItem(MGCOL_KEY) || '{}')); } catch (e) { /* defaults: all open */ }
  function setMgCol(cat, v) {
    mgCol[cat] = !!v;
    try { localStorage.setItem(MGCOL_KEY, JSON.stringify(mgCol)); } catch (e) { /* ignore */ }
  }
  const mcId = (cat, k) => cat + ':' + k;
  function ctlHtml(cat, c) {
    const id = `data-mc="${mcId(cat, c.k)}"`;
    const lab = (extra) => `<div class="field mc" data-row="${mcId(cat, c.k)}"><label><span>${esc(c.l)}</span><b class="mcv"></b></label>${extra}<small class="mcreq"></small></div>`;
    switch (c.t) {
      case 'select': return lab(`<select ${id}></select>`);
      case 'range': return lab(`<input type="range" ${id} min="${c.min}" step="${c.step}">`);
      case 'num': return lab(`<input type="text" inputmode="numeric" ${id}>`);
      case 'text': return lab(`<input type="text" maxlength="${c.maxlength || 20}" data-txt="1" ${id}>`);
      case 'toggle': return `<label class="check mc" data-row="${mcId(cat, c.k)}"><input type="checkbox" ${id}> <span>${esc(c.l)}</span><small class="mcreq"></small></label>`;
      case 'chips': return lab(`<div class="chips mcchips" ${id}></div>`);
    }
    return '';
  }
  function buildBuyers() {
    let html = `
      <div class="panel" id="byLocked"><div class="title">Purchasing Office</div><div class="pbody" id="byLockedBody"></div></div>
      <div id="byMain" class="tab" hidden>
        <div class="panel"><div class="title"><span>Purchasing Office</span><span id="byWages" class="num"></span></div><div class="pbody">
          <small>Hire a buyer for each product category. They watch sales trends, decide what to stock and how much, and place the orders themselves. Tune how each one works below (collapse a buyer with its arrow to compare them), and pin or skip individual products from the Stock tab.</small>
          <div class="grid" id="bySum"></div>
          <div class="row mgAll"><button class="small" data-act="mgcollapseall" data-v="1">Collapse all</button><button class="small" data-act="mgcollapseall" data-v="0">Expand all</button></div></div></div>`;
    CS.MGR_CATS.forEach((c) => {
      html += `<div class="panel mgr" id="mg-${c.id}" data-cat="${c.id}"><div class="title"><span>${c.icon} ${esc(c.name)}${c.designer ? '' : ' buyer'}</span><span class="mgTitleR"><span class="mgName"></span><button class="small mgtoggle" data-act="mgcollapse" data-cat="${c.id}" aria-label="Collapse or expand ${esc(c.name)}">▾</button></span></div><div class="mgSummary" hidden></div><div class="pbody">
        <div class="mgVacant">
          <div class="alert warn mgNeed" hidden></div>
          <div class="list mgCands"></div>
          <button class="small" data-act="mgrefresh" data-cat="${c.id}"></button>
        </div>
        <div class="mgStaffed" hidden>
          <div class="mgHead"><div><b class="mgPerson"></b><br><small class="mgTrait"></small></div><label class="check"><input type="checkbox" data-mc="${mcId(c.id, 'on')}"> On duty</label></div>
          <div class="grid mgStats"></div>
          <div class="alert mgStance" hidden></div>
          <h4 class="mgh">Skills</h4><div class="mgSkills"></div>
          <h4 class="mgh">${c.designer ? 'Current designs' : "This week's plan"}</h4><div class="mgPlan"></div>`;
      specFor(c.id).forEach((g) => {
        const ctls = g.ctl.filter((x) => (!x.hide || !x.hide.includes(c.id)) && (!x.only || x.only.includes(c.id)));
        if (!ctls.length) return;
        html += `<details class="mgd"${g.grp === "Strategy" ? " open" : ""}><summary>${esc(g.grp)}</summary><div class="mgdb">${ctls.map((x) => ctlHtml(c.id, x)).join('')}</div></details>`;
      });
      html += `<h4 class="mgh">Notebook</h4><ul class="mgLog"></ul>
          <button class="small danger" data-act="mgfire" data-cat="${c.id}">Let go…</button>
        </div></div></div>`;
    });
    html += '</div>';
    $('#tab-buyers').innerHTML = html;
    shopRefs.by = {};
    [['mgrs', 'Buyers employed'], ['orders', 'Units ordered'], ['saved', 'Saved by negotiating'], ['wages', 'Wages / min']].forEach(([id, l]) => {
      const m = node(`<div class="mini"><small>${l}</small><b class="num">–</b></div>`);
      $('#bySum').appendChild(m);
      shopRefs.by[id] = $('b', m);
    });
    // skills rows
    CS.MGR_CATS.forEach((c) => {
      const box = $('#mg-' + c.id + ' .mgSkills');
      CS.MGR_SKILLS.forEach((sk0) => {
        const sk = Object.assign({}, sk0, { name: (c.skillNames || {})[sk0.id] || sk0.name, desc: (c.skillDescs || {})[sk0.id] || sk0.desc });
        box.appendChild(node(`<div class="mgSkill" data-skill="${sk.id}"><div><b>${sk.icon} ${esc(sk.name)}</b> <small class="sklv"></small><div class="bar"><i></i></div><small>${esc(sk.desc)}</small></div><button class="small" data-act="mgtrain" data-cat="${c.id}" data-skill="${sk.id}"></button></div>`));
      });
      // chips
      const bl = $('[data-mc="' + mcId(c.id, 'blocked') + '"]'), gr = $('[data-mc="' + mcId(c.id, 'groups') + '"]'), pf = $('[data-mc="' + mcId(c.id, 'platforms') + '"]');
      if (pf) pf.innerHTML = CS.PLATFORMS.map((p) => `<button data-act="mcchip" data-mc="${mcId(c.id, 'platforms')}" data-v="${p.id}">${esc(p.name)}</button>`).join('');
      const tc = $('[data-mc="' + mcId(c.id, 'tiers') + '"]');
      if (tc) tc.innerHTML = ['Budget', 'Standard', 'Premium'].map((x) => `<button data-act="mcchip" data-mc="${mcId(c.id, 'tiers')}" data-v="${x}">${x}</button>`).join('');
      if (bl) bl.innerHTML = brandsOf(c.id).map((b) => `<button data-act="mcchip" data-mc="${mcId(c.id, 'blocked')}" data-v="${esc(b)}">${esc(b)}</button>`).join('');
      if (gr) gr.innerHTML = CS.GROUPS.filter((g) => g.kind === 'acc').map((g) => `<button data-act="mcchip" data-mc="${mcId(c.id, 'groups')}" data-v="${g.id}">${g.icon} ${esc(g.name)}</button>`).join('');
    });
  }
  function candCard(c) {
    const el = node(`<div class="card"><div class="icon cic"></div><div class="info"><b class="cnm"></b><small class="ctr"></small><div class="nums cst"></div><small class="cwg"></small></div><div class="acts"><button class="primary grow" data-act="mghire"></button></div></div>`);
    return { el, ic: $('.cic', el), nm: $('.cnm', el), tr: $('.ctr', el), st: $('.cst', el), wg: $('.cwg', el), btn: $('[data-act=mghire]', el) };
  }
  const trendArrow = (tr) => (tr == null ? '' : tr > 0.25 ? '↗' : tr < -0.25 ? '↘' : '→');
  function renderBuyers(d, items) {
    const lock = $('#byLocked'), main = $('#byMain');
    const u = CS.UP_BY_ID.purchasing;
    if (!d.office) {
      lock.hidden = false; main.hidden = true;
      if (d.y < u.year) setHtml($('#byLockedBody'), `<div class="empty-note">🔒 Purchasing managers become available in <b>${u.year}</b>, once the shop is big enough to need a buyer.</div>`);
      else setHtml($('#byLockedBody'), `<p>${esc(u.desc)}</p><button class="primary" data-act="up" data-id="purchasing" id="byBuy" ${S.cash < u.base ? 'disabled' : ''}>Open the Purchasing Office — ${money(u.base)}</button>`);
      return;
    }
    lock.hidden = true; main.hidden = false;
    const rs = shopRefs.by;
    let n = 0, ordered = 0, saved = 0;
    CS.MGR_CATS.forEach((c) => { const mg = S.mgr[c.id]; if (mg) { n++; ordered += mg.stats.ordered; saved += mg.stats.saved; } });
    setText(rs.mgrs, n + ' / ' + CS.MGR_CATS.length); setText(rs.orders, num(ordered)); setText(rs.saved, money(saved)); setText(rs.wages, money(d.mgr.wages * 60));
    setText($('#byWages'), n ? 'Wages ' + money(d.mgr.wages * 60) + '/min' : '');
    const byKey = {};
    items.forEach((i) => (byKey[i.key] = i));

    CS.MGR_CATS.forEach((c) => {
      const mgEl = $('#mg-' + c.id);
      const mg = S.mgr[c.id], avail = M.available(d, c.id);
      mgEl.hidden = !avail && !mg ? false : false;
      const vac = $('.mgVacant', mgEl), stf = $('.mgStaffed', mgEl);
      vac.hidden = !!mg; stf.hidden = !mg;
      setText($('.mgName', mgEl), mg ? mg.name : 'Vacant');
      const col = !!mgCol[c.id];
      mgEl.classList.toggle('collapsed', col);
      setText($('.mgtoggle', mgEl), col ? '▸' : '▾');
      const sum = $('.mgSummary', mgEl);
      sum.hidden = !col;
      if (col) {
        if (!mg) setText(sum, avail ? 'No one hired yet. Expand to see candidates.' : '🔒 Not available yet.');
        else {
          const cf = M.cfgOf(S, c.id), tr0 = CS.MGR_TRAITS[mg.trait];
          setText(sum, tr0.icon + ' ' + (cf.on ? 'On duty' : '😴 Off duty') + ' · ' + mg.plan.length + ' product' + (mg.plan.length === 1 ? '' : 's') + ' planned · ordered ' + num(mg.stats.ordered) + ' · saved ' + money(mg.stats.saved) + (mg.stance ? (mg.stance === 'prebuy' ? ' · 🛒 buying ahead' : ' · ⏳ holding back') : ''));
        }
      }
      if (!mg) {
        const need = $('.mgNeed', mgEl);
        need.hidden = avail;
        if (!avail) setText(need, c.id === 'bp' || c.designer ? 'Needs the Build Workshop.' : c.id === 'game' ? 'Needs the Software Aisle.' : c.id === 'con' ? 'Needs the Console Corner.' : 'Needs the Accessories Wall.');
        const cands = avail ? M.candidates(S, c.id) : [];
        syncList($('.mgCands', mgEl), cands.map((x, i) => Object.assign({ idx: i }, x)), (x) => x.name, candCard, (cn, x) => {
          const tr = CS.MGR_TRAITS[x.trait];
          const bonus = M.bonusFor(S, x.wage, d.y);
          setText(cn.ic, tr.icon);
          setText(cn.nm, x.name + ' — ' + tr.name);
          setText(cn.tr, tr.desc);
          setHtml(cn.st, CS.MGR_SKILLS.map((sk) => `<span title="${esc((c.skillNames || {})[sk.id] || sk.name)}">${sk.icon} ${x.skills[sk.id]}</span>`).join(''));
          setText(cn.wg, 'Wage ' + money(x.wage * M.wageInfl(d.y) * 60) + '/min · signing bonus ' + money(bonus));
          cn.btn.dataset.cat = c.id; cn.btn.dataset.idx = String(x.idx);
          setText(cn.btn, bonus ? 'Hire for ' + money(bonus) : 'Hire (no signing bonus)');
          setDis(cn.btn, S.cash < bonus);
        });
        const rb = $('[data-act=mgrefresh]', mgEl);
        setText(rb, 'Look for other candidates — ' + money(M.refreshCost(S, d)));
        setDis(rb, !avail || S.cash < M.refreshCost(S, d));
        return;
      }
      const m = d.mgr.cats[c.id], cfg = M.cfgOf(S, c.id), tr = CS.MGR_TRAITS[mg.trait];
      setText($('.mgPerson', mgEl), tr.icon + ' ' + mg.name + ' (' + tr.name + ')');
      setText($('.mgTrait', mgEl), tr.desc + ' Wage ' + money(m.wage * 60) + '/min.');
      const onBox = $('[data-mc="' + mcId(c.id, 'on') + '"]', mgEl);
      if (document.activeElement !== onBox) onBox.checked = !!cfg.on;
      const st = $('.mgStats', mgEl);
      if (!st._built) {
        (c.designer ? [['ord', 'Designs made'], ['spent', 'Design fees'], ['saved', 'Quality bonus'], ['plan', 'Active designs']] : [['ord', 'Units ordered'], ['spent', 'Spent'], ['saved', 'Saved (deals)'], ['plan', 'Products planned']]).forEach(([id, l]) => st.appendChild(node(`<div class="mini" data-s="${id}"><small>${l}</small><b class="num">–</b></div>`)));
        st._built = true;
      }
      const sv = (id, v) => setText($('[data-s=' + id + '] b', st), v);
      sv('ord', num(mg.stats.ordered)); sv('spent', money(mg.stats.spent)); sv('saved', c.designer ? '+' + (m.eff.negotiate) + '%' : money(mg.stats.saved)); sv('plan', String(mg.plan.length));
      const stance = $('.mgStance', mgEl);
      stance.hidden = !(cfg.on && mg.stance);
      if (!stance.hidden) { stance.className = 'alert mgStance warn'; setText(stance, mg.stance === 'prebuy' ? '🛒 Buying ahead of a price spike.' : '⏳ Holding back while prices are inflated.'); }
      // skills
      $$('.mgSkill', mgEl).forEach((row) => {
        const sk = row.dataset.skill, lvl = mg.skills[sk], eff = m.eff[sk];
        setText($('.sklv', row), 'Lv ' + lvl + (eff > lvl ? ' (+' + (eff - lvl) + ' HQ)' : '') + ' / ' + M.MAX_LEVEL);
        $('.bar i', row).style.width = (100 * Math.min(eff, M.MAX_LEVEL)) / M.MAX_LEVEL + '%';
        const b = $('button', row), cost = M.trainCost(S, mg, sk, d);
        setText(b, lvl >= M.MAX_LEVEL ? 'MAX' : 'Train — ' + money(cost));
        setDis(b, lvl >= M.MAX_LEVEL || S.cash < cost);
      });
      // plan
      const plan = mg.plan.slice().sort((a, b) => b.t - a.t);
      const wk = cfg.on ? '' : '<div class="empty-note">Off duty: nothing is being planned or ordered. Targets you set by hand apply.</div>';
      setHtml($('.mgPlan', mgEl), wk + (plan.length ? plan.map((p) => {
        const it = byKey[p.k];
        return `<div class="mgp"><span class="mgpn">${esc(p.name)}</span><span class="mgpv num">${it ? it.stock : 0} / ${p.t}</span><span class="mgpt">${trendArrow(p.tr)} ${esc(p.why)} · ${p.v.toFixed(p.v < 10 ? 1 : 0)}/min</span></div>`;
      }).join('') : (cfg.on ? '<div class="empty-note">Nothing worth stocking yet. Loosen the filters or wait for new products.</div>' : '')));
      // controls
      specFor(c.id).forEach((g) => g.ctl.forEach((x) => {
        const sel = '[data-mc="' + mcId(c.id, x.k) + '"]';
        const el = $(sel, mgEl);
        if (!el) return;
        const row = el.closest('.mc');
        const v = cfg[x.k];
        const locked = x.req && m.eff[x.req[0]] < x.req[1];
        if (row) { const rq = $('.mcreq', row); setText(rq, locked ? '🔒 Needs ' + ((c.skillNames || {})[x.req[0]] || CS.MGR_SKILLS.find((s) => s.id === x.req[0]).name) + ' ' + x.req[1] : ''); }
        if (x.t === 'select') {
          const opts = typeof x.o === 'function' ? x.o() : x.o;
          const sig = opts.map((o) => o[0]).join();
          if (el._sig !== sig) { el._sig = sig; el.innerHTML = opts.map(([val, lb]) => `<option value="${val}">${esc(lb)}</option>`).join(''); }
          if (document.activeElement !== el && el.value !== String(v)) el.value = String(v);
        } else if (x.t === 'range') {
          const max = x.max === 'skus' ? m.maxSkus : x.max === 'bench' ? d.benchSlots : x.max;
          el.max = String(max);
          if (document.activeElement !== el) el.value = String(Math.min(v, max));
          setText($('.mcv', row), x.f(Math.min(v, max)));
        } else if (x.t === 'num') {
          if (document.activeElement !== el) el.value = String(v || 0);
        } else if (x.t === 'text') {
          if (document.activeElement !== el) el.value = v || '';
        } else if (x.t === 'toggle') {
          el.checked = !!v && !locked; setDis(el, locked);
        } else if (x.t === 'chips') {
          $$('button', el).forEach((b) => b.classList.toggle('on', v.includes(b.dataset.v)));
        }
      }));
      setHtml($('.mgLog', mgEl), (mg.log || []).slice(0, 8).map((l) => `<li>${esc(l.txt)}</li>`).join('') || '<li><small>Nothing yet.</small></li>');
    });
  }

  /* ---------- WORKSHOP tab ---------- */
  const design = { name: 'My Custom PC', parts: {}, markup: 0.6, sig: {} };
  function buildWorkshop() {
    let sel = '';
    CS.SLOTS.forEach((sl) => {
      sel += `<div class="field"><label><span>${sl.icon} ${sl.name}</span><small id="dpf-${sl.id}"></small></label><select id="dsel-${sl.id}" data-slot="${sl.id}"></select></div>`;
    });
    $('#tab-workshop').innerHTML = `
      <div class="panel" id="wsLocked"><div class="title">Build Workshop</div><div class="pbody" id="wsLockedBody"></div></div>
      <div id="wsMain" class="tab" hidden>
        <div class="panel"><div class="title">Workshop</div><div class="pbody"><div class="grid" id="wsStats"></div><small id="wsHint"></small></div></div>
        <h3 class="sec">Your Blueprints</h3>
        <div class="ftools" id="bpTools">${chipRow('bp.f', [['all', 'All'], ['build', 'Buildable'], ['old', 'Discontinued parts']])}${selectEl('bp.sort', [['new', 'Newest first'], ['profit', 'Profit per PC'], ['perf', 'Performance'], ['stock', 'Most in stock']], 'Sort')}</div>
        <div class="list two" id="bpList"></div>
        <div class="panel"><div class="title">Design a New PC</div><div class="pbody">
          <div class="field"><label><span>Model name</span></label><input type="text" id="dname" maxlength="28"></div>
          ${sel}
          <div class="field"><label><span>Markup over parts cost</span><b id="dmkLbl"></b></label><input type="range" id="dmk" min="0" max="150" step="5"></div>
          <div class="grid" id="dsum"></div>
          <button class="primary" data-act="bpCreate" id="bpCreate">Save blueprint</button>
          <small id="dmsg"></small>
        </div></div>
      </div>`;
    $('#dname').value = design.name;
    $('#dmk').value = design.markup * 100;
    $('#dname').addEventListener('input', (e) => (design.name = e.target.value));
    $('#dmk').addEventListener('input', (e) => (design.markup = +e.target.value / 100));
    $$('#tab-workshop select').forEach((s) => s.addEventListener('change', (e) => (design.parts[e.target.dataset.slot] = e.target.value)));
    const sum = $('#dsum');
    design.refs = {};
    [['cost', 'Build cost'], ['price', 'Sell price'], ['profit', 'Profit / PC'], ['perf', 'Performance']].forEach(([id, l]) => {
      const m = node(`<div class="mini"><small>${l}</small><b class="num">–</b></div>`);
      sum.appendChild(m);
      design.refs[id] = $('b', m);
    });
    const st = $('#wsStats');
    design.stats = {};
    [['techs', 'Build speed / min'], ['slots', 'Blueprint slots'], ['stock', 'Built PCs in stock']].forEach(([id, l]) => {
      const m = node(`<div class="mini"><small>${l}</small><b class="num">–</b></div>`);
      st.appendChild(m);
      design.stats[id] = $('b', m);
    });
  }
  function partLabel(p, d) {
    return `${p.tier} · ${p.name} — ${money(E.partPrice(p, d))} · ${Math.round(E.partRel(p, d.y) * 100)}%`;
  }
  function syncSelect(slot, d) {
    const sel = $('#dsel-' + slot.id);
    const parts = CS.PARTS.filter((p) => p.slot === slot.id && E.partAvail(p, d.y)).sort((a, b) => (b.rolling ? 0 : b.year) - (a.rolling ? 0 : a.year) || b.q - a.q);
    const sig = parts.map((p) => p.id).join();
    if (design.sig[slot.id] !== sig) {
      design.sig[slot.id] = sig;
      sel.innerHTML = '';
      parts.forEach((p) => {
        const o = document.createElement('option');
        o.value = p.id;
        sel.appendChild(o);
      });
      if (!parts.find((p) => p.id === design.parts[slot.id])) {
        const pick = parts.filter((p) => p.tier === 'Standard').sort((a, b) => b.year - a.year)[0] || parts[0];
        design.parts[slot.id] = pick.id;
      }
      sel.value = design.parts[slot.id];
    }
    if (document.activeElement !== sel) {
      Array.from(sel.options).forEach((o) => {
        const t = partLabel(CS.PART_BY_ID[o.value], d);
        if (o._t !== t) { o.textContent = t; o._t = t; }
      });
    }
    return parts;
  }
  function createBpCard(bp) {
    const el = node(`<div class="card" data-id="${bp.id}" data-key="b:${bp.id}">
      <div class="icon">🛠️</div>
      <div class="info"><b class="nm"></b><small class="spec"></small>
        <div class="tags"><span class="tag t-perf"></span><span class="tag t-warn" hidden>⚠ Parts discontinued</span><span class="tag t-auto" hidden>📐 Auto-designed</span></div>
        <div class="nums"><span>Cost <b class="cc num"></b></span><span>Price <b class="pp num"></b></span><span>Profit <b class="pf num good"></b></span></div>
        <div>In stock: <b class="stk num"></b></div>
        <div class="field"><label><span>Markup</span><b class="mkl"></b></label><input type="range" class="mk" min="0" max="150" step="5" data-bp="${bp.id}"></div>
      </div>
      <div class="acts">
        <div class="stepper"><span class="lbl">Auto-build to</span><button data-act="tgt" data-d="-1">−</button><b class="tg num">0</b><button data-act="tgt" data-d="1">+</button></div>
        <div class="mgrow" hidden><span class="mginfo"></span><button class="small" data-act="mgpin"></button><button class="small" data-act="mgskip"></button></div>
        <button data-act="bpTake" data-id="${bp.id}" class="small" hidden>Take over</button>
        <button data-act="bpDel" data-id="${bp.id}" class="small">Delete</button>
      </div></div>`);
    const r = (s) => $(s, el);
    return { el, stepper: r('.stepper'), mgrow: r('.mgrow'), mginfo: r('.mginfo'), mgpin: r('[data-act=mgpin]'), mgskip: r('[data-act=mgskip]'), nm: r('.nm'), spec: r('.spec'), perf: r('.t-perf'), warn: r('.t-warn'), auto: r('.t-auto'), take: r('[data-act=bpTake]'), cc: r('.cc'), pp: r('.pp'), pf: r('.pf'), stk: r('.stk'), tg: r('.tg'), mk: r('.mk'), mkl: r('.mkl'), del: r('[data-act=bpDel]'), btns: $$('[data-act=tgt]', el) };
  }
  function renderWorkshop(d, items) {
    const wsl = $('#wsLocked'), wsm = $('#wsMain');
    if (!d.workshop) {
      wsl.hidden = false; wsm.hidden = true;
      const u = CS.UP_BY_ID.workshop;
      if (d.y < u.year) setHtml($('#wsLockedBody'), `<div class="empty-note">🔒 Custom PC building becomes possible in <b>${u.year}</b>.<br>For now, stick to reselling name-brand prebuilts.</div>`);
      else setHtml($('#wsLockedBody'), `<p>${esc(u.desc)}</p><button class="primary" data-act="up" data-id="workshop" id="wsBuy">Build the Workshop — ${money(E.upCost(S, u))}</button>`);
      const b = $('#wsBuy');
      if (b) setDis(b, S.cash < E.upCost(S, u));
      return;
    }
    wsl.hidden = true; wsm.hidden = false;
    setText(design.stats.techs, d.build ? num(d.build * 60) : 'No technicians');
    setText(design.stats.slots, S.bps.length + ' / ' + d.benchSlots);
    setText(design.stats.stock, num(items.filter((i) => i.kind === 'bp').reduce((a, i) => a + i.stock, 0)));
    setText($('#wsHint'), d.build ? 'Technicians build PCs up to each blueprint\'s auto-build target and pay for parts as they go. Old parts are discontinued after ~6 years — design a fresh blueprint then.' : 'Hire Build Technicians in Upgrades — they build your blueprints automatically.');

    const BS = { new: (a, b) => b.def.id.slice(2) - a.def.id.slice(2), profit: (a, b) => (b.price - b.cost) - (a.price - a.cost), perf: (a, b) => b.rel - a.rel, stock: (a, b) => b.stock - a.stock };
    const bps = items.filter((i) => i.kind === 'bp' && (FILT.bp.f === 'all' || (FILT.bp.f === 'build') === i.canBuild)).sort(BS[FILT.bp.sort] || BS.new);
    syncFilterUI($('#bpTools'));
    syncList($('#bpList'), bps, (i) => i.id, (i) => createBpCard(i.def), (n, it) => {
      const bp = it.def;
      setText(n.nm, bp.name);
      setText(n.spec, CS.SLOTS.map((sl) => CS.PART_BY_ID[bp.parts[sl.id]].name).join(' · '));
      setText(n.perf, 'Performance ' + Math.round(it.rel * 100) + '%');
      n.warn.hidden = it.canBuild;
      n.auto.hidden = n.take.hidden = bp.by !== 'designer';
      setText(n.cc, money(it.cost)); setText(n.pp, money(it.price));
      setText(n.pf, money(it.price - it.cost));
      setText(n.stk, String(it.stock)); setText(n.tg, String(it.target));
      setText(n.mkl, '+' + Math.round(bp.markup * 100) + '%');
      if (document.activeElement !== n.mk) n.mk.value = Math.round(bp.markup * 100);
      setDis(n.del, it.stock > 0);
      updateMgrRow(n, it);
      n.btns.forEach((b) => setDis(b, !it.canBuild && b.dataset.d > 0));
    });
    if (!bps.length) { if (!$('#bpEmpty')) $('#bpList').insertAdjacentHTML('beforebegin', '<div class="empty-note" id="bpEmpty">No blueprints yet — design your first PC below.</div>'); } else { const e = $('#bpEmpty'); if (e) e.remove(); }

    // designer
    CS.SLOTS.forEach((sl) => syncSelect(sl, d));
    const info = E.designInfo(design.parts, design.markup, d);
    setText($('#dmkLbl'), '+' + Math.round(design.markup * 100) + '%');
    setText(design.refs.cost, money(info.cost));
    setText(design.refs.price, money(info.price));
    setText(design.refs.profit, money(info.price - info.cost));
    setText(design.refs.perf, Math.round(info.rel * 100) + '%');
    CS.SLOTS.forEach((sl) => {
      const p = CS.PART_BY_ID[design.parts[sl.id]];
      if (p) setText($('#dpf-' + sl.id), money(E.partPrice(p, d)));
    });
    const full = S.bps.length >= d.benchSlots;
    setDis($('#bpCreate'), full);
    setText($('#dmsg'), full ? 'All blueprint slots are used. Delete an empty blueprint or buy a Design Bench.' : 'Customers weigh performance against price. Enthusiasts pay for power; bargain hunters want cheap.');
  }

  /* ---------- UPGRADES tab ---------- */
  const GROUPS = ['Marketing', 'Checkout', 'Stock', 'Shop', 'Workshop', 'Service'];
  function buildUpgrades() {
    $('#tab-upgrades').innerHTML = `
      <div class="panel"><div class="title">Shop Overview</div><div class="pbody"><div class="grid" id="upSum"></div><small id="upHint"></small></div></div>
      <div class="ftools" id="upTools">${chipRow('up.f', [['all', 'All'], ['afford', 'Affordable now'], ['open', 'Not maxed']])}</div>` +
      GROUPS.map((g) => `<h3 class="sec" id="uph-${g}">${g}</h3><div class="list two" id="upl-${g}"></div>`).join('');
    const box = $('#upSum');
    shopRefs.up = {};
    [['lambda', 'Customers / s'], ['serve', 'Checkout / s'], ['restock', 'Restock / s'], ['cap', 'Shelf space']].forEach(([id, l]) => {
      const m = node(`<div class="mini"><small>${l}</small><b class="num">–</b></div>`);
      box.appendChild(m);
      shopRefs.up[id] = $('b', m);
    });
  }
  function upNow(u, L) {
    const v = u.per * L;
    switch (u.kind) {
      case 'lambda': return '+' + num(v) + ' customers/s';
      case 'serve': return '+' + num(v) + ' served/s';
      case 'restock': return '+' + num(v) + ' units/s';
      case 'build': return '+' + num(v) + ' PCs/s';
      case 'cap': return '+' + v + ' shelf spaces';
      case 'disc': return '-' + (v * 100).toFixed(1) + '% costs';
      case 'aisle_game': case 'aisle_acc': case 'aisle_console': case 'office': return '';
      case 'loyal': return '+' + Math.round(v * 100) + '% customers';
      case 'night': return '+' + v + 'h offline';
      case 'serveMult': case 'buildMult': return '+' + Math.round(v * 100) + '%';
      case 'bench': return '+' + v + ' slots';
      case 'attach': return '+' + Math.round(v * 100) + '% add-on sales';
      default: return '';
    }
  }
  function createUpCard(u) {
    const el = node(`<div class="card" data-id="${u.id}">
      <div class="icon">${u.icon}</div>
      <div class="info"><b>${esc(u.name)} <small class="lv"></small></b><small>${esc(u.desc)}</small><small class="now good"></small><small class="req"></small></div>
      <div class="acts"><button class="primary grow" data-act="up" data-id="${u.id}"></button><button data-act="upmax" data-id="${u.id}" class="small">Max</button></div></div>`);
    return { el, lv: $('.lv', el), now: $('.now', el), req: $('.req', el), buy: $('[data-act=up]', el), max: $('[data-act=upmax]', el) };
  }
  function renderUpgrades(d) {
    const rs = shopRefs.up;
    setText(rs.lambda, num(d.lambda)); setText(rs.serve, num(d.serve)); setText(rs.restock, d.restock ? num(d.restock) : '–'); setText(rs.cap, num(d.cap));
    syncFilterUI($('#upTools'));
    const bottleneck = d.lambda > d.serve * 1.05 ? 'Checkout is your bottleneck: customers are leaving. Upgrade checkout!' : d.serve > d.lambda * 1.5 ? 'Checkout has spare capacity — more marketing will pay off.' : 'Marketing and checkout are well balanced.';
    setText($('#upHint'), bottleneck);
    GROUPS.forEach((g) => {
      const list = CS.UPGRADES.filter((u) => u.grp === g && d.y >= u.year - 2 && !(u.req && !S.up[u.req] && d.y < u.year)).filter((u) => {
        if (FILT.up.f === 'all') return true;
        const maxed = E.upLevel(S, u.id) >= u.max;
        return FILT.up.f === 'open' ? !maxed : !maxed && E.upUnlocked(S, u) && S.cash >= E.upCost(S, u);
      });
      $('#uph-' + g).hidden = !list.length;
      syncList($('#upl-' + g), list, (u) => u.id, createUpCard, (n, u) => {
        const L = E.upLevel(S, u.id);
        const unlocked = E.upUnlocked(S, u);
        const maxed = L >= u.max;
        n.el.classList.toggle('lockedcard', !unlocked);
        setText(n.lv, u.max === 1 ? (L ? '✔' : '') : 'Lv ' + L + (u.max < 999 ? '/' + u.max : ''));
        setText(n.now, L && u.max > 1 ? 'Now: ' + upNow(u, L) : '');
        setText(n.req, !unlocked ? (d.y < u.year ? '🔒 Available in ' + u.year : '🔒 Requires ' + CS.UP_BY_ID[u.req].name) : '');
        const cost = E.upCost(S, u);
        setText(n.buy, maxed ? (u.verb ? 'OPEN ✔' : 'MAX') : (u.max === 1 ? (u.verb || 'Build') + ' — ' : 'Buy — ') + money(cost));
        setDis(n.buy, !unlocked || maxed || S.cash < cost);
        n.max.hidden = u.max === 1;
        setDis(n.max, !unlocked || maxed || S.cash < cost);
      });
    });
  }

  /* ---------- FRANCHISE HQ tab ---------- */
  function buildFranchise() {
    $('#tab-franchise').innerHTML = `
      <div class="panel"><div class="title"><span>Franchise HQ</span><span id="fTokens" class="num"></span></div><div class="pbody">
        <small>Once your shop is a big business it earns <b>Franchise Tokens</b> from its lifetime sales. Cash them in by selling up and opening a brand-new franchise back in 1993 (or later, with Head Start). Tokens buy permanent HQ upgrades below.</small>
        <div class="grid" id="fStats"></div>
        <div class="bar"><i id="fBar"></i></div><small id="fNext"></small>
        <button class="primary" data-act="claim" id="fClaim"></button>
        <small><b>Kept:</b> tokens, HQ upgrades, trophies, shop name, stats. <b>Reset:</b> cash, upgrades, stock, blueprints and the calendar.</small>
      </div></div>
      <h3 class="sec">HQ Upgrades (permanent)</h3>
      <div class="ftools" id="hqTools">${chipRow('hq.f', [['all', 'All'], ['afford', 'Affordable now'], ['open', 'Not maxed']])}</div>
      <div class="list two" id="fList"></div>
      <h3 class="sec">Buyer upgrades (permanent)</h3>
      <div class="list two" id="fListB"></div>`;
    shopRefs.f = {};
    [['run', 'This run: total sales'], ['pend', 'Tokens ready to claim'], ['resets', 'Franchises opened'], ['earned', 'Tokens earned (all time)']].forEach(([id, l]) => {
      const m = node(`<div class="mini"><small>${l}</small><b class="num">–</b></div>`);
      $('#fStats').appendChild(m);
      shopRefs.f[id] = $('b', m);
    });
  }
  function tupNow(u, L) {
    const v = u.per * L;
    switch (u.id) {
      case 't_cash': return '+' + money(v) + ' start cash';
      case 't_kit': return 'Start with ' + v + ' clerk/shelf/sales level' + (v > 1 ? 's' : '') + ', ' + 2 * v + ' ad levels';
      case 't_night': return '+' + v + 'h offline';
      case 't_mgr': return '+' + v + ' to every buyer skill';
      case 't_mgr_deal': return '-' + (v * 100).toFixed(1) + '% purchase costs';
      case 't_mgr_wage': return '-' + Math.round(v * 100) + '% wages';
      case 't_mgr_recruit': return '-' + Math.round(v * 100) + '% hiring costs';
      case 't_mgr_academy': return '-' + Math.round(v * 100) + '% training costs';
      case 't_mgr_speed': return '+' + Math.round(v * 100) + '% order speed';
      case 't_mgr_wide': return '+' + v + ' products per buyer';
      case 't_mgr_free': return v + ' free hire' + (v > 1 ? 's' : '') + ' per franchise';
      case 't_mgr_office': return 'Office open from the start';
      case 't_warp': return '+' + Math.round(v * 100) + '% calendar speed until 2015';
      case 't_head': return 'New franchises open in ' + (CS.C.START_YEAR + CS.C.HEAD_STARTS[Math.min(L, CS.C.HEAD_STARTS.length - 1)].cal);
      default: return '+' + Math.round(v * 100) + '%';
    }
  }
  function createTupCard(u) {
    const el = node(`<div class="card" data-id="${u.id}">
      <div class="icon">${u.icon}</div>
      <div class="info"><b>${esc(u.name)} <small class="lv"></small></b><small>${esc(u.desc)}</small><small class="now good"></small></div>
      <div class="acts"><button class="primary grow" data-act="tup" data-id="${u.id}"></button></div></div>`);
    return { el, lv: $('.lv', el), now: $('.now', el), buy: $('[data-act=tup]', el) };
  }
  function renderFranchise() {
    const m = S.meta, pend = E.pendingTokens(S), rs = shopRefs.f;
    setText($('#fTokens'), '🎫 ' + num(m.tokens));
    setText(rs.run, money(S.stats.revenue));
    setText(rs.pend, num(pend));
    setText(rs.resets, num(m.resets));
    setText(rs.earned, num(m.earned));
    const next = E.nextTokenAt(S);
    const prev = pend > 0 ? E.tokenAt(S, pend) : 0;
    $('#fBar').style.width = Math.max(0, Math.min(100, (100 * (S.stats.revenue - prev)) / (next - prev))) + '%';
    setText($('#fNext'), pend < 1 ? 'First token at ' + money(next) + ' in total sales this run.' : 'Next token at ' + money(next) + ' in total sales (' + money(Math.max(0, next - S.stats.revenue)) + ' to go).');
    const b = $('#fClaim');
    setText(b, pend >= 1 ? '🎫 Sell up & claim ' + num(pend) + ' token' + (pend > 1 ? 's' : '') : 'Reach ' + money(C.TOKEN_R0) + ' in sales to claim tokens');
    setDis(b, pend < 1);
    syncFilterUI($('#hqTools'));
    const tlist = CS.TOKEN_UPGRADES.filter((u) => {
      if (FILT.hq.f === 'all') return true;
      const maxed = E.tl(S, u.id) >= u.max;
      return FILT.hq.f === 'open' ? !maxed : !maxed && m.tokens >= E.tokenCost(S, u);
    });
    const upd = (n, u) => {
      const L = E.tl(S, u.id), cost = E.tokenCost(S, u), maxed = L >= u.max;
      setText(n.lv, 'Lv ' + L + '/' + u.max);
      setText(n.now, L ? 'Now: ' + tupNow(u, L) : '');
      setText(n.buy, maxed ? 'MAX' : 'Buy — ' + num(cost) + ' 🎫');
      setDis(n.buy, maxed || m.tokens < cost);
    };
    syncList($('#fList'), tlist.filter((u) => u.grp !== 'Buyers'), (u) => u.id, createTupCard, upd);
    const buyerList = tlist.filter((u) => u.grp === 'Buyers');
    $('#fListB').previousElementSibling.hidden = !buyerList.length;
    syncList($('#fListB'), buyerList, (u) => u.id, createTupCard, upd);
  }
  function claimTokens() {
    const pend = E.pendingTokens(S);
    if (pend < 1) return;
    const m = S.meta;
    modal('Open a new franchise?', `<p>Sell this shop for <b>${pend} Franchise Token${pend > 1 ? 's' : ''}</b> and start again in <b>${E.startYear(S)}</b>.</p>
      <p><b>You keep:</b> ${num(m.tokens + pend)} tokens in total, your HQ upgrades, trophies, shop name and stats. HQ upgrades you buy before the new shop's first sale apply to it straight away.</p>
      <p><b>You lose:</b> ${money(S.cash)} cash, shop upgrades, stock, blueprints and your place in history (${E.dateStr(E.yearOf(S))}).</p>`, [
      { label: 'Sell up & restart', cls: 'danger', fn: () => {
        const r = E.prestige(S);
        if (!r) return;
        S = r.state;
        forceNext = true;
        flushSave().then(() => location.reload());
        toast('🎫 +' + r.gain + ' tokens! Opening your new franchise…', 6000);
      } },
      { label: 'Not yet' },
    ]);
  }

  /* ---------- MENU tab ---------- */
  /* ---------- version & change log ---------- */
  const VER = BOOT.version || { major: 1, minor: 0, build: 0 };
  const verStr = () => VER.major + '.' + VER.minor + '.' + VER.build;
  const SEEN_KEY = 'csig-seen-build';
  const getSeen = () => { try { const v = localStorage.getItem(SEEN_KEY); return v == null ? null : +v; } catch (e) { return null; } };
  const setSeen = (b) => { try { localStorage.setItem(SEEN_KEY, String(b)); } catch (e) { /* ignore */ } };
  function changelogHtml(entries) {
    return entries.map((e) => `<h4 class="mgh">${esc(e.title)} <small>v${VER.major}.${VER.minor}.${esc(e.build)} · ${esc(e.date || '')}</small></h4><ul class="clog">${(e.changes || []).map((c) => `<li>${esc(c)}</li>`).join('')}</ul>`).join('');
  }
  /** After an update: list what changed since the last build this device saw. */
  function maybeShowWhatsNew(playedBefore) {
    const log = (BOOT.changelog || []).filter((e) => typeof e.build === 'number');
    const seen = getSeen();
    setSeen(VER.build);
    if (!log.length || seen === VER.build) return;
    let fresh = seen == null ? (playedBefore ? log.slice(0, 1) : []) : log.filter((e) => e.build > seen);
    fresh = fresh.slice(0, 5);
    if (!fresh.length) return;
    const open = () => {
      if (!$('#modal').hidden && $('#modal').innerHTML) { setTimeout(open, 1500); return; } // wait for the welcome-back report
      modal("What's new — v" + verStr(), changelogHtml(fresh), [{ label: 'Got it', cls: 'primary' }]);
    };
    setTimeout(open, 800);
  }
  function buildMenu() {
    $('#tab-menu').innerHTML = `
      <div class="panel"><div class="title">Shop Settings</div><div class="pbody">
        <div class="field"><label><span>Shop name</span></label><input type="text" id="nameIn" maxlength="30"></div>
        <div class="field"><label><span>Visual theme</span></label>
          <select id="themeSel"><option value="auto">Automatic (follows the era)</option><option value="win95">Windoze 95 (1993–99)</option><option value="xp">Bliss (2000–08)</option><option value="flat">Flat (2009–16)</option><option value="rgb">RGB (2015–26)</option><option value="holo">Holo (2027+)</option></select></div>
        <label class="check"><input type="checkbox" id="optTicker"> Show the news ticker</label>
        <label class="check"><input type="checkbox" id="optWalkers"> Animate customers walking past</label>
      </div></div>
      <div class="panel"><div class="title">Account</div><div class="pbody">
        <div>Signed in as <b>${esc(BOOT.user.name)}</b></div>
        <small id="syncInfo"></small>
        <form method="post" action="${esc(BOOT.base)}/logout.php" id="logoutForm"><input type="hidden" name="csrf" value="${esc(BOOT.csrf)}"></form>
        <div class="menu-btns"><a class="btnlink" href="${esc(BOOT.base)}/account.php">🔑 Password &amp; account</a><button data-act="logout">🚪 Log out</button></div>
      </div></div>
      <div class="panel"><div class="title">Save Data</div><div class="pbody">
        <small id="saveInfo">The game saves to your account every 15 seconds and when you leave the page. While you are away the shop keeps trading (up to your offline limit).</small>
        <div class="menu-btns">
          <button data-act="save">💾 Save now</button><button data-act="export">📤 Export</button><button data-act="import">📥 Import</button><button data-act="reset" class="danger">🗑️ Erase all</button>
        </div></div></div>
      <div class="panel"><div class="title">Statistics</div><div class="pbody" id="statsBody"></div></div>
      <div class="panel"><div class="title"><span>Trophies</span><span id="achCount"></span></div><div class="pbody"><div id="troTools">${chipRow('tro.f', [['all', 'All'], ['earned', 'Earned'], ['locked', 'Locked']])}</div><div id="achBody"></div></div></div>
      <div class="panel"><div class="title"><span>About</span><span class="num" id="verLbl"></span></div><div class="pbody"><div class="menu-btns"><button data-act="changelog">📰 What's new</button></div><small>Idle computer shop, 1993 → 2035 (the last decade is pure speculation). Every brand and product name is a made-up parody; this game is not affiliated with or endorsed by any real company. Offline progress is capped by your shop's Night Lock-Up, and the calendar crawls at 1/20 speed while you are away.</small></div></div>`;
    setText($('#verLbl'), 'v' + verStr());
    $('#nameIn').addEventListener('input', (e) => { S.name = e.target.value.slice(0, 30) || 'Mega Byte Computers'; });
    $('#themeSel').addEventListener('change', (e) => { saveSettings({ theme: e.target.value }); applyTheme(true); });
    $('#optTicker').addEventListener('change', (e) => saveSettings({ showTicker: e.target.checked }));
    $('#optWalkers').addEventListener('change', (e) => saveSettings({ showWalkers: e.target.checked }));
  }
  function renderMenu(d) {
    if (document.activeElement !== $('#nameIn')) $('#nameIn').value = S.name;
    $('#themeSel').value = settings.theme;
    $('#optTicker').checked = settings.showTicker;
    $('#optWalkers').checked = settings.showWalkers;
    setText($('#syncInfo'), sync.state === 'ok' ? '☁️ Saved to your account at ' + new Date(sync.at).toLocaleTimeString() : '⚠️ Cannot reach the server. Progress is kept on this device and will sync when the connection is back.');
    const st = S.stats;
    setHtml($('#statsBody'), `<table class="rep">
      <tr><td>Calendar</td><td>${E.dateStr(d.y)}</td></tr>
      <tr><td>Time played</td><td>${dur(st.play)}</td></tr>
      <tr><td>Time earning while away</td><td>${dur(st.offline)}</td></tr>
      <tr><td>Sales this franchise</td><td>${money(st.revenue)}</td></tr>
      ${S.meta.resets ? `<tr><td>Sales, all franchises</td><td>${money(S.meta.lifeRevenue + st.revenue)}</td></tr>
      <tr><td>Items sold, all franchises</td><td>${num(S.meta.lifeUnits + E.unitsSold(st))}</td></tr>` : ''}
      <tr><td>Computers sold</td><td>${num(st.sold)}</td></tr>
      <tr><td>Computers built</td><td>${num(st.built)}</td></tr>
      <tr><td>Games sold</td><td>${num(st.soldGames)}</td></tr>
      <tr><td>Accessories sold</td><td>${num(st.soldAcc)}</td></tr>
      <tr><td>Consoles sold</td><td>${num(st.soldConsoles || 0)}</td></tr>
      <tr><td>Console games & accessories sold</td><td>${num((st.soldCGames || 0) + (st.soldCAcc || 0))}</td></tr>
      <tr><td>Repairs done</td><td>${num(st.repairs || 0)}</td></tr>
      <tr><td>Extended warranties sold</td><td>${num(st.warranties || 0)}</td></tr>
      <tr><td>Hustles</td><td>${num(st.hustles)}</td></tr>
      <tr><td>Franchises opened</td><td>${num(S.meta.resets)}</td></tr>
      <tr><td>Offline limit</td><td>${d.offlineCap / 3600}h</td></tr></table>`);
    const got = CS.ACH.filter((a) => S.ach[a.id]).length;
    setText($('#achCount'), got + ' / ' + CS.ACH.length + ' (+' + got + '% customers)');
    syncFilterUI($('#troTools'));
    setHtml($('#achBody'), CS.ACH.filter((a) => FILT.tro.f === 'all' || (FILT.tro.f === 'earned') === !!S.ach[a.id]).map((a) => `<div class="ach ${S.ach[a.id] ? '' : 'locked'}"><span>${S.ach[a.id] ? '🏆' : '🔒'}</span><div><b>${esc(a.name)}</b><br><small>${esc(a.desc)}</small></div></div>`).join(''));
  }

  /* ---------- theme / header ---------- */
  let curTheme = '';
  function applyTheme(force) {
    const era = E.eraAt(E.yearOf(S));
    const th = settings.theme === 'auto' ? era.theme : settings.theme;
    if (th !== curTheme || force) {
      curTheme = th;
      document.body.dataset.theme = th;
      const m = $('meta[name=theme-color]');
      requestAnimationFrame(() => { m.content = getComputedStyle(document.body).getPropertyValue('--panel').trim() || '#008080'; });
    }
  }
  let eraShown = '';
  function renderHeader(d) {
    setText($('#shopName'), S.name);
    $('#ticker').hidden = !settings.showTicker;
    setText($('#date'), E.dateStr(d.y));
    setText($('#cash'), money(S.cash));
    setText($('#income'), money(S.rate.rev * 60));
    const era = E.eraAt(d.y);
    setText($('#eraName'), era.name);
    if (eraShown && eraShown !== era.name) toast('🕰️ <b>New era: ' + esc(era.name) + '</b><br><small>' + esc(era.blurb) + '</small>', 5000);
    eraShown = era.name;
    applyTheme();
    const pend = E.pendingTokens(S);
    const showHQ = S.meta.resets > 0 || S.meta.tokens > 0 || pend > 0 || S.cal >= 20;
    $('#nav-franchise').hidden = !showHQ;
    $('#nav-buyers').hidden = !(d.office || d.y >= CS.UP_BY_ID.purchasing.year);
    $('#tokStat').hidden = !(S.meta.tokens > 0 || pend > 0);
    setText($('#tokens'), '🎫 ' + num(S.meta.tokens) + (pend > 0 ? ' (+' + num(pend) + ')' : ''));
    if (pend >= 1 && !S.seen.tok) {
      S.seen.tok = 1;
      newHQ = true;
      toast('🎫 <b>Franchise Tokens are available!</b><br><small>Open the HQ tab to cash them in for permanent upgrades.</small>', 6000);
    }
    $('#badge-franchise').hidden = !newHQ;
    $('#badge-catalog').hidden = !newStock;
    $('#badge-upgrades').hidden = !newUp;
  }
  let headlineI = 0;
  function nextHeadline() {
    const d = E.derive(S);
    const th = document.body.dataset.theme;
    const pool = (CS.HEADLINES[th] || CS.HEADLINES.win95).slice();
    d.ev.list.forEach((e) => { pool.push(e.text, e.text); });
    $('#tickerText').textContent = '📰 ' + pool[(headlineI++ + Math.floor(Math.random() * pool.length)) % pool.length];
  }

  /* ---------- announcements ---------- */
  function announceNew(silent) {
    const prods = E.newProducts(S);
    if (prods.length) {
      newStock = true;
      if (!silent) toast('🆕 <b>New model available</b><br>' + prods.slice(0, 3).map((p) => esc(p.brand + ' ' + p.name)).join('<br>') + (prods.length > 3 ? '<br>+' + (prods.length - 3) + ' more' : ''), 4500);
    }
    const y = E.yearOf(S);
    CS.UPGRADES.forEach((u) => {
      const k = 'u:' + u.id;
      if (y >= u.year && !S.seen[k]) {
        S.seen[k] = 1;
        if (u.year > C.START_YEAR || u.req) {
          newUp = true;
          if (!silent) toast('🔓 <b>Unlocked: ' + esc(u.name) + '</b>', 4000);
        }
      }
    });
  }
  function announceAch(list) {
    if (list && list.length) list.slice(0, 2).forEach((a) => toast('🏆 <b>' + esc(a.name) + '</b><br><small>' + esc(a.desc) + ' (+1% customers)</small>', 4000));
  }

  /* ---------- welcome back ---------- */
  function showWelcome(rep) {
    const top = Object.keys(rep.sold).sort((a, b) => rep.sold[b] - rep.sold[a]).slice(0, 4);
    const net = rep.cash1 - rep.cash0;
    let h = `<p>Your shop kept trading while you were away for <b>${dur(rep.elapsed)}</b>.</p><table class="rep">
      <tr><td>Time worked</td><td>${dur(rep.effective)}</td></tr>
      <tr><td>Calendar</td><td>${E.dateStr(rep.year0)} → ${E.dateStr(rep.year1)}</td></tr>
      <tr><td>Computers sold</td><td>${num(rep.units)}</td></tr>
      <tr><td>Sales revenue</td><td class="good">${money(rep.revenue)}</td></tr>
      <tr><td>Stock & parts bought</td><td>${money(rep.spent)}</td></tr>
      <tr><td>Wages & rent</td><td>${money(rep.upkeep)}</td></tr>
      ${rep.built ? `<tr><td>Computers built</td><td>${num(rep.built)}</td></tr>` : ''}
      <tr><td><b>Net cash change</b></td><td class="${net >= 0 ? 'good' : 'bad'}">${net >= 0 ? '+' : ''}${money(net)}</td></tr></table>`;
    if (top.length) h += '<p><b>Best sellers</b><br>' + top.map((k) => esc(rep.names[k]) + ' ×' + num(rep.sold[k])).join('<br>') + '</p>';
    if (rep.capped) h += `<p class="warn">⏰ The shop can only run unattended for ${rep.cap / 3600}h. Upgrade <b>Night Lock-Up & Cameras</b> to earn longer while you sleep.</p>`;
    if (rep.stockouts >= 1) h += `<p class="warn">📦 About ${num(rep.stockouts)} customers found empty shelves. Raise your auto-restock targets before you leave.</p>`;
    if (rep.busy >= 1) h += `<p class="warn">🚶 About ${num(rep.busy)} customers left because checkout was too slow.</p>`;
    if (rep.bailouts) h += '<p class="warn">🏦 You ran out of money; the bank lent you restocking cash.</p>';
    modal('Welcome back!', h, [{ label: 'Back to work', cls: 'primary' }]);
  }

  /* ---------- actions (delegated) ---------- */
  function hustle() {
    const r = E.hustle(S);
    const hb = $('#hustle');
    if (!r) return;
    if (r.none) { toast('Nothing in stock to sell! Visit the Stock tab.'); return; }
    if (r.passed) { floatText(hb, 'Just browsing…', 40); spawnWalker(false); return; }
    floatText(hb, '+' + money(r.rev), 42);
    spawnWalker(true);
    logSale((r.units > 1 ? '🏢 Business order: ' + r.units + '× ' : 'Hustled: ') + r.sold.name + (r.extras && r.extras.length ? ' + ' + r.extras.length + ' add-on' + (r.extras.length > 1 ? 's' : '') : '') + (r.streak > 1 ? ' 🔥' + r.streak : ''), r.rev);
    announceAch(E.checkAch(S));
  }
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]');
    if (!t || t.disabled) return;
    const act = t.dataset.act;
    const card = t.closest('.card');
    switch (act) {
      case 'hustle': hustle(); break;
      case 'buy': E.buy(S, card.dataset.key, t.dataset.n === 'max' ? 'max' : +t.dataset.n); break;
      case 'tgt': {
        const key = card.dataset.key || 'b:' + card.dataset.id;
        const items = E.getItems(S, E.derive(S));
        const it = items.find((i) => i.key === key);
        if (it) {
          const step = it.pack || 1;
          const big = it.target >= 10 * step ? 5 * step : step;
          E.setTarget(S, key, it.target + (+t.dataset.d) * big);
        }
        break;
      }
      case 'advtoggle': try { localStorage.setItem('csig-adv', advOpen() ? '0' : '1'); } catch (e) { /* ignore */ } break;
      case 'catfilter': catFilter = t.dataset.f; break;
      case 'mghire': { const r = M.hire(S, t.dataset.cat, +t.dataset.idx); if (!r.ok) toast(esc(r.err)); else { toast('👔 Hired!'); announceAch(E.checkAch(S)); } break; }
      case 'mgrefresh': M.refresh(S, t.dataset.cat); break;
      case 'mgcollapse': setMgCol(t.dataset.cat, !mgCol[t.dataset.cat]); break;
      case 'mgcollapseall': CS.MGR_CATS.forEach((c) => setMgCol(c.id, t.dataset.v === '1')); break;
      case 'mgtrain': M.train(S, t.dataset.cat, t.dataset.skill); break;
      case 'mgfire': confirmFire(t.dataset.cat); break;
      case 'mgpin': case 'mgskip': {
        const key = card.dataset.key;
        const it = E.getItems(S, E.derive(S)).find((i) => i.key === key);
        if (it && it.mgrCat) { const want = act === 'mgpin' ? 'pin' : 'skip'; M.setPin(S, it.mgrCat, key, it.pin === want ? '' : want); }
        break;
      }
      case 'mcchip': {
        const [cat, k] = t.dataset.mc.split(':');
        const cur = M.cfgOf(S, cat)[k].slice();
        const i = cur.indexOf(t.dataset.v);
        if (i >= 0) cur.splice(i, 1); else cur.push(t.dataset.v);
        M.setCfg(S, cat, k, cur);
        break;
      }
      case 'fchip': fset(t.dataset.flt, t.dataset.v); break;
      case 'up': E.buyUp(S, t.dataset.id); break;
      case 'tup': E.buyTokenUp(S, t.dataset.id); break;
      case 'claim': claimTokens(); break;
      case 'upmax': for (let i = 0; i < 200 && E.buyUp(S, t.dataset.id); i++); break;
      case 'bpCreate': {
        const r = E.createBp(S, design.name.trim() || 'Custom PC', design.parts, design.markup);
        if (r.ok) { toast('🛠️ Blueprint saved: <b>' + esc(r.bp.name) + '</b><br><small>Set an auto-build target to start production.</small>'); announceAch(E.checkAch(S)); }
        else toast(esc(r.err));
        break;
      }
      case 'changelog': modal("What's new — v" + verStr(), changelogHtml((BOOT.changelog || []).filter((e) => typeof e.build === 'number').slice(0, 8)), [{ label: 'Close' }]); break;
      case 'bpTake': if (M.takeOver(S, t.dataset.id)) toast('✋ ' + esc((S.bps.find((b) => b.id === t.dataset.id) || {}).name || 'Blueprint') + ' is yours now.'); break;
      case 'bpDel': if (!E.deleteBp(S, t.dataset.id)) toast('Sell the remaining stock first.'); break;
      case 'save': save().then(() => toast(sync.state === 'ok' ? '☁️ Saved to your account' : '⚠️ Saved on this device only; server unreachable')); break;
      case 'logout': save().then(() => $('#logoutForm').submit()); break;
      case 'export': exportSave(); break;
      case 'import': importSave(); break;
      case 'reset': resetGame(); break;
    }
    advCache.at = 0;
    render(true);
  });
  function onMcInput(e) {
    const t = e.target;
    if (!t.dataset || !t.dataset.mc || t.classList.contains('mcchips')) return;
    const [cat, k] = t.dataset.mc.split(':');
    let v;
    if (t.type === 'checkbox') v = t.checked;
    else if (t.type === 'range') v = parseFloat(t.value);
    else if (t.tagName === 'SELECT') v = t.value;
    else if (t.dataset.txt) v = String(t.value).replace(/[^\w \-']/g, '').slice(0, 12);
    else v = Math.max(0, parseFloat(String(t.value).replace(/[^0-9.]/g, '')) || 0);
    M.setCfg(S, cat, k, v);
    if (k === 'preset' || k === 'on') render(true);
    else if (e.type === 'change') render(true);
  }
  document.addEventListener('input', onMcInput);
  document.addEventListener('change', onMcInput);
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset && t.dataset.flt && (t.tagName === 'SELECT' || t.tagName === 'INPUT')) { fset(t.dataset.flt, t.value); render(true); return; }
    if (t.classList && t.classList.contains('mk')) {
      const bp = S.bps.find((b) => b.id === t.dataset.bp);
      if (bp) bp.markup = +t.value / 100;
    }
  });
  $('#nav').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tab]');
    if (b) switchTab(b.dataset.tab);
  });

  function confirmFire(cat) {
    const mg = S.mgr[cat];
    if (!mg) return;
    const sev = Math.round(mg.wage * M.wageInfl(E.yearOf(S)) * 3600);
    modal('Let ' + mg.name + ' go?', `<p>Severance is <b>${money(sev)}</b> (one hour of wages). Your settings for this category are kept for the next buyer, and items stay stocked as they are, but nobody will plan or order them until you hire someone.</p>`, [
      { label: 'Let them go', cls: 'danger', fn: () => { const r = M.fire(S, cat); if (!r.ok) { toast(esc(r.err || 'Cannot do that.')); return false; } } },
      { label: 'Keep them' },
    ]);
  }
  function exportSave() {
    save();
    const code = encode(E.serialize(S));
    const m = modal('Export save', '<small>Copy this code and keep it somewhere safe. Use <b>Import</b> on any device to restore it.</small><textarea id="expTxt" readonly></textarea>', [
      { label: 'Copy', cls: 'primary', fn: () => { const t = $('#expTxt'); t.select(); try { navigator.clipboard.writeText(code); } catch (e) { document.execCommand('copy'); } toast('📋 Copied!'); return false; } },
      { label: 'Close' },
    ]);
    $('#expTxt', m).value = code;
  }
  function importSave() {
    modal('Import save', '<small>Paste a save code. This <b>replaces</b> your current shop.</small><textarea id="impTxt" placeholder="Paste save code here"></textarea>', [
      {
        label: 'Import', cls: 'primary', fn: () => {
          try {
            const s = E.deserialize(decode($('#impTxt').value));
            noSave = true;
            post('save', { state: E.serialize(s), rev, force: true }).then((j) => {
              if (j.ok) { clearLocal(true); location.reload(); } else { noSave = false; toast('❌ The server rejected that save (' + esc(j.error || j.status) + ').'); }
            }).catch(() => { noSave = false; toast('❌ Could not reach the server.'); });
          } catch (err) {
            toast('❌ That save code is not valid.');
            return false;
          }
        },
      },
      { label: 'Cancel' },
    ]);
  }
  function resetGame() {
    modal('Erase everything?', '<p>This permanently deletes your shop <b>and</b> your Franchise Tokens, HQ upgrades and trophies, and starts over in 1993. (To restart a shop but keep your tokens, use the HQ tab.) Export your save first if you might want it back.</p>', [
      { label: 'Delete everything', cls: 'danger', fn: () => { noSave = true; post('reset', {}).then((j) => { if (j.ok) { clearLocal(true); location.reload(); } else { noSave = false; toast('❌ Could not reset (' + esc(j.error || j.status) + ').'); } }).catch(() => { noSave = false; toast('❌ Could not reach the server.'); }); return false; } },
      { label: 'Cancel' },
    ]);
  }

  /* ---------- render & loop ---------- */
  let lastRender = 0;
  function render(force) {
    const now = performance.now();
    if (!force && now - lastRender < 200) return;
    lastRender = now;
    const d = E.derive(S);
    const items = E.getItems(S, d);
    renderHeader(d);
    switch (tab) {
      case 'shop': renderShop(d, items); break;
      case 'catalog': renderCatalog(d, items); break;
      case 'buyers': renderBuyers(d, items); break;
      case 'workshop': renderWorkshop(d, items); break;
      case 'upgrades': renderUpgrades(d); break;
      case 'franchise': renderFranchise(d); break;
      case 'menu': renderMenu(d); break;
    }
  }

  let last = Date.now();
  function goOffline(sec) {
    const rep = E.offline(S, sec);
    announceAch(rep.ach);
    announceNew(false);
    if (sec >= 60 && (rep.units > 0 || rep.upkeep > 0 || rep.built > 0)) showWelcome(rep);
    last = Date.now();
    save();
  }
  function tick() {
    if (document.hidden) return; // throttled timers would turn a background tab into many 1-minute offline sessions
    const now = Date.now();
    let dt = (now - last) / 1000;
    last = now;
    if (dt <= 0) return;
    if (dt > 10) { goOffline(dt); render(true); return; }
    const events = [];
    const ach = E.step(S, dt, 1, null, events);
    announceAch(ach);
    if (events.length) {
      const agg = {};
      events.forEach((ev) => {
        if (ev.bailout) { toast('🏦 Out of cash! The bank lent you <b>' + money(ev.bailout) + '</b> to restock.'); return; }
        const addon = E.isAddon(ev.it.kind);
        const key = addon ? 'addons' : ev.it.key;
        const a = agg[key] || (agg[key] = { name: addon ? 'Games & accessories' : ev.it.name, k: 0, rev: 0, addon });
        a.k += ev.k; a.rev += ev.rev;
      });
      Object.values(agg).forEach((a) => {
        logSale((a.k > 1 ? a.k + '× ' : '') + a.name, a.rev);
        if (!a.addon) for (let i = 0; i < Math.min(a.k, 2); i++) spawnWalker(true);
      });
    }
    if (tab === 'shop' && Math.random() < Math.min(0.5, E.derive(S).lambda * dt * 0.6)) spawnWalker(false);
    if (Math.floor(S.cal * 4) !== Math.floor((S.cal - dt / C.YEAR_SECONDS) * 4)) announceNew(false);
    render();
  }

  /* ---------- init ---------- */
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function chooseState() {
    // Returns {state, elapsed, force}. The server clock decides offline time; a newer local backup (failed sync) can win.
    let server = BOOT.state ? E.migrate(BOOT.state) : null;
    const local = readLocal();
    const legacy = server ? null : legacyLocal();
    if (server && local && local.saved > server.saved + 2000) {
      // The previous page's unload save may still have been in flight when this page loaded: look again before asking.
      await sleep(1500);
      try {
        const j = await post('load', {});
        if (j.ok && j.state) { server = E.migrate(j.state); rev = j.rev; BOOT.elapsed = j.elapsed; }
      } catch (e) { /* offline: fall through to the prompt */ }
    }
    if (server && local && local.saved > server.saved + 2000) {
      return new Promise((resolve) => {
        modal('Newer progress found', '<p>This device holds a newer copy of your shop (' + new Date(local.saved).toLocaleString() + ') than your account (' + new Date(server.saved).toLocaleString() + '), probably from a dropped connection. Which should be used?</p>', [
          { label: 'Use newer (this device)', cls: 'primary', fn: () => resolve({ state: local, elapsed: Math.min(BOOT.elapsed, (Date.now() - local.saved) / 1000), force: true }) },
          { label: 'Use account copy', fn: () => { clearLocal(false); resolve({ state: server, elapsed: BOOT.elapsed }); } },
        ]);
      });
    }
    if (server) return { state: server, elapsed: BOOT.elapsed };
    const seed = legacy || local;
    if (seed) {
      toast('📥 Imported the shop saved in this browser into your account.', 5000);
      return { state: seed, elapsed: (Date.now() - seed.saved) / 1000, force: true };
    }
    return { state: E.newState(), elapsed: 0 };
  }

  function init() {
    chooseState().then((c) => {
      S = c.state;
      announceNew(true); // silently mark what already exists
      buildShop(); buildCatalog(); buildBuyers(); buildWorkshop(); buildUpgrades(); buildFranchise(); buildMenu();
      applyTheme(true);
      eraShown = E.eraAt(E.yearOf(S)).name;
      last = Date.now();
      forceNext = c.force === true;
      if (c.elapsed > 10) goOffline(c.elapsed);
      else save();
      nextHeadline();
      $('#tickerText').addEventListener('animationiteration', nextHeadline);
      switchTab('shop');
      maybeShowWhatsNew(S.stats.play > 120);
      setInterval(tick, 250);
      setInterval(() => { if (!document.hidden) save(); }, 15000);
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) { hiddenAt = Date.now(); save(); } else { hiddenAt = 0; tick(); } // tick catches up the whole hidden time at once
      });
      window.addEventListener('pagehide', beaconSave);
      if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register(BOOT.base + '/sw.js').catch(() => {});
      window.CS_DEBUG = { get state() { return S; }, save, E };
    });
  }
  init();
})();
