<?php
// POST {username, password, email?, label?}  ->  {ok, token, user: {id, username, email}}  (email is masked, or null)   (native app sign-up)
// Errors: bad_email 422, email_taken 409, registration_closed 403, too_many_attempts 429, bad_username / bad_password 422, username_taken 409.
require __DIR__ . '/../inc/bootstrap.php';
require __DIR__ . '/../inc/reset.php';
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
$email = normalize_email((string) ($body['email'] ?? ''));
if ($email !== '' && !valid_email($email)) {
    json_out(['ok' => false, 'error' => 'bad_email'], 422);
}
register_noted();
try {
    db()->prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)')
        ->execute([$username, $email === '' ? null : $email, password_hash($password, PASSWORD_DEFAULT)]);
} catch (PDOException $e) {
    if ($e->getCode() === '23000') { // duplicate username or email
        json_out(['ok' => false, 'error' => strpos($e->getMessage(), 'uq_users_email') !== false ? 'email_taken' : 'username_taken'], 409);
    }
    error_log('auth_register.php: ' . $e->getMessage());
    json_out(['ok' => false, 'error' => 'server_error'], 500);
}
$uid = (int) db()->lastInsertId();
db()->prepare('UPDATE users SET last_login_at = NOW() WHERE id = ?')->execute([$uid]);
json_out(['ok' => true, 'token' => issue_token($uid, (string) ($body['label'] ?? '')), 'user' => ['id' => $uid, 'username' => $username, 'email' => mask_email($email)]], 201);
