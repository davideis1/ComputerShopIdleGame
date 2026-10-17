<?php
require __DIR__ . '/inc/bootstrap.php';
require __DIR__ . '/inc/reset.php';
require __DIR__ . '/inc/page.php';

$errors = [];
$sent = false;
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    $email = normalize_email((string) ($_POST['email'] ?? ''));
    if (!csrf_ok($_POST['csrf'] ?? null)) {
        $errors[] = 'Your session expired. Please try again.';
    } elseif (!valid_email($email)) {
        $errors[] = 'Enter a valid email address.';
    } elseif (forgot_blocked()) {
        $errors[] = 'Too many requests. Try again in an hour.';
    } else {
        forgot_noted();
        try {
            start_password_reset($email);
        } catch (Throwable $e) {
            error_log('forgot.php: ' . $e->getMessage());
        }
        $sent = true;
    }
}
page_head('Forgot password');
flash_errors($errors);
if ($sent) {
    echo '<div class="alert">If that address is on file, we have emailed a link to reset the password. It works for 1 hour.</div>'
        . '<small><a href="login.php">Back to login</a></small>';
    page_foot();
    exit;
}
?>
<p>Enter the email address on your account and we'll send you a reset link.</p>
<form method="post" class="list">
  <?= csrf_field() ?>
  <div class="field"><label for="e">Email</label><input type="email" id="e" name="email" maxlength="254" autocomplete="email" required autofocus></div>
  <button class="primary" type="submit">Send reset link</button>
</form>
<small>No email on your account? You can add one under Account once you're signed in. Otherwise
<a href="support.php">contact support</a>.</small>
<?php page_foot();
