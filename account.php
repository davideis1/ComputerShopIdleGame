<?php
require __DIR__ . '/inc/bootstrap.php';
require __DIR__ . '/inc/reset.php';
require __DIR__ . '/inc/page.php';

$user = current_user();
if (!$user) {
    redirect('login.php');
}
$errors = [];
$notice = '';
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    $action = $_POST['action'] ?? '';
    $cur = (string) ($_POST['current'] ?? '');
    $st = db()->prepare('SELECT password_hash FROM users WHERE id = ?');
    $st->execute([$user['id']]);
    $hash = (string) $st->fetchColumn();
    if (!csrf_ok($_POST['csrf'] ?? null)) {
        $errors[] = 'Your session expired. Please try again.';
    } elseif (!password_verify($cur, $hash)) {
        $errors[] = 'Current password is wrong.';
    } elseif ($action === 'password') {
        $new = (string) ($_POST['new'] ?? '');
        if (strlen($new) < 8 || strlen($new) > 200) {
            $errors[] = 'New password must be 8–200 characters.';
        } elseif ($new !== (string) ($_POST['new2'] ?? '')) {
            $errors[] = 'New passwords do not match.';
        } else {
            db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?')
                ->execute([password_hash($new, PASSWORD_DEFAULT), $user['id']]);
            session_regenerate_id(true);
            $notice = 'Password changed.';
        }
    } elseif ($action === 'email') {
        $err = set_user_email((int) $user['id'], (string) ($_POST['email'] ?? ''));
        if ($err === 'bad_email') {
            $errors[] = 'That email address does not look right.';
        } elseif ($err === 'email_taken') {
            $errors[] = 'That email address is already used by another account.';
        } else {
            $notice = trim((string) ($_POST['email'] ?? '')) === '' ? 'Email removed.' : 'Email saved.';
        }
    } elseif ($action === 'delete' && ($_POST['confirm'] ?? '') === 'DELETE') {
        db()->prepare('DELETE FROM users WHERE id = ?')->execute([$user['id']]); // cascades to saves/settings/backups
        log_out();
        redirect('login.php');
    } elseif ($action === 'delete') {
        $errors[] = 'Type DELETE to confirm.';
    }
}
page_head('Account');
flash_errors($errors);
if ($notice) {
    echo '<div class="alert">' . h($notice) . '</div>';
}
?>
<p>Signed in as <b><?= h($user['username']) ?></b>. <a href="index.php">← Back to the shop</a></p>
<form method="post" class="list">
  <?= csrf_field() ?><input type="hidden" name="action" value="password">
  <b>Change password</b>
  <input type="password" name="current" placeholder="Current password" autocomplete="current-password" required>
  <input type="password" name="new" placeholder="New password (8+ characters)" autocomplete="new-password" required>
  <input type="password" name="new2" placeholder="Repeat new password" autocomplete="new-password" required>
  <button type="submit">Change password</button>
</form>
<hr>
<form method="post" class="list">
  <?= csrf_field() ?><input type="hidden" name="action" value="email">
  <b>Email for password resets</b>
  <small>Optional. Only used to send a reset link if you forget your password. Leave empty to remove it.</small>
  <input type="email" name="email" value="<?= h((string) user_email((int) $user['id'])) ?>" placeholder="you@example.com" maxlength="254" autocomplete="email">
  <input type="password" name="current" placeholder="Current password" autocomplete="current-password" required>
  <button type="submit">Save email</button>
</form>
<hr>
<form method="post" class="list" onsubmit="return confirm('Delete your account and shop forever?');">
  <?= csrf_field() ?><input type="hidden" name="action" value="delete">
  <b>Delete account</b>
  <small>Permanently removes your shop, saves and settings.</small>
  <input type="password" name="current" placeholder="Current password" autocomplete="current-password" required>
  <input type="text" name="confirm" placeholder="Type DELETE" autocomplete="off" required>
  <button type="submit" class="danger">Delete my account</button>
</form>
<?php page_foot();
