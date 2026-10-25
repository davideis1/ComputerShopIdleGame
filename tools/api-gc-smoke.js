/* Sign in with Game Center checks:  node tools/api-gc-smoke.js http://localhost:8125 /path/to/gc-test-key.pem
   Generates a test key pair, writes the PUBLIC key to that path and signs proofs the way Apple does
   (teamPlayerID || bundleId || UInt64 BE timestamp || salt, RSA-SHA256). The server's inc/config.php must have
   'gc_test_public_key' => that same path (never set it in production) and gc_bundle_id at its default. */
const crypto = require('crypto');
const fs = require('fs');
const base = (process.argv[2] || 'http://localhost:8125').replace(/\/$/, '');
const keyFile = process.argv[3];
if (!keyFile) { console.error('usage: node tools/api-gc-smoke.js <base url> <public key file the server reads>'); process.exit(1); }
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const call = async (path, body, token) => {
  const h = { 'content-type': 'application/json' };
  if (token) h['x-api-token'] = token;
  const r = await fetch(base + '/api/' + path, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  let j = null; try { j = await r.json(); } catch (e) { /* not json */ }
  return { s: r.status, j };
};

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
fs.writeFileSync(keyFile, publicKey.export({ type: 'spki', format: 'pem' }));
const BUNDLE = 'com.davideis.computershopidle';
function proof(playerId, opt = {}) {
  const ts = BigInt(opt.ts ?? Date.now());
  const salt = crypto.randomBytes(8);
  const tsb = Buffer.alloc(8); tsb.writeBigUInt64BE(ts);
  const data = Buffer.concat([Buffer.from(playerId, 'utf8'), Buffer.from(opt.bundle || BUNDLE, 'utf8'), tsb, salt]);
  const sig = crypto.sign('sha256', data, opt.key || privateKey);
  return { playerId, bundleId: opt.bundle || BUNDLE, publicKeyUrl: 'https://static.gc.apple.com/public-key/gc-prod-10.cer', signature: sig.toString('base64'), salt: salt.toString('base64'), timestamp: String(ts) };
}

(async () => {
  const n = Math.floor(Math.random() * 1e9);
  const player = 'T:_smoke' + n, player2 = 'T:_smoke' + n + 'b';

  // new player -> new account, no password
  let r = await call('auth_gamecenter.php', { proof: proof(player), name: 'Smoke Tester', label: 'smoke' });
  ok(r.s === 201 && r.j.created && r.j.token && r.j.user.gameCenter && !r.j.user.hasPassword, 'a new Game Center player gets a new account (no password)');
  ok(r.j && /^SmokeTester\d+$/.test(r.j.user.username), 'its username comes from the display name: ' + (r.j && r.j.user.username));
  const t1 = r.j.token, uid = r.j.user.id, uname = r.j.user.username;

  r = await call('auth_gamecenter.php', { proof: proof(player) });
  ok(r.s === 200 && !r.j.created && r.j.user.id === uid, 'the same player signs in to the same account');
  r = await call('load.php', {}, r.j.token);
  ok(r.s === 200 && r.j.ok, 'the token works for cloud saves');

  // bad proofs
  const p = proof(player);
  ok((await call('auth_gamecenter.php', { proof: p })).s === 200, '(a fresh proof is accepted once)');
  r = await call('auth_gamecenter.php', { proof: p });
  ok(r.s === 401 && r.j.error === 'gc_replay', 'a replayed proof is refused');
  const forged = proof(player); forged.playerId = player2;
  r = await call('auth_gamecenter.php', { proof: forged });
  ok(r.s === 401 && r.j.error === 'gc_bad_proof', 'a proof signed for another player is refused');
  const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
  r = await call('auth_gamecenter.php', { proof: proof(player, { key: other }) });
  ok(r.s === 401 && r.j.error === 'gc_bad_proof', 'a proof signed with the wrong key is refused');
  r = await call('auth_gamecenter.php', { proof: proof(player, { ts: Date.now() - 3600 * 1000 }) });
  ok(r.s === 401 && r.j.error === 'gc_expired', 'an hour-old proof is refused');
  r = await call('auth_gamecenter.php', { proof: proof(player, { bundle: 'com.example.other' }) });
  ok(r.s === 401 && r.j.error === 'gc_bad_proof', 'a proof for another app is refused');
  r = await call('auth_gamecenter.php', { proof: { playerId: player } });
  ok(r.s === 401, 'an incomplete proof is refused');

  // a password account links Game Center, then signs in with it
  const user = 'smoke' + n, pw = 'longenough1';
  r = await call('auth_register.php', { username: user, password: pw });
  ok(r.s === 201 && r.j.user.hasPassword && !r.j.user.gameCenter, 'a password account starts unlinked');
  const t2 = r.j.token, uid2 = r.j.user.id;
  r = await call('auth_gc_link.php', { proof: proof(player) }, t2);
  ok(r.s === 409 && r.j.error === 'gc_taken', 'a player already linked to another account cannot be linked again');
  r = await call('auth_gc_link.php', { proof: proof(player2) }, t2);
  ok(r.s === 200 && r.j.user.gameCenter, 'linking a new player works');
  r = await call('auth_gamecenter.php', { proof: proof(player2) });
  ok(r.s === 200 && r.j.user.id === uid2 && r.j.user.username === user, 'Game Center now signs in to the password account');
  r = await call('auth_gc_link.php', { unlink: true }, t2);
  ok(r.s === 200 && !r.j.user.gameCenter, 'an account with a password can unlink');

  // the Game Center-only account: cannot unlink, can set a password, then use it
  r = await call('auth_gc_link.php', { unlink: true }, t1);
  ok(r.s === 409 && r.j.error === 'needs_password', 'a Game Center-only account cannot unlink (it would be locked out)');
  r = await call('auth_set_password.php', { new_password: 'short' }, t1);
  ok(r.s === 422, 'a short password is refused');
  r = await call('auth_set_password.php', { new_password: 'gc-account-pw1' }, t1);
  ok(r.s === 200 && r.j.user.hasPassword, 'a Game Center account can set its first password without an old one');
  r = await call('auth_login.php', { username: uname, password: 'gc-account-pw1' });
  ok(r.s === 200 && r.j.user.id === uid && r.j.user.gameCenter, 'and then sign in with username and password too');
  r = await call('auth_set_password.php', { new_password: 'another-pw-22' }, t1);
  ok(r.s === 403 && r.j.error === 'bad_password', 'changing an existing password needs the current one');

  // deleting: a Game Center-only account proves itself with a fresh proof
  const n3 = 'T:_smoke' + n + 'c';
  r = await call('auth_gamecenter.php', { proof: proof(n3), name: 'x' });
  ok(r.s === 201 && /^Player\d+$/.test(r.j.user.username), 'a too-short display name falls back to PlayerNNN');
  const t3 = r.j.token;
  r = await call('auth_delete.php', { confirm: 'DELETE', proof: proof(player2) }, t3);
  ok(r.s === 403, 'deleting needs a proof for this account\'s own player');
  r = await call('auth_delete.php', { confirm: 'DELETE', proof: proof(n3) }, t3);
  ok(r.s === 200, 'a Game Center-only account can delete itself with a fresh proof');
  r = await call('auth_gamecenter.php', { proof: proof(n3) });
  ok(r.s === 201 && r.j.created, 'after deleting, the player starts fresh');
  await call('auth_delete.php', { confirm: 'DELETE', proof: proof(n3) }, r.j.token);
  await call('auth_delete.php', { confirm: 'DELETE', password: pw }, t2);
  await call('auth_delete.php', { confirm: 'DELETE', password: 'gc-account-pw1' }, t1);

  console.log(fails ? `\n${fails} FAILED` : '\nall Game Center sign-in checks passed');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
