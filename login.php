<?php
require __DIR__ . '/inc/bootstrap.php';
require __DIR__ . '/inc/page.php';

if (current_user()) {
    redirect('index.php');
}
$errors = [];
$username = '';
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    $username = trim((string) ($_POST['username'] ?? ''));
    $password = (string) ($_POST['password'] ?? '');
    if (!csrf_ok($_POST['csrf'] ?? null)) {
        $errors[] = 'Your session expired. Please try again.';
    } elseif (login_blocked($username)) {
        $errors[] = 'Too many failed attempts. Wait a few minutes and try again.';
    } else {
        $st = db()->prepare('SELECT id, password_hash FROM users WHERE username = ?');
        $st->execute([$username]);
        $u = $st->fetch();
        // Always run a hash check so response time does not reveal whether the user exists.
        $hash = $u ? $u['password_hash'] : password_hash('no-such-user', PASSWORD_DEFAULT);
        $ok = password_verify($password, $hash) && $u;
        if ($ok) {
            if (password_needs_rehash($u['password_hash'], PASSWORD_DEFAULT)) {
                db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?')
                    ->execute([password_hash($password, PASSWORD_DEFAULT), $u['id']]);
            }
            log_in((int) $u['id']);
            redirect('index.php');
        }
        login_failed($username);
        $errors[] = 'Wrong username or password.';
    }
}
page_head('Log in');
flash_errors($errors);
?>
<form method="post" class="list" autocomplete="on">
  <?= csrf_field() ?>
  <div class="field"><label for="u">Username</label><input type="text" id="u" name="username" value="<?= h($username) ?>" maxlength="20" autocomplete="username" required autofocus></div>
  <div class="field"><label for="p">Password</label><input type="password" id="p" name="password" autocomplete="current-password" required></div>
  <button class="primary" type="submit">Log in</button>
</form>
<?php if (cfg('allow_registration', true)): ?>
<small>New here? <a href="register.php">Open a shop</a></small>
<?php endif;
page_foot();
