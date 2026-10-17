<?php
// POST {email, password}  ->  {ok, email: "d***@example.com"|null}   Adds, changes or (email "") removes the address used for
// password resets. Needs the current password so a stolen session cannot redirect resets to someone else.
// Errors: bad_password 403, bad_email 422, email_taken 409, too_many_attempts 429.
require __DIR__ . '/../inc/bootstrap.php';
require __DIR__ . '/../inc/reset.php';
[$user, $body] = api_guard();
$uid = (int) $user['id'];

if (login_blocked($user['username'])) {
    json_out(['ok' => false, 'error' => 'too_many_attempts'], 429);
}
$st = db()->prepare('SELECT password_hash FROM users WHERE id = ?');
$st->execute([$uid]);
if (!password_verify((string) ($body['password'] ?? ''), (string) $st->fetchColumn())) {
    login_failed($user['username']);
    json_out(['ok' => false, 'error' => 'bad_password'], 403);
}
$err = set_user_email($uid, (string) ($body['email'] ?? ''));
if ($err) {
    json_out(['ok' => false, 'error' => $err], $err === 'email_taken' ? 409 : 422);
}
json_out(['ok' => true, 'email' => mask_email(user_email($uid))]);
