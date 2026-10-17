<?php
require __DIR__ . '/inc/bootstrap.php';
require __DIR__ . '/inc/reset.php';
require __DIR__ . '/inc/page.php';

if (current_user()) {
    redirect('index.php');
}
$errors = [];
$username = '';
$email = '';
$open = (bool) cfg('allow_registration', true);
if ($open && ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    $username = trim((string) ($_POST['username'] ?? ''));
    $pw = (string) ($_POST['password'] ?? '');
    $pw2 = (string) ($_POST['password2'] ?? '');
    $email = normalize_email((string) ($_POST['email'] ?? ''));
    if (!csrf_ok($_POST['csrf'] ?? null)) {
        $errors[] = 'Your session expired. Please try again.';
    } else {
        if (!valid_username($username)) {
            $errors[] = 'Username must be 3–20 characters: letters, numbers, _ or -.';
        }
        if (strlen($pw) < 8) {
            $errors[] = 'Password must be at least 8 characters.';
        }
        if (strlen($pw) > 200) {
            $errors[] = 'Password is too long.';
        }
        if ($email !== '' && !valid_email($email)) {
            $errors[] = 'That email address does not look right (or leave it empty).';
        }
        if ($pw !== $pw2) {
            $errors[] = 'Passwords do not match.';
        }
        if (!$errors) {
            try {
                db()->prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)')
                    ->execute([$username, $email === '' ? null : $email, password_hash($pw, PASSWORD_DEFAULT)]);
                log_in((int) db()->lastInsertId());
                redirect('index.php');
            } catch (PDOException $e) {
                if ($e->getCode() === '23000') { // duplicate username or email
                    $errors[] = strpos($e->getMessage(), 'uq_users_email') !== false ? 'That email address is already used by another account.' : 'That username is taken.';
                } else {
                    error_log('register.php: ' . $e->getMessage());
                    $errors[] = 'Could not create the account. Please try again.';
                }
            }
        }
    }
}
page_head('Open a shop');
if (!$open) {
    echo '<div class="alert warn">Registration is currently closed.</div><small><a href="login.php">Back to login</a></small>';
    page_foot();
    exit;
}
flash_errors($errors);
?>
<form method="post" class="list">
  <?= csrf_field() ?>
  <div class="field"><label for="u">Username</label><input type="text" id="u" name="username" value="<?= h($username) ?>" maxlength="20" autocomplete="username" required autofocus></div>
  <div class="field"><label for="p">Password (8+ characters)</label><input type="password" id="p" name="password" autocomplete="new-password" required></div>
  <div class="field"><label for="p2">Repeat password</label><input type="password" id="p2" name="password2" autocomplete="new-password" required></div>
  <div class="field"><label for="e">Email (optional, only used to reset a forgotten password)</label><input type="email" id="e" name="email" value="<?= h($email) ?>" maxlength="254" autocomplete="email"></div>
  <button class="primary" type="submit">Create account</button>
</form>
<small>Already have a shop? <a href="login.php">Log in</a>. There is no email on file, so passwords cannot be reset by email — keep yours safe.</small>
<?php page_foot();
