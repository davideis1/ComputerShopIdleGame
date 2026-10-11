/* End-to-end check of the PHP backend:  node tools/api-smoke.js http://localhost:8124
   Needs a running server + database (see README). Creates and deletes a throwaway user. */
const base = (process.argv[2] || 'http://localhost:8124').replace(/\/$/, '');
let cookie = '';
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
async function req(path, opts = {}) {
  const r = await fetch(base + path, Object.assign({ redirect: 'manual', headers: {} }, opts, { headers: Object.assign({ cookie }, opts.headers || {}) }));
  const sc = r.headers.get('set-cookie');
  if (sc) cookie = sc.split(',').map((c) => c.split(';')[0]).filter((c) => /csig_sid/.test(c)).pop() || cookie;
  return r;
}
const csrfOf = (html) => (html.match(/name="csrf" value="([0-9a-f]+)"/) || [])[1];
const form = (o) => ({ method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(o).toString() });
const state = (cash, cal, meta) => JSON.stringify({ meta, cash, cal, stats: { sold: 3, built: 1, play: 99 }, up: {}, name: 'Test </script><b>Shop', ach: { a: 1, b: 1 } });

(async () => {
  const user = 'smoke' + Math.floor(Math.random() * 1e6);
  // anonymous
  let r = await req('/index.php');
  ok(r.status === 302 && /login\.php/.test(r.headers.get('location')), 'index redirects anonymous users to login');
  r = await req('/api/save.php', { method: 'POST', body: '{}' });
  ok(r.status === 401, 'save requires login');

  // register
  let html = await (await req('/register.php')).text();
  let tok = csrfOf(html);
  r = await req('/register.php', form({ csrf: tok, username: 'x', password: 'short', password2: 'short' }));
  ok(r.status === 200 && /Username must be/.test(await r.text()), 'register validates input');
  html = await (await req('/register.php')).text(); tok = csrfOf(html);
  r = await req('/register.php', form({ csrf: 'bad', username: user, password: 'longenough1', password2: 'longenough1' }));
  ok(/expired/.test(await r.text()), 'register rejects bad csrf');
  html = await (await req('/register.php')).text(); tok = csrfOf(html);
  r = await req('/register.php', form({ csrf: tok, username: user, password: 'longenough1', password2: 'longenough1' }));
  ok(r.status === 302, 'register succeeds and redirects');

  // game page boot
  html = await (await req('/index.php')).text();
  const csrf = (html.match(/"csrf":"([0-9a-f]+)"/) || [])[1];
  ok(!!csrf && /"rev":0/.test(html) && /"state":null/.test(html), 'new account boots with no save');
  const post = (path, body, extra) => req(path, { method: 'POST', headers: Object.assign({ 'content-type': 'application/json', 'x-csrf-token': csrf }, extra || {}), body: JSON.stringify(body) });

  r = await post('/api/save.php', { state: state(100, 0), rev: 0 }, { 'x-csrf-token': 'wrong' });
  ok(r.status === 403, 'save rejects bad csrf');
  r = await post('/api/save.php', { state: state(100, 0), rev: 0 });
  let j = await r.json(); ok(j.ok && j.rev === 1, 'first save creates rev 1');
  r = await post('/api/save.php', { state: state(200, 0.5), rev: 1 });
  j = await r.json(); ok(j.ok && j.rev === 2, 'second save bumps rev');
  r = await post('/api/save.php', { state: state(300, 0.6), rev: 1, tab: 'otherTab' });
  ok(r.status === 409, 'stale rev from a different tab is a conflict');
  r = await post('/api/save.php', { state: state(300, 0.6), rev: 1, force: true, tab: 'tabA' });
  j = await r.json(); ok(j.ok && j.rev === 3, 'force overwrites');
  r = await post('/api/save.php', { state: state(310, 0.6), rev: 2, tab: 'tabA' });
  j = await r.json(); ok(j.ok && j.rev === 4, 'stale rev from the SAME tab (reload race) is accepted');
  r = await post('/api/save.php', { state: state(-5, 0), rev: 4 });
  ok(r.status === 422, 'negative cash rejected');
  r = await post('/api/save.php', { state: state(5, 99), rev: 4 });
  ok(r.status === 422, 'calendar beyond today rejected');
  r = await post('/api/save.php', { state: state(5, 1, { tokens: -3 }), rev: 4 });
  ok(r.status === 422, 'negative Franchise Tokens rejected');
  r = await post('/api/save.php', { state: state(5, 1, { tokens: 7, earned: 12, resets: 2, tup: { t_income: 3 } }), rev: 4 });
  j = await r.json(); ok(j.ok, 'save with Franchise Token meta accepted');
  r = await post('/api/save.php', { state: state(300, 0.6), rev: j.rev, force: true });
  r = await post('/api/save.php', { state: 'not json', rev: 4 });
  ok(r.status === 422, 'garbage state rejected');
  r = await post('/api/save.php', { state: 'x'.repeat(450000), rev: 4 });
  ok(r.status === 400 || r.status === 413, 'oversized state rejected');
  r = await req('/api/save.php');
  ok(r.status === 405, 'GET not allowed');

  // load via page, script-tag injection safe
  html = await (await req('/index.php')).text();
  ok(/"rev":6/.test(html) && /"cash":300/.test(html), 'page boots with saved state');
  ok(!/<\/script><b>/.test(html), 'user text cannot break out of the boot script');

  // load endpoint (used to re-check after a reload race)
  r = await post('/api/load.php', {});
  j = await r.json(); ok(j.ok && j.rev === 6 && j.state && j.state.cash === 300, 'load returns the latest save');

  // settings
  r = await post('/api/settings.php', { theme: 'rgb', showTicker: false });
  j = await r.json(); ok(j.ok && j.settings.theme === 'rgb' && j.settings.showTicker === false, 'settings saved');
  r = await post('/api/settings.php', { theme: 'bogus' });
  ok(r.status === 422, 'invalid theme rejected');
  html = await (await req('/index.php')).text();
  ok(/"theme":"rgb"/.test(html) && /"showTicker":false/.test(html), 'settings restored on next load');

  // reset
  r = await post('/api/reset.php', {});
  ok((await r.json()).ok, 'reset ok');
  html = await (await req('/index.php')).text();
  ok(/"state":null/.test(html), 'reset clears the save');

  // logout + login throttling
  html = await (await req('/account.php')).text(); tok = csrfOf(html);
  r = await req('/logout.php', form({ csrf: tok }));
  r = await req('/index.php');
  ok(r.status === 302, 'logout ends the session');
  for (let i = 0; i < 8; i++) {
    html = await (await req('/login.php')).text();
    r = await req('/login.php', form({ csrf: csrfOf(html), username: user, password: 'wrong-password' }));
  }
  html = await (await req('/login.php')).text();
  r = await req('/login.php', form({ csrf: csrfOf(html), username: user, password: 'longenough1' }));
  ok(/Too many failed/.test(await r.text()), 'login is throttled after repeated failures');
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  console.log('(throwaway user: ' + user + ' — clean up with: DELETE FROM users WHERE username LIKE "smoke%")');
  process.exit(fails ? 1 : 0);
})();
