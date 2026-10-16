<?php
// Public support page (the app stores ask for a support URL). No login needed.
require __DIR__ . '/inc/bootstrap.php';
require __DIR__ . '/inc/page.php';
$email = trim((string) cfg('contact_email', ''));
page_head('Support');
?>
<h3>Do I need an account?</h3>
<p>No. The game works fully without one and saves on your phone. An account adds a cloud copy of your shop, so you can switch phones, restore it after a reinstall, or play the same shop on the website.</p>

<h3>My progress is not syncing</h3>
<ul>
  <li>Check your connection. The app keeps playing offline and syncs when it can (Menu, then Account shows the status).</li>
  <li>Tap <i>Sync now</i> in Menu, then Account.</li>
  <li>If it asks which shop to keep, it found different progress on this phone and in your account. Pick the one you want; the other is replaced.</li>
  <li>If you see "session expired", sign in again. Your shop stays on the phone.</li>
</ul>

<h3>I forgot my password</h3>
<p>There is no automatic reset yet. Contact us (below) with your username and we will help.</p>

<h3>Deleting my account or data</h3>
<p>In the app: Menu, then Account, then <i>Delete account</i>. On the website: the <a href="<?= h(base_url()) ?>/account.php">Account page</a>. See the <a href="<?= h(base_url()) ?>/privacy.php">privacy policy</a> for what is removed.</p>

<h3>Contact</h3>
<?php if ($email !== ''): ?>
<p><a href="mailto:<?= h($email) ?>"><?= h($email) ?></a></p>
<?php else: ?>
<div class="alert warn">The site owner has not published a contact address yet.</div>
<?php endif;
page_foot();
