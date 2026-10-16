<?php
// Public privacy policy (required by the App Store and Google Play). No login needed.
require __DIR__ . '/inc/bootstrap.php';
require __DIR__ . '/inc/page.php';
$email = trim((string) cfg('contact_email', ''));
page_head('Privacy policy');
?>
<p><small>Last updated 16 October 2026</small></p>
<p><b>Mega Byte Computers</b> is a free single-player idle game. This page explains what information the game (the website and the mobile app) handles. In short: <b>no ads, no analytics, no tracking</b>, and nothing leaves your phone unless you choose to make an account.</p>

<h3>If you play without an account</h3>
<p>Your shop is saved only on your device. The app does not contact our server and we receive nothing from you.</p>

<h3>If you create an account</h3>
<p>We store what is needed to sign you in and keep your shop safe:</p>
<ul>
  <li><b>Username</b> and a <b>password</b>. The password is stored only as a one-way hash; nobody, including us, can read it.</li>
  <li><b>Your game progress</b>: the saved state of your shop (shop name, cash, upgrades, stock, statistics, trophies) plus up to five recent backups of it.</li>
  <li><b>Sign-in tokens</b> (stored hashed) with a device label such as "iPhone", and the times they were created and last used.</li>
  <li><b>A random install ID</b> made by the app, used only to tell your devices apart when saving. It is not linked to your identity outside the game.</li>
  <li><b>Security records</b>: failed sign-ins and sign-ups are recorded with the username and IP address for a short time, to block password guessing and automated sign-ups. These records are deleted automatically after about a day.</li>
</ul>
<p>Our web host also keeps ordinary server logs (IP address, time, page requested) under its own policy.</p>

<h3>What we do not do</h3>
<ul>
  <li>No advertising, analytics, crash-reporting or other third-party SDKs.</li>
  <li>No tracking across apps or websites, and no selling or sharing of your data.</li>
  <li>The app does not ask for your location, contacts, photos, camera, microphone or any other device permission.</li>
</ul>

<h3>How we use it</h3>
<p>Only to sign you in, save and restore your shop, sync it between your devices, and prevent abuse. Your data is stored on a server run by our hosting provider (IONOS), which processes it on our behalf.</p>

<h3>Keeping and deleting your data</h3>
<p>We keep your account and saves until you delete the account. You can delete it yourself at any time, immediately and permanently:</p>
<ul>
  <li><b>In the app:</b> Menu, then Account, then <i>Delete account</i>.</li>
  <li><b>On the website:</b> <a href="<?= h(base_url()) ?>/account.php">Account page</a>, then <i>Delete my account</i>.</li>
</ul>
<p>This removes your account, saves, backups, settings and sign-in tokens. The shop stored on your own phone stays there until you erase it (Menu, then Erase all) or uninstall the app.</p>

<h3>Security</h3>
<p>All traffic uses HTTPS. In the app, your sign-in token is kept in the iOS Keychain or Android Keystore.</p>

<h3>Children</h3>
<p>The game is not directed at children under 13 and we do not knowingly collect personal information from them. If you believe a child has made an account, contact us and we will delete it.</p>

<h3>Your rights</h3>
<p>Depending on where you live (for example in the EU or UK) you may have the right to access, correct or delete your data, or to object to how it is used. Deleting your account covers most of this; for anything else, contact us.</p>

<h3>Changes</h3>
<p>If this policy changes, the date above will change. Material changes will also be announced in the app.</p>

<h3>Contact</h3>
<?php if ($email !== ''): ?>
<p><a href="mailto:<?= h($email) ?>"><?= h($email) ?></a></p>
<?php else: ?>
<div class="alert warn">The site owner has not published a contact address yet.</div>
<?php endif; ?>
<p><small>All brand and product names in the game are parodies and not affiliated with any real company.</small></p>
<?php page_foot();
