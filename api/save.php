<?php
// POST {state: <json string>, rev: <int>, force?: bool}  ->  {ok, rev, server_time}
require __DIR__ . '/../inc/bootstrap.php';
[$user, $body] = api_guard();
$uid = (int) $user['id'];

$stateStr = $body['state'] ?? null;
if (!is_string($stateStr) || strlen($stateStr) > MAX_STATE_BYTES) {
    json_out(['ok' => false, 'error' => 'bad_state'], 400);
}
$state = json_decode($stateStr, true);
if (($err = validate_state($state)) !== null) {
    json_out(['ok' => false, 'error' => $err], 422);
}
$baseRev = (int) ($body['rev'] ?? 0);
$force = !empty($body['force']);

$sold = (float) ($state['stats']['sold'] ?? 0);
$built = (float) ($state['stats']['built'] ?? 0);
$play = (float) ($state['stats']['play'] ?? 0);
$ach = isset($state['ach']) && is_array($state['ach']) ? count($state['ach']) : 0;
$name = clean_name($state['name'] ?? '');
$cal = (float) $state['cal'];
$cash = (float) $state['cash'];
$now = time();

$pdo = db();
$pdo->beginTransaction();
try {
    $st = $pdo->prepare('SELECT rev, server_saved_at FROM saves WHERE user_id = ? FOR UPDATE');
    $st->execute([$uid]);
    $row = $st->fetch();

    if (!$row) {
        $pdo->prepare('INSERT INTO saves (user_id, state, rev, server_saved_at, shop_name, game_years, cash, total_sold, total_built, play_seconds, achievements)
                       VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)')
            ->execute([$uid, $stateStr, $now, $name, $cal, $cash, $sold, $built, $play, $ach]);
        $newRev = 1;
    } else {
        $rev = (int) $row['rev'];
        if (!$force && $baseRev !== $rev) {
            $pdo->rollBack();
            json_out(['ok' => false, 'error' => 'conflict', 'rev' => $rev], 409);
        }
        // Rolling safety snapshot of the state we are about to replace (at most one per 10 min).
        $st = $pdo->prepare('SELECT MAX(UNIX_TIMESTAMP(created_at)) FROM save_backups WHERE user_id = ?');
        $st->execute([$uid]);
        $lastBackup = (int) $st->fetchColumn();
        if ($now - $lastBackup >= 600) {
            $pdo->prepare('INSERT INTO save_backups (user_id, state, rev, game_years)
                           SELECT user_id, state, rev, game_years FROM saves WHERE user_id = ?')->execute([$uid]);
            $pdo->prepare('DELETE FROM save_backups WHERE user_id = ? AND id NOT IN (
                               SELECT id FROM (SELECT id FROM save_backups WHERE user_id = ? ORDER BY id DESC LIMIT 5) keep)')
                ->execute([$uid, $uid]);
        }
        $newRev = $rev + 1;
        $pdo->prepare('UPDATE saves SET state = ?, rev = ?, server_saved_at = ?, shop_name = ?, game_years = ?, cash = ?,
                       total_sold = ?, total_built = ?, play_seconds = ?, achievements = ? WHERE user_id = ?')
            ->execute([$stateStr, $newRev, $now, $name, $cal, $cash, $sold, $built, $play, $ach, $uid]);
    }
    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('save.php: ' . $e->getMessage());
    json_out(['ok' => false, 'error' => 'server_error'], 500);
}
json_out(['ok' => true, 'rev' => $newRev, 'server_time' => $now]);
