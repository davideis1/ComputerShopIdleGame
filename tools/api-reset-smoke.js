/* Password-reset + email checks:  node tools/api-reset-smoke.js http://localhost:8125 /path/to/mail.log
   The server must use 'mail_transport' => 'log' with 'mail_log' => that same file (the emails are read back from it). */
const fs = require('fs');
const base = (process.argv[2] || 'http://localhost:8125').replace(/\/$/, '');
const logFile = process.argv[3];
if (!logFile) { console.error('usage: node tools/api-reset-smoke.js <base url> <mail log file>'); process.exit(1); }
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const call = async (path, body, token) => {
  const h = { 'content-type': 'application/json' };
  if (token) h.authorization = 'Bearer ' + token;
  const r = await fetch(base + '/api/' + path, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  let j = null; try { j = await r.json(); } catch (e) { /* not json */ }
  return { s: r.status, j };
};
const mails = () => (fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8').split('=== ').slice(1) : []);
const form = async (path, data, cookie) => {
  const r = await fetch(base + path, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: cookie || '' }, body: new URLSearchParams(data) });
  return { s: r.status, t: await r.text() };
};
const page = async (path) => {
  const r = await fetch(base + path);
  const c = (r.headers.get('set-cookie') || '').split(';')[0];
  const t = await r.text();
  const m = t.match(/name="csrf" value="([^"]+)"/);
  return { t, cookie: c, csrf: m && m[1] };
};

(async () => {
  fs.writeFileSync(logFile, '');
  const n = Math.floor(Math.random() * 1e6), user = 'smoke' + n, email = `Smoke${n}@Example.com`, pw = 'longenough1', pw2 = 'brandnew-pass2';

  let r = await call('auth_register.php', { username: user, password: pw, email: 'not-an-email' });
  ok(r.s === 422 && r.j.error === 'bad_email', 'register rejects a malformed email');
  r = await call('auth_register.php', { username: user, password: pw, email });
  ok(r.s === 201 && r.j.user.email === 's***@example.com', 'register with an email returns it masked and lowercased');
  const t1 = r.j.token;
  r = await call('auth_register.php', { username: user + 'b', password: pw, email: email.toUpperCase() });
  ok(r.s === 409 && r.j.error === 'email_taken', 'the same email cannot be on two accounts');
  r = await call('auth_login.php', { username: user, password: pw });
  ok(r.j.ok && r.j.user.email === 's***@example.com', 'login returns the masked email');
  const t2 = r.j.token;

  // ---- set / clear email (needs the password)
  r = await call('auth_set_email.php', { email: 'x@y.com', password: 'wrong-password' }, t1);
  ok(r.s === 403 && r.j.error === 'bad_password', 'changing the email needs the current password');
  r = await call('auth_set_email.php', { email: 'nope', password: pw }, t1);
  ok(r.s === 422 && r.j.error === 'bad_email', 'set_email rejects a malformed address');
  r = await call('auth_set_email.php', { email: '', password: pw }, t1);
  ok(r.j.ok && r.j.email === null, 'an empty email removes it');
  fs.writeFileSync(logFile, '');
  await call('auth_forgot.php', { email });
  ok(mails().length === 0, 'no email is sent once the address was removed');
  r = await call('auth_set_email.php', { email, password: pw }, t1);
  ok(r.j.ok && r.j.email === 's***@example.com', 'the email can be set again');

  // ---- forgot: same answer for known and unknown addresses
  r = await call('auth_forgot.php', { email: 'garbage' });
  ok(r.s === 422 && r.j.error === 'bad_email', 'forgot rejects a malformed address');
  r = await call('auth_forgot.php', { email: `nobody${n}@example.com` });
  ok(r.s === 200 && r.j.ok, 'forgot answers ok for an unknown address');
  ok(mails().length === 0, '...and sends nothing');
  r = await call('auth_forgot.php', { email });
  ok(r.s === 200 && r.j.ok, 'forgot answers ok for a known address');
  let m = mails();
  ok(m.length === 1 && m[0].includes(`To: <${email.toLowerCase()}>`), 'one reset email was sent to the account address');
  const link = (m[0].match(/https?:\/\/\S+reset-password\.php\?token=[0-9a-f]{64}/) || [])[0];
  ok(!!link, 'the email contains a reset link');
  const path = link ? new URL(link).pathname + new URL(link).search : '/';

  // ---- reset page
  let p = await page('/reset-password.php?token=' + '0'.repeat(64));
  ok(/invalid or has expired/.test(p.t), 'a made-up token is rejected');
  p = await page(path);
  ok(/New password/.test(p.t) && !!p.csrf, 'the real token shows the new-password form');
  let f = await form(path.split('?')[0], { csrf: p.csrf, token: path.split('token=')[1], password: 'short', password2: 'short' }, p.cookie);
  ok(/8–200 characters/.test(f.t), 'a short new password is refused');
  f = await form(path.split('?')[0], { csrf: p.csrf, token: path.split('token=')[1], password: pw2, password2: pw2 + 'x' }, p.cookie);
  ok(/do not match/.test(f.t), 'mismatched passwords are refused');
  f = await form(path.split('?')[0], { csrf: p.csrf, token: path.split('token=')[1], password: pw2, password2: pw2 }, p.cookie);
  ok(/password has been changed/.test(f.t), 'the reset succeeds');
  m = mails();
  ok(m.length === 2 && /was changed/.test(m[1]), 'a confirmation email is sent');

  // ---- after the reset
  r = await call('auth_login.php', { username: user, password: pw });
  ok(r.s === 401, 'the old password no longer works');
  r = await call('auth_login.php', { username: user, password: pw2 });
  ok(r.j.ok, 'the new password works');
  r = await call('load.php', {}, t1);
  ok(r.s === 401 && r.j.error === 'bad_token', 'the old app sessions were signed out');
  p = await page(path);
  ok(/invalid or has expired/.test(p.t), 'the link cannot be used twice');

  // ---- throttle (per IP per hour)
  let blocked = false;
  for (let i = 0; i < 8 && !blocked; i++) blocked = (await call('auth_forgot.php', { email: `x${i}${n}@example.com` })).s === 429;
  ok(blocked, 'forgot requests are throttled per IP');

  // ---- clean up
  r = await call('auth_delete.php', { password: pw2, confirm: 'DELETE' }, (await call('auth_login.php', { username: user, password: pw2 })).j.token);
  ok(r.j && r.j.ok, 'test account deleted');
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
