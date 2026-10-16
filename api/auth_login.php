<?php
// POST {username, password, label?}  ->  {ok, token, user: {id, username}}   (native app sign-in)
// Errors: bad_credentials 401, too_many_attempts 429. Uses the same throttling as the website's login page.
require __DIR__ . '/../inc/bootstrap.php';
$body = api_public();

$username = trim((string) ($body['username'] ?? ''));
$password = (string) ($body['password'] ?? '');
if ($username === '' || $password === '' || strlen($username) > 20 || strlen($password) > 200) {
    json_out(['ok' => false, 'error' => 'bad_credentials'], 401);
}
if (login_blocked($username)) {
    json_out(['ok' => false, 'error' => 'too_many_attempts'], 429);
}
$st = db()->prepare('SELECT id, username, password_hash FROM users WHERE username = ?');
$st->execute([$username]);
$u = $st->fetch();
// Always run a hash check so response time does not reveal whether the user exists.
$hash = $u ? $u['password_hash'] : password_hash('no-such-user', PASSWORD_DEFAULT);
if (!(password_verify($password, $hash) && $u)) {
    login_failed($username);
    json_out(['ok' => false, 'error' => 'bad_credentials'], 401);
}
if (password_needs_rehash($u['password_hash'], PASSWORD_DEFAULT)) {
    db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([password_hash($password, PASSWORD_DEFAULT), $u['id']]);
}
db()->prepare('UPDATE users SET last_login_at = NOW() WHERE id = ?')->execute([$u['id']]);
json_out(['ok' => true, 'token' => issue_token((int) $u['id'], (string) ($body['label'] ?? '')), 'user' => ['id' => (int) $u['id'], 'username' => $u['username']]]);
