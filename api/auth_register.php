<?php
// POST {username, password, label?}  ->  {ok, token, user: {id, username}}   (native app sign-up)
// Errors: registration_closed 403, too_many_attempts 429, bad_username / bad_password 422, username_taken 409.
require __DIR__ . '/../inc/bootstrap.php';
$body = api_public();

if (!cfg('allow_registration', true)) {
    json_out(['ok' => false, 'error' => 'registration_closed'], 403);
}
if (register_blocked()) {
    json_out(['ok' => false, 'error' => 'too_many_attempts'], 429);
}
$username = trim((string) ($body['username'] ?? ''));
$password = (string) ($body['password'] ?? '');
if (!valid_username($username)) {
    json_out(['ok' => false, 'error' => 'bad_username'], 422);
}
if (strlen($password) < 8 || strlen($password) > 200) {
    json_out(['ok' => false, 'error' => 'bad_password'], 422);
}
register_noted();
try {
    db()->prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
        ->execute([$username, password_hash($password, PASSWORD_DEFAULT)]);
} catch (PDOException $e) {
    if ($e->getCode() === '23000') { // duplicate username
        json_out(['ok' => false, 'error' => 'username_taken'], 409);
    }
    error_log('auth_register.php: ' . $e->getMessage());
    json_out(['ok' => false, 'error' => 'server_error'], 500);
}
$uid = (int) db()->lastInsertId();
db()->prepare('UPDATE users SET last_login_at = NOW() WHERE id = ?')->execute([$uid]);
json_out(['ok' => true, 'token' => issue_token($uid, (string) ($body['label'] ?? '')), 'user' => ['id' => $uid, 'username' => $username]], 201);
