<?php
// POST {}  ->  deletes the player's save (settings are kept). Backups are kept for recovery.
require __DIR__ . '/../inc/bootstrap.php';
[$user, $body] = api_guard();
$uid = (int) $user['id'];
$pdo = db();
$pdo->beginTransaction();
// Keep one last snapshot so an accidental reset can be undone by an admin.
$pdo->prepare('INSERT INTO save_backups (user_id, state, rev, game_years)
               SELECT user_id, state, rev, game_years FROM saves WHERE user_id = ?')->execute([$uid]);
$pdo->prepare('DELETE FROM saves WHERE user_id = ?')->execute([$uid]);
$pdo->commit();
json_out(['ok' => true]);
