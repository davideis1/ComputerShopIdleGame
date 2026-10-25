<?php
// POST {code, name?, label?}  ->  {ok, token, user: {id, username, email, gameCenter, playGames, hasPassword}, created}
// Sign in with Google Play Games (Android app): `code` is the server auth code from GamesSignInClient.requestServerSideAccess.
// The linked account signs in; a new player gets a new account (no password yet; they can set one to use the website).
// Errors: pg_bad_code 401, pg_not_configured 503, pg_unreachable 502, registration_closed 403, too_many_attempts 429.
require __DIR__ . '/../inc/bootstrap.php';
require __DIR__ . '/../inc/reset.php';
require __DIR__ . '/../inc/gamecenter.php';
require __DIR__ . '/../inc/playgames.php';
$body = api_public();

$v = pg_verify((string) ($body['code'] ?? ''));
if (isset($v['error'])) {
    json_out(['ok' => false, 'error' => $v['error']], ['pg_not_configured' => 503, 'pg_unreachable' => 502][$v['error']] ?? 401);
}
$st = db()->prepare('SELECT id FROM users WHERE pg_player_id = ?');
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
    $name = gc_new_username(clean_name($body['name'] ?? $v['name']));
    try {
        db()->prepare('INSERT INTO users (username, pg_player_id, password_hash, has_password) VALUES (?, ?, ?, 0)')
            ->execute([$name, $v['player'], password_hash(bin2hex(random_bytes(32)), PASSWORD_DEFAULT)]);
    } catch (PDOException $e) {
        error_log('auth_playgames.php: ' . $e->getMessage());
        json_out(['ok' => false, 'error' => 'server_error'], 500);
    }
    $uid = (int) db()->lastInsertId();
    $created = true;
}
db()->prepare('UPDATE users SET last_login_at = NOW() WHERE id = ?')->execute([$uid]);
json_out(['ok' => true, 'token' => issue_token($uid, (string) ($body['label'] ?? '')), 'user' => auth_user_payload($uid), 'created' => $created], $created ? 201 : 200);
