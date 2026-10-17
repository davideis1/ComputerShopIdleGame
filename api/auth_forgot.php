<?php
// POST {email}  ->  {ok}   Emails a reset link if an account has that address. Always answers {ok:true} for a well-formed
// request, so it cannot be used to find out which addresses have accounts. Errors: too_many_attempts 429, bad_email 422.
require __DIR__ . '/../inc/bootstrap.php';
require __DIR__ . '/../inc/reset.php';
$body = api_public();

$email = normalize_email((string) ($body['email'] ?? ''));
if (!valid_email($email)) {
    json_out(['ok' => false, 'error' => 'bad_email'], 422);
}
if (forgot_blocked()) {
    json_out(['ok' => false, 'error' => 'too_many_attempts'], 429);
}
forgot_noted();
try {
    start_password_reset($email);
} catch (Throwable $e) {
    error_log('auth_forgot.php: ' . $e->getMessage()); // still answer ok: the caller must not learn anything
}
json_out(['ok' => true]);
