<?php
require __DIR__ . '/inc/bootstrap.php';
require __DIR__ . '/inc/reset.php';
require __DIR__ . '/inc/page.php';

$token = (string) ($_GET['token'] ?? $_POST['token'] ?? '');
$errors = [];
$done = false;
$valid = reset_token_user($token) !== null;
if ($valid && ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    $pw = (string) ($_POST['password'] ?? '');
    if (!csrf_ok($_POST['csrf'] ?? null)) {
        $errors[] = 'Your session expired. Please try again.';
    } elseif (strlen($pw) < 8 || strlen($pw) > 200) {
        $errors[] = 'Password must be 8–200 characters.';
    } elseif ($pw !== (string) ($_POST['password2'] ?? '')) {
        $errors[] = 'Passwords do not match.';
    } elseif (finish_password_reset($token, $pw)) {
        $done = true;
    } else {
        $errors[] = 'This link has expired. Ask for a new one.';
    }
}
page_head('Reset password');
if ($done) {
    echo '<div class="alert">Your password has been changed. You were signed out of the app everywhere, so sign in again with the new password.</div>'
        . '<small><a href="login.php">Log in</a></small>';
    page_foot();
    exit;
}
if (!$valid) {
    echo '<div class="alert bad">This reset link is invalid or has expired.</div><small><a href="forgot.php">Ask for a new link</a></small>';
    page_foot();
    exit;
}
flash_errors($errors);
?>
<form method="post" class="list">
  <?= csrf_field() ?><input type="hidden" name="token" value="<?= h($token) ?>">
  <div class="field"><label for="p">New password (8+ characters)</label><input type="password" id="p" name="password" autocomplete="new-password" required autofocus></div>
  <div class="field"><label for="p2">Repeat password</label><input type="password" id="p2" name="password2" autocomplete="new-password" required></div>
  <button class="primary" type="submit">Change password</button>
</form>
<?php page_foot();
