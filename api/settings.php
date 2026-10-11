<?php
// POST {theme?, showTicker?, showWalkers?}  ->  {ok, settings}
require __DIR__ . '/../inc/bootstrap.php';
[$user, $body] = api_guard();
$uid = (int) $user['id'];

$cur = load_settings($uid);
if (isset($body['theme'])) {
    if (!in_array($body['theme'], THEMES, true)) {
        json_out(['ok' => false, 'error' => 'bad_theme'], 422);
    }
    $cur['theme'] = $body['theme'];
}
foreach (['showTicker', 'showWalkers'] as $k) {
    if (isset($body[$k])) {
        $cur[$k] = (bool) $body[$k];
    }
}
db()->prepare('INSERT INTO user_settings (user_id, theme, show_ticker, show_walkers) VALUES (?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE theme = VALUES(theme), show_ticker = VALUES(show_ticker), show_walkers = VALUES(show_walkers)')
    ->execute([$uid, $cur['theme'], (int) $cur['showTicker'], (int) $cur['showWalkers']]);
json_out(['ok' => true, 'settings' => $cur]);
