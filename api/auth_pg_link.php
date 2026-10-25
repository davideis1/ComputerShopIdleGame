<?php
// POST {code}            ->  {ok, user}   Links the signed-in account to this Google Play Games player.
// POST {unlink: true}    ->  {ok, user}   Unlinks it (only when the account has a password, or it would be locked out).
// Errors: pg_* (see inc/playgames.php), pg_taken 409 (that player is linked to another account), needs_password 409.
require __DIR__ . '/../inc/bootstrap.php';
require __DIR__ . '/../inc/reset.php';
require __DIR__ . '/../inc/gamecenter.php';
require __DIR__ . '/../inc/playgames.php';
[$user, $body] = api_guard();
$uid = (int) $user['id'];

if (!empty($body['unlink'])) {
    $st = db()->prepare('SELECT has_password, gc_player_id FROM users WHERE id = ?');
    $st->execute([$uid]);
    $u = $st->fetch();
    // an account that signs in only through Play Games needs a password; one that also has Game Center can still unlink
    if (!(int) $u['has_password'] && $u['gc_player_id'] === null) {
        json_out(['ok' => false, 'error' => 'needs_password'], 409);
    }
    db()->prepare('UPDATE users SET pg_player_id = NULL WHERE id = ?')->execute([$uid]);
    json_out(['ok' => true, 'user' => auth_user_payload($uid)]);
}
$v = pg_verify((string) ($body['code'] ?? ''));
if (isset($v['error'])) {
    json_out(['ok' => false, 'error' => $v['error']], ['pg_not_configured' => 503, 'pg_unreachable' => 502][$v['error']] ?? 401);
}
$st = db()->prepare('SELECT id FROM users WHERE pg_player_id = ?');
$st->execute([$v['player']]);
$other = (int) $st->fetchColumn();
if ($other && $other !== $uid) {
    json_out(['ok' => false, 'error' => 'pg_taken'], 409);
}
db()->prepare('UPDATE users SET pg_player_id = ? WHERE id = ?')->execute([$v['player'], $uid]);
json_out(['ok' => true, 'user' => auth_user_payload($uid)]);
