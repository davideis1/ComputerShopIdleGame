<?php
require __DIR__ . '/inc/bootstrap.php';

$user = current_user();
if (!$user) {
    redirect('login.php');
}
send_security_headers();
header('Cache-Control: no-store');

$st = db()->prepare('SELECT state, rev, server_saved_at FROM saves WHERE user_id = ?');
$st->execute([$user['id']]);
$row = $st->fetch();
$state = $row ? json_decode($row['state'], true) : null;
$boot = [
    'user' => ['id' => (int) $user['id'], 'name' => $user['username']],
    'csrf' => csrf_token(),
    'rev' => $row ? (int) $row['rev'] : 0,
    'state' => is_array($state) ? $state : null,
    // Offline time is measured on the server clock, so changing the device clock cannot cheat it.
    'elapsed' => $row ? max(0, time() - (int) $row['server_saved_at']) : 0,
    'settings' => load_settings((int) $user['id']),
    'base' => base_url(),
    'version' => json_decode((string) @file_get_contents(__DIR__ . '/version.json'), true) ?: ['major' => 1, 'minor' => 0, 'build' => 0],
    'changelog' => json_decode((string) @file_get_contents(__DIR__ . '/changelog.json'), true) ?: [],
];
// JSON_HEX_* keeps user-entered text (shop name, blueprint names) from breaking out of the script tag.
$bootJson = json_encode($boot, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_PARTIAL_OUTPUT_ON_ERROR);
$v = static function (string $f): string { return (string) @filemtime(__DIR__ . '/' . $f); };
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<meta name="theme-color" content="#008080">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<title>Mega Byte Computers — Idle Shop</title>
<meta name="description" content="An idle game where you run a computer shop from 1993 to today.">
<link rel="manifest" href="manifest.json">
<link rel="icon" href="icon.svg" type="image/svg+xml">
<link rel="stylesheet" href="style.css?v=<?= $v('style.css') ?>">
</head>
<body data-theme="win95">
<div id="app">
  <header id="top" class="panel">
    <div class="title"><span id="shopName">Mega Byte Computers</span><span class="era"><span id="repChip" class="repchip" title="Shop rating (see the Reputation panel on the Shop tab)">★ 3.0</span> <span id="eraName"></span></span></div>
    <div class="topbody">
      <div class="stat"><small>Date</small><b id="date">Jan 1993</b></div>
      <div class="stat grow"><small>Cash</small><b id="cash" class="money">$0</b></div>
      <div class="stat" id="tokStat" hidden><small>Tokens</small><b id="tokens">0</b></div>
      <div class="stat"><small>Sales / min</small><b id="income">$0</b></div>
    </div>
    <div class="yearbar" title="Progress through the year"><i id="yearBar"></i></div>
    <div id="ticker"><span id="tickerText"></span></div>
  </header>

  <main id="main">
    <section id="tab-shop" class="tab"></section>
    <section id="tab-catalog" class="tab" hidden></section>
    <section id="tab-buyers" class="tab" hidden></section>
    <section id="tab-workshop" class="tab" hidden></section>
    <section id="tab-service" class="tab" hidden></section>
    <section id="tab-upgrades" class="tab" hidden></section>
    <section id="tab-franchise" class="tab" hidden></section>
    <section id="tab-menu" class="tab" hidden></section>
  </main>

  <nav id="nav">
    <button data-tab="shop" class="on"><i>🏪</i><span>Shop</span></button>
    <button data-tab="catalog"><i>📦</i><span>Stock</span><em id="badge-catalog" hidden>!</em></button>
    <button data-tab="buyers" id="nav-buyers" hidden><i>👔</i><span>Managers</span><em id="badge-buyers" hidden>!</em></button>
    <button data-tab="workshop"><i>🛠️</i><span>Workshop</span></button>
    <button data-tab="service" id="nav-service" hidden><i>🛎️</i><span>Service</span></button>
    <button data-tab="upgrades"><i>📈</i><span>Upgrades</span><em id="badge-upgrades" hidden>!</em></button>
    <button data-tab="franchise" id="nav-franchise" hidden><i>🎫</i><span>HQ</span><em id="badge-franchise" hidden>!</em></button>
    <button data-tab="menu"><i>⚙️</i><span>Menu</span></button>
  </nav>
</div>
<div id="toasts"></div>
<div id="modal" hidden></div>

<script>window.CSIG = <?= $bootJson ?>;</script>
<script src="core/data.js?v=<?= $v('core/data.js') ?>"></script>
<script src="core/addons.js?v=<?= $v('core/addons.js') ?>"></script>
<script src="core/engine.js?v=<?= $v('core/engine.js') ?>"></script>
<script src="core/consoles.js?v=<?= $v('core/consoles.js') ?>"></script>
<script src="core/names.js?v=<?= $v('core/names.js') ?>"></script>
<script src="core/managers.js?v=<?= $v('core/managers.js') ?>"></script>
<script src="core/offers.js?v=<?= $v('core/offers.js') ?>"></script>
<script src="core/advisor.js?v=<?= $v('core/advisor.js') ?>"></script>
<script src="js/ui.js?v=<?= $v('js/ui.js') ?>"></script>
</body>
</html>
