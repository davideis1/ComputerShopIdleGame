<?php
// POST {proof: {playerId, bundleId, publicKeyUrl, signature, salt, timestamp}, name?, label?}
//   ->  {ok, token, user: {id, username, email, gameCenter, hasPassword}, created}
// Sign in with Game Center (iOS app). The linked account signs in; a new player gets a new account (no password yet;
// they can set one later to use the website). Errors: gc_bad_proof 401, gc_expired 401, gc_bad_key 401, gc_replay 401,
// registration_closed 403, too_many_attempts 429.
require __DIR__ . '/../inc/bootstrap.php';
require __DIR__ . '/../inc/reset.php';
require __DIR__ . '/../inc/gamecenter.php';
$body = api_public();

$v = gc_verify(is_array($body['proof'] ?? null) ? $body['proof'] : []);
if (isset($v['error'])) {
    json_out(['ok' => false, 'error' => $v['error']], 401);
}
$st = db()->prepare('SELECT id FROM users WHERE gc_player_id = ?');
$st->execute([$v['player']]);
$uid = (int) $st->fetchColumn();
$created = false;
if (!$uid) {
    if (!cfg('allow_registration', true)) {
        json_out(['ok' => false, 'error' => 'registration_closed'], 403);
    }
    if (register_blocked()) {
        json_out(['ok' => false, 'error' => 'too_many_attempts'], 429);
    }
    register_noted();
    $name = gc_new_username(clean_name($body['name'] ?? ''));
    try {
        db()->prepare('INSERT INTO users (username, gc_player_id, password_hash, has_password) VALUES (?, ?, ?, 0)')
            ->execute([$name, $v['player'], password_hash(bin2hex(random_bytes(32)), PASSWORD_DEFAULT)]);
    } catch (PDOException $e) {
        error_log('auth_gamecenter.php: ' . $e->getMessage());
        json_out(['ok' => false, 'error' => 'server_error'], 500);
    }
    $uid = (int) db()->lastInsertId();
    $created = true;
}
db()->prepare('UPDATE users SET last_login_at = NOW() WHERE id = ?')->execute([$uid]);
json_out(['ok' => true, 'token' => issue_token($uid, (string) ($body['label'] ?? '')), 'user' => auth_user_payload($uid), 'created' => $created], $created ? 201 : 200);
