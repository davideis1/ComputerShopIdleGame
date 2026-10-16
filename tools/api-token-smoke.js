/* End-to-end check of the native app's token API:  node tools/api-token-smoke.js http://localhost:8124 [--throttle]
   Needs a running server + database (see README). Creates throwaway users and deletes them again.
   --throttle also checks the per-IP sign-up limit (this uses up the hour's sign-ups for your IP, so it is opt-in). */
const base = (process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'http://localhost:8124').replace(/\/$/, '');
const throttle = process.argv.includes('--throttle');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const call = async (path, body, token, headers = {}) => {
  const h = Object.assign({ 'content-type': 'application/json' }, headers);
  if (token) h.authorization = 'Bearer ' + token;
  const r = await fetch(base + '/api/' + path, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  let j = null; try { j = await r.json(); } catch (e) { /* not json */ }
  return { s: r.status, j };
};
const state = (cash, cal) => JSON.stringify({ meta: { tokens: 0 }, cash, cal, stats: { sold: 1, built: 0, play: 10 }, up: {}, name: 'Phone Shop', ach: {} });
const HEX64 = /^[0-9a-f]{64}$/;

(async () => {
  const user = 'smoke' + Math.floor(Math.random() * 1e6), pw = 'longenough1';

  // ---- sign-up
  let r = await call('auth_register.php', { username: 'x', password: pw });
  ok(r.s === 422 && r.j.error === 'bad_username', 'register rejects a bad username');
  r = await call('auth_register.php', { username: user, password: 'short' });
  ok(r.s === 422 && r.j.error === 'bad_password', 'register rejects a short password');
  r = await call('auth_register.php', { username: user, password: pw, label: 'iPhone' });
  ok(r.s === 201 && r.j.ok && HEX64.test(r.j.token) && r.j.user.username === user, 'register succeeds and returns a 64-hex token');
  const t1 = r.j.token;
  r = await call('auth_register.php', { username: user, password: pw });
  ok(r.s === 409 && r.j.error === 'username_taken', 'duplicate username is refused');
  let g = await fetch(base + '/api/auth_register.php');
  ok(g.status === 405, 'GET not allowed on register');

  // ---- saving and loading with a bearer token (no cookie, no CSRF token)
  r = await call('save.php', { state: state(100, 0), rev: 0, tab: 'iosdevice1' }, t1);
  ok(r.s === 200 && r.j.ok && r.j.rev === 1 && r.j.server_time > 0, 'save works with a bearer token alone');
  r = await call('load.php', {}, t1);
  ok(r.j.ok && r.j.rev === 1 && r.j.state.cash === 100 && r.j.elapsed >= 0, 'load returns the save, rev and server-measured elapsed time');
  r = await call('save.php', { state: state(200, 0.1), rev: 0, tab: 'iosdevice1' }, t1);
  ok(r.s === 200, 'a stale rev from the same device (tab id) is not a conflict');
  r = await call('save.php', { state: state(300, 0.2), rev: 1, tab: 'androiddevice' }, t1);
  ok(r.s === 409 && r.j.error === 'conflict', 'a stale rev from another device is a conflict');
  r = await call('save.php', { state: state(300, 0.2), rev: 1, tab: 'androiddevice', force: true }, t1);
  ok(r.s === 200, 'force overwrites after a conflict');
  r = await call('settings.php', { theme: 'flat' }, t1);
  ok(r.j.ok && r.j.settings.theme === 'flat', 'settings work with a token');

  // ---- bad credentials for the API itself
  r = await call('load.php', {});
  ok(r.s === 401 && r.j.error === 'not_logged_in', 'no token and no cookie is rejected');
  r = await call('load.php', {}, 'f'.repeat(64));
  ok(r.s === 401 && r.j.error === 'bad_token', 'a well-formed but unknown token is rejected');
  r = await call('load.php', {}, 'not-a-token');
  ok(r.s === 401, 'a malformed token is rejected');
  r = await call('load.php', {}, null, { 'x-api-token': t1 });
  ok(r.j.ok, 'X-Api-Token works for hosts that strip Authorization');

  // ---- sign-in, second device, logout
  r = await call('auth_login.php', { username: user, password: 'wrong-password' });
  ok(r.s === 401 && r.j.error === 'bad_credentials', 'wrong password is refused');
  r = await call('auth_login.php', { username: 'no_such_user_x', password: pw });
  ok(r.s === 401 && r.j.error === 'bad_credentials', 'unknown user gets the same error as a wrong password');
  r = await call('auth_login.php', { username: user.toUpperCase(), password: pw, label: 'iPad' });
  ok(r.s === 200 && HEX64.test(r.j.token) && r.j.token !== t1, 'login issues a different token (username is case-insensitive)');
  const t2 = r.j.token;
  r = await call('load.php', {}, t2);
  ok(r.j.ok && r.j.state.cash === 300, 'the second device sees the same save');
  r = await call('auth_logout.php', {}, t2);
  ok(r.j.ok, 'logout succeeds');
  r = await call('load.php', {}, t2);
  ok(r.s === 401, 'a logged-out token stops working');
  r = await call('load.php', {}, t1);
  ok(r.j.ok, 'other devices stay signed in');
  r = await call('auth_logout.php', {});
  ok(r.s === 401, 'logout needs a token');

  // ---- token cap: only the newest MAX_TOKENS_PER_USER survive
  const toks = [];
  for (let i = 0; i < 11; i++) toks.push((await call('auth_login.php', { username: user, password: pw })).j.token);
  r = await call('load.php', {}, t1);
  ok(r.s === 401, 'the oldest token is dropped once a user has more than 10');
  r = await call('load.php', {}, toks[toks.length - 1]);
  ok(r.j.ok, 'the newest token still works');
  const t3 = toks[toks.length - 1];
  r = await call('auth_logout.php', { all: true }, t3);
  r = await call('load.php', {}, toks[toks.length - 2]);
  ok(r.s === 401, 'logout with all:true revokes every token');

  // ---- account deletion
  r = await call('auth_login.php', { username: user, password: pw });
  const t4 = r.j.token;
  r = await call('auth_delete.php', { password: pw }, t4);
  ok(r.s === 422 && r.j.error === 'bad_confirm', 'delete needs the word DELETE');
  r = await call('auth_delete.php', { password: 'wrong-password', confirm: 'DELETE' }, t4);
  ok(r.s === 403 && r.j.error === 'bad_password', 'delete needs the right password');
  r = await call('auth_delete.php', { password: pw, confirm: 'DELETE' });
  ok(r.s === 401, 'delete needs a signed-in user');
  r = await call('auth_delete.php', { password: pw, confirm: 'DELETE' }, t4);
  ok(r.j.ok, 'account deleted');
  r = await call('load.php', {}, t4);
  ok(r.s === 401, 'the token dies with the account');
  r = await call('auth_login.php', { username: user, password: pw });
  ok(r.s === 401, 'the deleted account can no longer sign in');

  // ---- login throttling (shared with the website)
  const u2 = 'smoke' + Math.floor(Math.random() * 1e6);
  r = await call('auth_register.php', { username: u2, password: pw });
  const t5 = r.j.token;
  for (let i = 0; i < 8; i++) await call('auth_login.php', { username: u2, password: 'wrong-password' });
  r = await call('auth_login.php', { username: u2, password: pw });
  ok(r.s === 429 && r.j.error === 'too_many_attempts', 'sign-in is throttled after repeated failures');
  r = await call('load.php', {}, t5);
  ok(r.j.ok, 'an existing token keeps working while sign-in is throttled');
  r = await call('auth_delete.php', { password: pw, confirm: 'DELETE' }, t5);
  ok(r.s === 429, 'delete is also throttled after repeated failures (it checks the password)');

  if (throttle) {
    let hit = null;
    for (let i = 0; i < 8 && !hit; i++) {
      const x = await call('auth_register.php', { username: 'smoke' + Math.floor(Math.random() * 1e9), password: pw });
      if (x.s === 429) hit = x;
    }
    ok(hit && hit.j.error === 'too_many_attempts', 'sign-ups are throttled per IP');
  }
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  console.log('(throwaway user left behind for the throttle check: ' + u2 + ' — clean up with: DELETE FROM users WHERE username LIKE "smoke%")');
  process.exit(fails ? 1 : 0);
})();
