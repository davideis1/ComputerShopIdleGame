<?php
// POST {password, confirm: "DELETE"}  ->  {ok}   Permanently deletes the account, its saves, settings and tokens.
// App Store rule 5.1.1(v): an app that lets you create an account must let you delete it from inside the app.
// Errors: bad_confirm 422, bad_password 403, too_many_attempts 429.
require __DIR__ . '/../inc/bootstrap.php';
[$user, $body] = api_guard();
$uid = (int) $user['id'];

if (($body['confirm'] ?? '') !== 'DELETE') {
    json_out(['ok' => false, 'error' => 'bad_confirm'], 422);
}
if (login_blocked($user['username'])) {
    json_out(['ok' => false, 'error' => 'too_many_attempts'], 429);
}
$st = db()->prepare('SELECT password_hash FROM users WHERE id = ?');
$st->execute([$uid]);
if (!password_verify((string) ($body['password'] ?? ''), (string) $st->fetchColumn())) {
    login_failed($user['username']);
    json_out(['ok' => false, 'error' => 'bad_password'], 403);
}
db()->prepare('DELETE FROM users WHERE id = ?')->execute([$uid]); // cascades to saves, backups, settings and tokens
json_out(['ok' => true]);
