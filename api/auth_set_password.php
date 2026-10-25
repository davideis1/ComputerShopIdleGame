<?php
// POST {new_password, password?}  ->  {ok, user}   Sets or changes the account password.
// Accounts made with Game Center have none yet: they set one without `password` (the token proves who they are), and can
// then sign in on the website with their username. Accounts that have one must give the current `password`.
// Errors: bad_password 403, weak_password 422, too_many_attempts 429.
require __DIR__ . '/../inc/bootstrap.php';
require __DIR__ . '/../inc/reset.php';
require __DIR__ . '/../inc/gamecenter.php';
[$user, $body] = api_guard();
$uid = (int) $user['id'];

$new = (string) ($body['new_password'] ?? '');
if (strlen($new) < 8 || strlen($new) > 200) {
    json_out(['ok' => false, 'error' => 'weak_password'], 422);
}
$st = db()->prepare('SELECT password_hash, has_password FROM users WHERE id = ?');
$st->execute([$uid]);
$u = $st->fetch();
if ((int) $u['has_password']) {
    if (login_blocked($user['username'])) {
        json_out(['ok' => false, 'error' => 'too_many_attempts'], 429);
    }
    if (!password_verify((string) ($body['password'] ?? ''), (string) $u['password_hash'])) {
        login_failed($user['username']);
        json_out(['ok' => false, 'error' => 'bad_password'], 403);
    }
}
db()->prepare('UPDATE users SET password_hash = ?, has_password = 1 WHERE id = ?')->execute([password_hash($new, PASSWORD_DEFAULT), $uid]);
json_out(['ok' => true, 'user' => auth_user_payload($uid)]);
