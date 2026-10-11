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
    const i = Math.min(SUF.length - 1, Math.floor(Math.log10(a) / 3));
    const v = n / Math.pow(10, i * 3);
    return v.toFixed(Math.abs(v) < 10 ? 2 : Math.abs(v) < 100 ? 1 : 0) + SUF[i];
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

  /* ---------- persistence ---------- */
  let S, noSave = false;
  const BAK = C.SAVE_KEY + '-bak';
  let saveCount = 0;
  function save() {
    if (noSave || !S) return;
    S.saved = Date.now();
    try {
      const str = E.serialize(S);
      localStorage.setItem(C.SAVE_KEY, str);
      if (++saveCount % 8 === 1) localStorage.setItem(BAK, str);
    } catch (e) { /* storage blocked or full: keep playing */ }
  }
  function load() {
    for (const k of [C.SAVE_KEY, BAK]) {
      try {
        const str = localStorage.getItem(k);
        if (str) return E.deserialize(str);
      } catch (e) { /* try backup */ }
    }
    return null;
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
  let newStock = false, newUp = false;
  function switchTab(name) {
    tab = name;
    $$('.tab').forEach((t) => (t.hidden = t.id !== 'tab-' + name));
    $$('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.tab === name));
    if (name === 'catalog') newStock = false;
    if (name === 'upgrades') newUp = false;
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
      <div class="panel"><div class="title">Shop Report</div><div class="pbody"><div class="grid" id="statGrid"></div></div></div>
      <div class="panel"><div class="title">Recent Sales</div><div class="pbody"><ul id="log"></ul></div></div>
      <div class="panel"><div class="title">The Times</div><div class="pbody" id="times"></div></div>`;
    const defs = [
      ['cust', 'Customers / min'], ['serve', 'Checkout capacity / min'], ['sell', 'Revenue / min'],
      ['rest', 'Auto-restock / min'], ['up', 'Wages & rent / min'], ['lost', 'Walk-outs (busy)'],
      ['sold', 'Computers sold'], ['built', 'Computers built'],
    ];
    const grid = $('#statGrid');
    shopRefs = { cells: {} };
    defs.forEach(([id, label]) => {
      const m = node(`<div class="mini"><small>${label}</small><b class="num">–</b></div>`);
      grid.appendChild(m);
      shopRefs.cells[id] = $('b', m);
    });
  }
  function spawnWalker(buy) {
    const st = $('#street');
    if (!st || tab !== 'shop' || st.children.length > 6) return;
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
    setText($('#hustleTxt'), S.hustleCd > 0 ? '🤝 Hustling… ' + Math.ceil(S.hustleCd) + 's' : '🤝 Hustle a customer');
    $('#hbar').style.width = (S.hustleCd > 0 ? 100 * (1 - S.hustleCd / 3) : 0) + '%';
    setDis(hb, S.hustleCd > 0);

    // alerts
    const al = [];
    const active = items.filter((i) => i.stock > 0).length;
    if (S.stats.sold === 0 && total === 0) al.push(['warn', '👋 Welcome! Open the <b>Stock</b> tab, buy a computer, then hit <b>Hustle</b> to sell it. Set an <b>auto-restock</b> target once you hire a Stock Clerk (Upgrades).']);
    else if (!active) al.push(['bad', '🚫 Shelves are empty — customers are walking out! Restock in the Stock tab.']);
    else if (d.lambda > d.serve * 1.05) al.push(['warn', '⏳ Customers are waiting in line (' + d.lambda.toFixed(2) + '/s arriving vs ' + d.serve.toFixed(2) + '/s served). Upgrade checkout or hire sales staff.']);
    if (total >= d.cap) al.push(['warn', '📦 Shelves are full. Expand the shop floor to stock more.']);
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

    if (logDirty) {
      setHtml($('#log'), logLines.length ? logLines.map((l) => `<li><span>${esc(l.text)}</span><b class="good num">${l.amt ? '+' + money(l.amt) : ''}</b></li>`).join('') : '<li><small>No sales yet.</small></li>');
      logDirty = false;
    }
    const era = E.eraAt(d.y);
    let t = `<div><b>${esc(era.name)}</b> <small>(${era.from}+)</small></div><div>${esc(era.blurb)}</div>`;
    d.ev.list.forEach((e) => (t += `<div class="warn">📣 <b>${esc(e.name)}</b> — ${esc(e.text)}</div>`));
    if (S.cal >= C.END_CAL) t += '<div class="good">🎉 You made it to <b>today</b>! The calendar stops here — keep growing your empire.</div>';
    setHtml($('#times'), t);
  }

  /* ---------- STOCK tab ---------- */
  function buildCatalog() {
    $('#tab-catalog').innerHTML = `
      <div class="panel"><div class="title"><span>Stock Room</span><span id="catCap" class="num"></span></div>
        <div class="pbody">
          <div class="bar"><i id="catBar"></i></div>
          <div class="field"><label><span>Pricing policy (prebuilt PCs)</span><b id="priceLbl"></b></label>
            <input type="range" id="priceAdj" min="-20" max="30" step="5"></div>
          <small id="clerkNote"></small>
        </div></div>
      <div class="list two" id="catList"></div>`;
    $('#priceAdj').addEventListener('input', (e) => { S.priceAdj = +e.target.value / 100; });
  }
  function ageTag(it) {
    if (!it.buyable) return 'Clearance';
    if (it.age < 0.7) return 'New!';
    if (it.age > 4) return 'Old stock';
    if (it.age > 2) return 'Aging';
    return 'Current';
  }
  function createItemCard(it) {
    const el = node(`<div class="card" data-key="${it.key}">
      <div class="icon">${it.icon}</div>
      <div class="info"><b class="nm"></b><small class="sub"></small>
        <div class="tags"><span class="tag t-age"></span><span class="tag t-perf"></span></div>
        <div class="nums"><span>Price <b class="pp num"></b></span><span>Cost <b class="cc num"></b></span><span>Profit <b class="pf num good"></b></span></div>
        <div>In stock: <b class="stk num"></b></div></div>
      <div class="acts">
        <button data-act="buy" data-n="1">Buy 1</button><button data-act="buy" data-n="5">+5</button><button data-act="buy" data-n="max">Max</button>
        <div class="stepper"><span class="lbl">Auto-restock to</span>
          <button data-act="tgt" data-d="-1">−</button><b class="tg num">0</b><button data-act="tgt" data-d="1">+</button></div>
      </div></div>`);
    const r = (s) => $(s, el);
    const refs = { el, nm: r('.nm'), sub: r('.sub'), age: r('.t-age'), perf: r('.t-perf'), pp: r('.pp'), cc: r('.cc'), pf: r('.pf'), stk: r('.stk'), tg: r('.tg'), lbl: r('.lbl'), btns: $$('button', el) };
    return refs;
  }
  function updateItemCard(n, it, d, clerk) {
    setText(n.nm, (it.brand ? it.brand + ' ' : '') + it.name);
    setText(n.sub, it.def.year + (it.kind === 'pre' ? ' model' : ''));
    setText(n.age, ageTag(it));
    n.age.classList.toggle('new', it.age < 0.7 && it.buyable);
    setText(n.perf, 'Performance ' + Math.round(it.rel * 100) + '%');
    setText(n.pp, money(it.price));
    setText(n.cc, money(it.cost));
    setText(n.pf, money(it.price - it.cost) + ' (' + Math.round(((it.price - it.cost) / it.price) * 100) + '%)');
    setText(n.stk, String(it.stock));
    setText(n.tg, String(it.target));
    setText(n.lbl, clerk ? 'Auto-restock to' : '🔒 Needs Stock Clerk');
    const room = d.cap - E.totalStock(S);
    n.btns.forEach((b) => {
      if (b.dataset.act === 'buy') setDis(b, !it.buyable || S.cash < it.cost || room < 1);
      else setDis(b, !clerk || !it.buyable);
    });
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
    const pre = items.filter((i) => i.kind === 'pre').sort((a, b) => (b.buyable - a.buyable) || b.def.year - a.def.year || b.price - a.price);
    syncList($('#catList'), pre, (i) => i.key, createItemCard, (n, it) => updateItemCard(n, it, d, clerk));
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
    const el = node(`<div class="card" data-id="${bp.id}">
      <div class="icon">🛠️</div>
      <div class="info"><b class="nm"></b><small class="spec"></small>
        <div class="tags"><span class="tag t-perf"></span><span class="tag t-warn" hidden>⚠ Parts discontinued</span></div>
        <div class="nums"><span>Cost <b class="cc num"></b></span><span>Price <b class="pp num"></b></span><span>Profit <b class="pf num good"></b></span></div>
        <div>In stock: <b class="stk num"></b></div>
        <div class="field"><label><span>Markup</span><b class="mkl"></b></label><input type="range" class="mk" min="0" max="150" step="5" data-bp="${bp.id}"></div>
      </div>
      <div class="acts">
        <div class="stepper"><span class="lbl">Auto-build to</span><button data-act="tgt" data-d="-1">−</button><b class="tg num">0</b><button data-act="tgt" data-d="1">+</button></div>
        <button data-act="bpDel" data-id="${bp.id}" class="small">Delete</button>
      </div></div>`);
    const r = (s) => $(s, el);
    return { el, nm: r('.nm'), spec: r('.spec'), perf: r('.t-perf'), warn: r('.t-warn'), cc: r('.cc'), pp: r('.pp'), pf: r('.pf'), stk: r('.stk'), tg: r('.tg'), mk: r('.mk'), mkl: r('.mkl'), del: r('[data-act=bpDel]'), btns: $$('[data-act=tgt]', el) };
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

    const bps = items.filter((i) => i.kind === 'bp');
    syncList($('#bpList'), bps, (i) => i.id, (i) => createBpCard(i.def), (n, it) => {
      const bp = it.def;
      setText(n.nm, bp.name);
      setText(n.spec, CS.SLOTS.map((sl) => CS.PART_BY_ID[bp.parts[sl.id]].name).join(' · '));
      setText(n.perf, 'Performance ' + Math.round(it.rel * 100) + '%');
      n.warn.hidden = it.canBuild;
      setText(n.cc, money(it.cost)); setText(n.pp, money(it.price));
      setText(n.pf, money(it.price - it.cost));
      setText(n.stk, String(it.stock)); setText(n.tg, String(it.target));
      setText(n.mkl, '+' + Math.round(bp.markup * 100) + '%');
      if (document.activeElement !== n.mk) n.mk.value = Math.round(bp.markup * 100);
      setDis(n.del, it.stock > 0);
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
  const GROUPS = ['Marketing', 'Checkout', 'Stock', 'Shop', 'Workshop'];
  function buildUpgrades() {
    $('#tab-upgrades').innerHTML = `
      <div class="panel"><div class="title">Shop Overview</div><div class="pbody"><div class="grid" id="upSum"></div><small id="upHint"></small></div></div>` +
      GROUPS.map((g) => `<h3 class="sec">${g}</h3><div class="list two" id="upl-${g}"></div>`).join('');
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
      case 'loyal': return '+' + Math.round(v * 100) + '% customers';
      case 'night': return '+' + v + 'h offline';
      case 'serveMult': case 'buildMult': return '+' + Math.round(v * 100) + '%';
      case 'bench': return '+' + v + ' slots';
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
    const bottleneck = d.lambda > d.serve * 1.05 ? 'Checkout is your bottleneck: customers are leaving. Upgrade checkout!' : d.serve > d.lambda * 1.5 ? 'Checkout has spare capacity — more marketing will pay off.' : 'Marketing and checkout are well balanced.';
    setText($('#upHint'), bottleneck);
    GROUPS.forEach((g) => {
      const list = CS.UPGRADES.filter((u) => u.grp === g && d.y >= u.year - 2 && !(u.req && !S.up[u.req] && d.y < u.year));
      syncList($('#upl-' + g), list, (u) => u.id, createUpCard, (n, u) => {
        const L = E.upLevel(S, u.id);
        const unlocked = E.upUnlocked(S, u);
        const maxed = L >= u.max;
        n.el.classList.toggle('lockedcard', !unlocked);
        setText(n.lv, u.max === 1 ? (L ? '✔' : '') : 'Lv ' + L + (u.max < 999 ? '/' + u.max : ''));
        setText(n.now, L && u.max > 1 ? 'Now: ' + upNow(u, L) : '');
        setText(n.req, !unlocked ? (d.y < u.year ? '🔒 Available in ' + u.year : '🔒 Requires ' + CS.UP_BY_ID[u.req].name) : '');
        const cost = E.upCost(S, u);
        setText(n.buy, maxed ? 'MAX' : (u.max === 1 ? 'Build — ' : 'Buy — ') + money(cost));
        setDis(n.buy, !unlocked || maxed || S.cash < cost);
        n.max.hidden = u.max === 1;
        setDis(n.max, !unlocked || maxed || S.cash < cost);
      });
    });
  }

  /* ---------- MENU tab ---------- */
  function buildMenu() {
    $('#tab-menu').innerHTML = `
      <div class="panel"><div class="title">Shop Settings</div><div class="pbody">
        <div class="field"><label><span>Shop name</span></label><input type="text" id="nameIn" maxlength="30"></div>
        <div class="field"><label><span>Visual theme</span></label>
          <select id="themeSel"><option value="auto">Automatic (follows the era)</option><option value="win95">Windoze 95 (1993–99)</option><option value="xp">Bliss (2000–08)</option><option value="flat">Flat (2009–16)</option><option value="rgb">RGB (2017+)</option></select></div>
      </div></div>
      <div class="panel"><div class="title">Save Data</div><div class="pbody">
        <small id="saveInfo">The game saves automatically every few seconds and when you leave the page. While you are away the shop keeps trading (up to your offline limit).</small>
        <div class="menu-btns">
          <button data-act="save">💾 Save now</button><button data-act="export">📤 Export</button><button data-act="import">📥 Import</button><button data-act="reset" class="danger">🗑️ Reset</button>
        </div></div></div>
      <div class="panel"><div class="title">Statistics</div><div class="pbody" id="statsBody"></div></div>
      <div class="panel"><div class="title"><span>Trophies</span><span id="achCount"></span></div><div class="pbody" id="achBody"></div></div>
      <div class="panel"><div class="title">About</div><div class="pbody"><small>Idle computer shop, 1993 → today. Every brand and product name is a made-up parody; this game is not affiliated with or endorsed by any real company. Offline progress is capped by your shop's Night Lock-Up, and the calendar crawls at 1/20 speed while you are away.</small></div></div>`;
    $('#nameIn').addEventListener('input', (e) => { S.name = e.target.value.slice(0, 30) || 'Mega Byte Computers'; });
    $('#themeSel').addEventListener('change', (e) => { S.settings.theme = e.target.value; applyTheme(true); });
  }
  function renderMenu(d) {
    if (document.activeElement !== $('#nameIn')) $('#nameIn').value = S.name;
    $('#themeSel').value = S.settings.theme;
    const st = S.stats;
    setHtml($('#statsBody'), `<table class="rep">
      <tr><td>Calendar</td><td>${E.dateStr(d.y)}</td></tr>
      <tr><td>Time played</td><td>${dur(st.play)}</td></tr>
      <tr><td>Time earning while away</td><td>${dur(st.offline)}</td></tr>
      <tr><td>Lifetime sales</td><td>${money(st.revenue)}</td></tr>
      <tr><td>Computers sold</td><td>${num(st.sold)}</td></tr>
      <tr><td>Computers built</td><td>${num(st.built)}</td></tr>
      <tr><td>Hustles</td><td>${num(st.hustles)}</td></tr>
      <tr><td>Offline limit</td><td>${d.offlineCap / 3600}h</td></tr></table>`);
    const got = CS.ACH.filter((a) => S.ach[a.id]).length;
    setText($('#achCount'), got + ' / ' + CS.ACH.length + ' (+' + got + '% customers)');
    setHtml($('#achBody'), CS.ACH.map((a) => `<div class="ach ${S.ach[a.id] ? '' : 'locked'}"><span>${S.ach[a.id] ? '🏆' : '🔒'}</span><div><b>${esc(a.name)}</b><br><small>${esc(a.desc)}</small></div></div>`).join(''));
  }

  /* ---------- theme / header ---------- */
  let curTheme = '';
  function applyTheme(force) {
    const era = E.eraAt(E.yearOf(S));
    const th = S.settings.theme === 'auto' ? era.theme : S.settings.theme;
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
    setText($('#date'), E.dateStr(d.y));
    setText($('#cash'), money(S.cash));
    setText($('#income'), money(S.rate.rev * 60));
    const era = E.eraAt(d.y);
    setText($('#eraName'), era.name);
    if (eraShown && eraShown !== era.name) toast('🕰️ <b>New era: ' + esc(era.name) + '</b><br><small>' + esc(era.blurb) + '</small>', 5000);
    eraShown = era.name;
    applyTheme();
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
    logSale('Hustled: ' + r.sold.name, r.rev);
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
          const big = it.target >= 10 ? 5 : 1;
          E.setTarget(S, key, it.target + (+t.dataset.d) * big);
        }
        break;
      }
      case 'up': E.buyUp(S, t.dataset.id); break;
      case 'upmax': for (let i = 0; i < 200 && E.buyUp(S, t.dataset.id); i++); break;
      case 'bpCreate': {
        const r = E.createBp(S, design.name.trim() || 'Custom PC', design.parts, design.markup);
        if (r.ok) { toast('🛠️ Blueprint saved: <b>' + esc(r.bp.name) + '</b><br><small>Set an auto-build target to start production.</small>'); announceAch(E.checkAch(S)); }
        else toast(esc(r.err));
        break;
      }
      case 'bpDel': if (!E.deleteBp(S, t.dataset.id)) toast('Sell the remaining stock first.'); break;
      case 'save': save(); toast('💾 Saved!'); break;
      case 'export': exportSave(); break;
      case 'import': importSave(); break;
      case 'reset': resetGame(); break;
    }
    render(true);
  });
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.classList && t.classList.contains('mk')) {
      const bp = S.bps.find((b) => b.id === t.dataset.bp);
      if (bp) bp.markup = +t.value / 100;
    }
  });
  $('#nav').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tab]');
    if (b) switchTab(b.dataset.tab);
  });

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
            localStorage.setItem(C.SAVE_KEY, E.serialize(s));
            location.reload();
          } catch (err) {
            noSave = false;
            toast('❌ That save code is not valid.');
            return false;
          }
        },
      },
      { label: 'Cancel' },
    ]);
  }
  function resetGame() {
    modal('Reset game?', '<p>This permanently deletes your shop and starts over in 1993. Export your save first if you might want it back.</p>', [
      { label: 'Delete everything', cls: 'danger', fn: () => { noSave = true; try { localStorage.removeItem(C.SAVE_KEY); localStorage.removeItem(BAK); } catch (e) { /* ignore */ } location.reload(); } },
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
      case 'workshop': renderWorkshop(d, items); break;
      case 'upgrades': renderUpgrades(d); break;
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
        const a = agg[ev.it.key] || (agg[ev.it.key] = { name: ev.it.name, k: 0, rev: 0 });
        a.k += ev.k; a.rev += ev.rev;
      });
      Object.values(agg).forEach((a) => {
        logSale((a.k > 1 ? a.k + '× ' : '') + a.name, a.rev);
        for (let i = 0; i < Math.min(a.k, 2); i++) spawnWalker(true);
      });
    }
    if (tab === 'shop' && Math.random() < Math.min(0.5, E.derive(S).lambda * dt * 0.6)) spawnWalker(false);
    if (Math.floor(S.cal * 4) !== Math.floor((S.cal - dt / C.YEAR_SECONDS) * 4)) announceNew(false);
    render();
  }

  /* ---------- init ---------- */
  function init() {
    S = load() || E.newState();
    announceNew(true); // silently mark what already exists
    buildShop(); buildCatalog(); buildWorkshop(); buildUpgrades(); buildMenu();
    applyTheme(true);
    const elapsed = Math.max(0, (Date.now() - S.saved) / 1000);
    eraShown = E.eraAt(E.yearOf(S)).name;
    last = Date.now();
    if (elapsed > 10) goOffline(elapsed);
    nextHeadline();
    $('#tickerText').addEventListener('animationiteration', nextHeadline);
    switchTab('shop');
    setInterval(tick, 250);
    setInterval(save, 10000);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) save();
      else tick();
    });
    window.addEventListener('pagehide', save);
    window.addEventListener('beforeunload', save);
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
    window.CS_DEBUG = { get state() { return S; }, save, E };
  }
  init();
})();
