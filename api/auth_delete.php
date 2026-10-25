<?php
// POST {password, confirm: "DELETE"}  ->  {ok}   Permanently deletes the account, its saves, settings and tokens.
// Accounts made with Game Center and no password send {proof, confirm} instead: a fresh proof for the linked player.
// Accounts made with Google Play Games and no password send {pg_code, confirm}: a fresh server auth code for the linked player.
// App Store rule 5.1.1(v): an app that lets you create an account must let you delete it from inside the app.
// Errors: bad_confirm 422, bad_password 403, too_many_attempts 429.
require __DIR__ . '/../inc/bootstrap.php';
require __DIR__ . '/../inc/gamecenter.php';
require __DIR__ . '/../inc/playgames.php';
[$user, $body] = api_guard();
$uid = (int) $user['id'];

if (($body['confirm'] ?? '') !== 'DELETE') {
    json_out(['ok' => false, 'error' => 'bad_confirm'], 422);
}
if (login_blocked($user['username'])) {
    json_out(['ok' => false, 'error' => 'too_many_attempts'], 429);
}
$st = db()->prepare('SELECT password_hash, has_password, gc_player_id, pg_player_id FROM users WHERE id = ?');
$st->execute([$uid]);
$u = $st->fetch();
if (!(int) $u['has_password'] && is_array($body['proof'] ?? null)) {
    $v = gc_verify($body['proof']);
    if (isset($v['error']) || $v['player'] !== $u['gc_player_id']) {
        login_failed($user['username']);
        json_out(['ok' => false, 'error' => $v['error'] ?? 'gc_bad_proof'], 403);
    }
} elseif (!(int) $u['has_password'] && isset($body['pg_code'])) {
    $v = pg_verify((string) $body['pg_code']);
    if (isset($v['error']) || $v['player'] !== $u['pg_player_id']) {
        login_failed($user['username']);
        json_out(['ok' => false, 'error' => $v['error'] ?? 'pg_bad_code'], 403);
    }
} elseif (!password_verify((string) ($body['password'] ?? ''), (string) $u['password_hash'])) {
    login_failed($user['username']);
    json_out(['ok' => false, 'error' => 'bad_password'], 403);
}
db()->prepare('DELETE FROM users WHERE id = ?')->execute([$uid]); // cascades to saves, backups, settings and tokens
json_out(['ok' => true]);
