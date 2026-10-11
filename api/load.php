<?php
// POST {}  ->  {ok, state: <object|null>, rev, elapsed}   (same data index.php embeds; used to re-check after a reload race)
require __DIR__ . '/../inc/bootstrap.php';
[$user, $body] = api_guard();
$st = db()->prepare('SELECT state, rev, server_saved_at FROM saves WHERE user_id = ?');
$st->execute([(int) $user['id']]);
$row = $st->fetch();
$state = $row ? json_decode($row['state'], true) : null;
json_out([
    'ok' => true,
    'state' => is_array($state) ? $state : null,
    'rev' => $row ? (int) $row['rev'] : 0,
    'elapsed' => $row ? max(0, time() - (int) $row['server_saved_at']) : 0,
]);
