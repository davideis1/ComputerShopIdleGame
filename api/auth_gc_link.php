<?php
// POST {proof}            ->  {ok, user}   Links the signed-in account to this Game Center player.
// POST {unlink: true}     ->  {ok, user}   Unlinks it (only when the account has a password, or it would be locked out).
// Errors: gc_* 401 (see inc/gamecenter.php), gc_taken 409 (that player is linked to another account), needs_password 409.
require __DIR__ . '/../inc/bootstrap.php';
require __DIR__ . '/../inc/reset.php';
require __DIR__ . '/../inc/gamecenter.php';
[$user, $body] = api_guard();
$uid = (int) $user['id'];

if (!empty($body['unlink'])) {
    $st = db()->prepare('SELECT has_password, pg_player_id FROM users WHERE id = ?');
    $st->execute([$uid]);
    $u = $st->fetch();
    // without a password the account needs another way in: Play Games counts
    if (!(int) $u['has_password'] && $u['pg_player_id'] === null) {
        json_out(['ok' => false, 'error' => 'needs_password'], 409);
    }
    db()->prepare('UPDATE users SET gc_player_id = NULL WHERE id = ?')->execute([$uid]);
    json_out(['ok' => true, 'user' => auth_user_payload($uid)]);
}
$v = gc_verify(is_array($body['proof'] ?? null) ? $body['proof'] : []);
if (isset($v['error'])) {
    json_out(['ok' => false, 'error' => $v['error']], 401);
}
$st = db()->prepare('SELECT id FROM users WHERE gc_player_id = ?');
$st->execute([$v['player']]);
$other = (int) $st->fetchColumn();
if ($other && $other !== $uid) {
    json_out(['ok' => false, 'error' => 'gc_taken'], 409);
}
db()->prepare('UPDATE users SET gc_player_id = ? WHERE id = ?')->execute([$v['player'], $uid]);
json_out(['ok' => true, 'user' => auth_user_payload($uid)]);
