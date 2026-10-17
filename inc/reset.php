<?php
// Password-reset helpers: optional account email, reset tokens, and the emails themselves.
require_once __DIR__ . '/mail.php';

const RESET_LIFETIME = 3600;        // a reset link works for 1 hour
const RESET_MAX_PER_USER_HOUR = 3;  // reset emails per account per hour

function valid_email(string $e): bool
{
    return strlen($e) <= 254 && filter_var($e, FILTER_VALIDATE_EMAIL) !== false;
}

function normalize_email(string $e): string
{
    return strtolower(trim($e));
}

/** "dave@example.com" -> "d***@example.com" (shown in the app so people can tell which address is on file). */
function mask_email(?string $e): ?string
{
    if (!$e || strpos($e, '@') === false) {
        return null;
    }
    [$l, $d] = explode('@', $e, 2);
    return mb_substr($l, 0, 1) . '***@' . $d;
}

function user_email(int $uid): ?string
{
    $st = db()->prepare('SELECT email FROM users WHERE id = ?');
    $st->execute([$uid]);
    $e = $st->fetchColumn();
    return $e ? (string) $e : null;
}

/** Saves (or clears, with '') an account's email. Returns an error code or null. */
function set_user_email(int $uid, string $email): ?string
{
    $email = normalize_email($email);
    if ($email === '') {
        db()->prepare('UPDATE users SET email = NULL WHERE id = ?')->execute([$uid]);
        return null;
    }
    if (!valid_email($email)) {
        return 'bad_email';
    }
    try {
        db()->prepare('UPDATE users SET email = ? WHERE id = ?')->execute([$email, $uid]);
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') {
            return 'email_taken';
        }
        throw $e;
    }
    return null;
}

/** Per-IP throttle for "forgot password" requests (reuses login_attempts; '@forgot' is not a valid username). */
function forgot_blocked(): bool
{
    $st = db()->prepare("SELECT COUNT(*) FROM login_attempts WHERE username = '@forgot' AND ip = ? AND attempted_at > ?");
    $st->execute([client_ip_bin(), time() - 3600]);
    return (int) $st->fetchColumn() >= (int) cfg('forgot_max_per_ip_hour', 5);
}

function forgot_noted(): void
{
    db()->prepare("INSERT INTO login_attempts (username, ip, attempted_at) VALUES ('@forgot', ?, ?)")
        ->execute([client_ip_bin(), time()]);
    sweep_attempts();
}

/** Where the emailed link points (the website's reset page; works for web and app users alike). */
function reset_link(string $token): string
{
    $scheme = is_https() ? 'https' : 'http';
    $host = (string) ($_SERVER['HTTP_HOST'] ?? 'localhost');
    return cfg('public_url') ? rtrim((string) cfg('public_url'), '/') . '/reset-password.php?token=' . $token
        : $scheme . '://' . $host . base_url() . '/reset-password.php?token=' . $token;
}

/**
 * Emails a reset link if an account has this address. Says nothing about whether it did (no account enumeration),
 * so callers always show the same "if that address is on file…" message.
 */
function start_password_reset(string $email): void
{
    $email = normalize_email($email);
    if (!valid_email($email)) {
        return;
    }
    $st = db()->prepare('SELECT id, username FROM users WHERE email = ?');
    $st->execute([$email]);
    $u = $st->fetch();
    if (!$u) {
        return;
    }
    $now = time();
    $st = db()->prepare('SELECT COUNT(*) FROM password_resets WHERE user_id = ? AND created_at > ?');
    $st->execute([$u['id'], $now - 3600]);
    if ((int) $st->fetchColumn() >= RESET_MAX_PER_USER_HOUR) {
        return;
    }
    $token = bin2hex(random_bytes(32));
    db()->prepare('INSERT INTO password_resets (user_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?)')
        ->execute([$u['id'], token_hash($token), $now, $now + RESET_LIFETIME]);
    db()->prepare('DELETE FROM password_resets WHERE expires_at < ?')->execute([$now - 86400]);
    send_mail($email, 'Reset your Mega Byte Computers password',
        "Hi {$u['username']},\n\nSomeone (hopefully you) asked to reset the password for your Mega Byte Computers account.\n\n"
        . "Choose a new password here (the link works for 1 hour, once):\n" . reset_link($token) . "\n\n"
        . "If you didn't ask for this, ignore this email; your password stays the same.\n");
}

/** The user id a still-valid, unused reset token belongs to, or null. */
function reset_token_user(string $token): ?int
{
    if (!preg_match('/^[0-9a-f]{64}$/', $token)) {
        return null;
    }
    $st = db()->prepare('SELECT user_id FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?');
    $st->execute([token_hash($token), time()]);
    $r = $st->fetchColumn();
    return $r === false ? null : (int) $r;
}

/** Sets the new password, burns the token (and any other open ones), signs the account out everywhere, and confirms by email. */
function finish_password_reset(string $token, string $password): bool
{
    $uid = reset_token_user($token);
    if ($uid === null) {
        return false;
    }
    $pdo = db();
    $pdo->beginTransaction();
    $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([password_hash($password, PASSWORD_DEFAULT), $uid]);
    $pdo->prepare('UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL')->execute([time(), $uid]);
    $pdo->prepare('DELETE FROM api_tokens WHERE user_id = ?')->execute([$uid]);
    $pdo->commit();
    if ($email = user_email($uid)) {
        send_mail($email, 'Your Mega Byte Computers password was changed',
            "Your account password was just changed using a reset link, and you were signed out of the app.\n\n"
            . "If this wasn't you, reset it again right away.\n");
    }
    return true;
}
