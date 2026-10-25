/* Sign in with Google Play Games checks:  node tools/api-pg-smoke.js http://localhost:8125 [fake-google-port=8127]
   Starts a fake Google (the token endpoint and the Games API's players/me) and drives the real PHP endpoints against it.
   The server's inc/config.php must have:
     'pg_client_id' => 'test-client', 'pg_client_secret' => 'test-secret',
     'pg_token_url' => 'http://127.0.0.1:8127/token', 'pg_api_url' => 'http://127.0.0.1:8127/games/v1'
   (never set the two urls in production: they exist for this test). */
const http = require('http');
const base = (process.argv[2] || 'http://localhost:8125').replace(/\/$/, '');
const port = +process.argv[3] || 8127;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const call = async (path, body, token) => {
  const h = { 'content-type': 'application/json' };
  if (token) h['x-api-token'] = token;
  const r = await fetch(base + '/api/' + path, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  let j = null; try { j = await r.json(); } catch (e) { /* not json */ }
  return { s: r.status, j };
};

// ---- fake Google: codes look like "good-<player>-<n>" and work once; the access token is "tok-<player>"
const used = new Set();
const seen = [];
const fake = http.createServer((req, res) => {
  let data = '';
  req.on('data', (c) => (data += c));
  req.on('end', () => {
    const send = (s, o) => { res.writeHead(s, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (req.method === 'POST' && req.url === '/token') {
      const f = new URLSearchParams(data);
      seen.push(Object.fromEntries(f));
      const code = f.get('code') || '';
      const m = /^good-([A-Za-z0-9_]+)-\d+$/.exec(code);
      if (f.get('client_id') !== 'test-client' || f.get('client_secret') !== 'test-secret' || f.get('grant_type') !== 'authorization_code' || !m || used.has(code)) return send(400, { error: 'invalid_grant' });
      used.add(code);
      return send(200, { access_token: 'tok-' + m[1], token_type: 'Bearer' });
    }
    if (req.method === 'GET' && req.url === '/games/v1/players/me') {
      const m = /^Bearer tok-([A-Za-z0-9_]+)$/.exec(req.headers.authorization || '');
      if (!m) return send(401, { error: 'unauthorized' });
      return send(200, { playerId: m[1], displayName: 'Pixel Pioneer' });
    }
    send(404, {});
  });
});

let n = 0;
const code = (player) => `good-${player}-${++n}`;

fake.listen(port, '127.0.0.1', async () => {
  const id = Math.floor(Math.random() * 1e9);
  const p1 = 'p' + id, p2 = 'p' + id + 'b';

  // new player -> new account, no password
  let r = await call('auth_playgames.php', { code: code(p1), name: 'Pixel Pioneer', label: 'smoke' });
  ok(r.s === 201 && r.j.created && r.j.token && r.j.user.playGames && !r.j.user.hasPassword && !r.j.user.gameCenter, 'a new Play Games player gets a new account (no password)');
  ok(/^PixelPioneer\d+$/.test(r.j.user.username), 'its username comes from the display name: ' + r.j.user.username);
  const t1 = r.j.token, uid = r.j.user.id, uname = r.j.user.username;
  ok(seen[0] && seen[0].client_id === 'test-client' && seen[0].grant_type === 'authorization_code', 'the server redeemed the code with its own client id and secret');

  r = await call('auth_playgames.php', { code: code(p1) });
  ok(r.s === 200 && !r.j.created && r.j.user.id === uid, 'the same player signs in to the same account');
  r = await call('load.php', {}, r.j.token);
  ok(r.s === 200 && r.j.ok, 'the token works for cloud saves');

  // bad codes
  const c = code(p1);
  ok((await call('auth_playgames.php', { code: c })).s === 200, '(a fresh code is accepted once)');
  r = await call('auth_playgames.php', { code: c });
  ok(r.s === 401 && r.j.error === 'pg_bad_code', 'a code used before is refused');
  r = await call('auth_playgames.php', { code: 'bad-code-1' });
  ok(r.s === 401 && r.j.error === 'pg_bad_code', 'a code Google does not know is refused');
  r = await call('auth_playgames.php', { code: '' });
  ok(r.s === 401 && r.j.error === 'pg_bad_code', 'an empty code is refused');
  r = await call('auth_playgames.php', { code: 'x y; DROP TABLE users' });
  ok(r.s === 401 && r.j.error === 'pg_bad_code', 'a code with odd characters is refused before it is sent anywhere');
  r = await call('auth_playgames.php', {});
  ok(r.s === 401, 'a missing code is refused');

  // a password account links Play Games, then signs in with it
  const user = 'smoke' + id, pw = 'longenough1';
  r = await call('auth_register.php', { username: user, password: pw });
  ok(r.s === 201 && r.j.user.hasPassword && !r.j.user.playGames, 'a password account starts unlinked');
  const t2 = r.j.token, uid2 = r.j.user.id;
  r = await call('auth_pg_link.php', { code: code(p1) }, t2);
  ok(r.s === 409 && r.j.error === 'pg_taken', 'a player already linked to another account cannot be linked again');
  r = await call('auth_pg_link.php', { code: code(p2) }, t2);
  ok(r.s === 200 && r.j.user.playGames, 'linking a new player works');
  r = await call('auth_playgames.php', { code: code(p2) });
  ok(r.s === 200 && r.j.user.id === uid2 && r.j.user.username === user, 'Play Games now signs in to the password account');
  r = await call('auth_pg_link.php', { unlink: true }, t2);
  ok(r.s === 200 && !r.j.user.playGames, 'an account with a password can unlink');

  // the Play Games-only account: cannot unlink, can set a password, then use it
  r = await call('auth_pg_link.php', { unlink: true }, t1);
  ok(r.s === 409 && r.j.error === 'needs_password', 'a Play Games-only account cannot unlink (it would be locked out)');
  r = await call('auth_set_password.php', { new_password: 'pg-account-pw1' }, t1);
  ok(r.s === 200 && r.j.user.hasPassword, 'a Play Games account can set its first password without an old one');
  r = await call('auth_login.php', { username: uname, password: 'pg-account-pw1' });
  ok(r.s === 200 && r.j.user.id === uid && r.j.user.playGames, 'and then sign in with username and password too');

  // deleting: a Play Games-only account proves itself with a fresh code
  r = await call('auth_playgames.php', { code: code('p' + id + 'c'), name: 'x' });
  ok(r.s === 201 && /^Player\d+$/.test(r.j.user.username), 'a too-short display name falls back to PlayerNNN');
  const t3 = r.j.token;
  r = await call('auth_delete.php', { confirm: 'DELETE', pg_code: code(p2) }, t3);
  ok(r.s === 403, 'deleting needs a code for this account\'s own player');
  r = await call('auth_delete.php', { confirm: 'DELETE', pg_code: code('p' + id + 'c') }, t3);
  ok(r.s === 200, 'a Play Games-only account can delete itself with a fresh code');
  await call('auth_delete.php', { confirm: 'DELETE', password: pw }, t2);
  await call('auth_delete.php', { confirm: 'DELETE', password: 'pg-account-pw1' }, t1);

  // Google down: a clear error, not a crash
  fake.close();
  r = await call('auth_playgames.php', { code: code(p1) });
  ok(r.s === 502 && r.j.error === 'pg_unreachable', 'when Google cannot be reached the answer is pg_unreachable (502)');

  console.log(fails ? `\n${fails} FAILED` : '\nall Play Games sign-in checks passed');
  process.exit(fails ? 1 : 0);
});
