<?php
// POST {all?: bool}  with  Authorization: Bearer <token>  ->  {ok}
// Revokes the token that made the request (or every token for the account when all is true).
require __DIR__ . '/../inc/bootstrap.php';
[$user, $body] = api_guard();
$token = bearer_token();
if ($token === null) {
    json_out(['ok' => false, 'error' => 'no_token'], 400);
}
if (!empty($body['all'])) {
    db()->prepare('DELETE FROM api_tokens WHERE user_id = ?')->execute([(int) $user['id']]);
} else {
    revoke_token($token);
}
json_out(['ok' => true]);
