<?php
// Shared helpers: config, database, sessions, CSRF, JSON responses, login throttling.
// Written for PHP 7.4+ and MariaDB 10.3+ (PDO, no Composer needed).

define('APP_ROOT', dirname(__DIR__));
const GAME_END_CAL = 33.8;          // keep in sync with js/data.js (C.END_CAL)
const MAX_STATE_BYTES = 400000;     // reject absurdly large saves

$__cfgFile = __DIR__ . '/config.php';
if (!is_file($__cfgFile)) {
    http_response_code(500);
    exit('Server not configured: copy inc/config.sample.php to inc/config.php.');
}
$CONFIG = require $__cfgFile;

function cfg(string $key, $default = null)
{
    global $CONFIG;
    return array_key_exists($key, $CONFIG) ? $CONFIG[$key] : $default;
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . cfg('db_host', 'localhost') . ';port=' . (int) cfg('db_port', 3306)
            . ';dbname=' . cfg('db_name') . ';charset=utf8mb4';
        $pdo = new PDO($dsn, cfg('db_user'), cfg('db_pass'), [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    }
    return $pdo;
}

function is_https(): bool
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');
}

/** URL path of the app root, e.g. "" or "/games/shop" (works from the root or from /api). */
function base_url(): string
{
    $dir = str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/'));
    if (substr($dir, -4) === '/api') {
        $dir = substr($dir, 0, -4);
    }
    return rtrim($dir, '/');
}

function start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $life = (int) cfg('session_lifetime', 2592000);
    ini_set('session.gc_maxlifetime', (string) $life);
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_name('csig_sid');
    session_set_cookie_params([
        'lifetime' => $life,
        'path' => base_url() . '/',
        'secure' => is_https(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function csrf_token(): string
{
    start_session();
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

function csrf_ok(?string $token): bool
{
    start_session();
    return is_string($token) && !empty($_SESSION['csrf']) && hash_equals($_SESSION['csrf'], $token);
}

function current_user(): ?array
{
    start_session();
    if (empty($_SESSION['uid'])) {
        return null;
    }
    $st = db()->prepare('SELECT id, username FROM users WHERE id = ?');
    $st->execute([(int) $_SESSION['uid']]);
    $u = $st->fetch();
    return $u ?: null;
}

function log_in(int $uid): void
{
    start_session();
    session_regenerate_id(true);
    $_SESSION['uid'] = $uid;
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
    db()->prepare('UPDATE users SET last_login_at = NOW() WHERE id = ?')->execute([$uid]);
}

function log_out(): void
{
    start_session();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 3600, $p['path'], $p['domain'] ?? '', $p['secure'], $p['httponly']);
    }
    session_destroy();
}

function redirect(string $path): void
{
    header('Location: ' . base_url() . '/' . ltrim($path, '/'));
    exit;
}

function h($s): string
{
    return htmlspecialchars((string) $s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function send_security_headers(): void
{
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: same-origin');
}

/* ---------- JSON API helpers ---------- */

function json_out(array $data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_SLASHES);
    exit;
}

/** Common preamble for API endpoints: POST only, logged in, valid CSRF. Returns [user, body]. */
function api_guard(): array
{
    send_security_headers();
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        header('Allow: POST');
        json_out(['ok' => false, 'error' => 'method_not_allowed'], 405);
    }
    $raw = file_get_contents('php://input', false, null, 0, MAX_STATE_BYTES + 20000);
    if ($raw === false || strlen($raw) > MAX_STATE_BYTES + 10000) {
        json_out(['ok' => false, 'error' => 'too_large'], 413);
    }
    $body = json_decode($raw, true);
    if (!is_array($body)) {
        json_out(['ok' => false, 'error' => 'bad_json'], 400);
    }
    $user = current_user();
    if (!$user) {
        json_out(['ok' => false, 'error' => 'not_logged_in'], 401);
    }
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? ($body['csrf'] ?? null);
    if (!csrf_ok($token)) {
        json_out(['ok' => false, 'error' => 'bad_csrf'], 403);
    }
    // Release the session lock so parallel saves/settings calls don't queue behind each other.
    session_write_close();
    return [$user, $body];
}

/* ---------- login throttling ---------- */

function client_ip_bin(): string
{
    $bin = @inet_pton($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
    return $bin === false ? inet_pton('0.0.0.0') : $bin;
}

function login_blocked(string $username): bool
{
    $since = time() - (int) cfg('login_window', 900);
    $pdo = db();
    $st = $pdo->prepare('SELECT COUNT(*) FROM login_attempts WHERE username = ? AND attempted_at > ?');
    $st->execute([$username, $since]);
    if ((int) $st->fetchColumn() >= (int) cfg('login_max_per_user', 8)) {
        return true;
    }
    $st = $pdo->prepare('SELECT COUNT(*) FROM login_attempts WHERE ip = ? AND attempted_at > ?');
    $st->execute([client_ip_bin(), $since]);
    return (int) $st->fetchColumn() >= (int) cfg('login_max_per_ip', 30);
}

function login_failed(string $username): void
{
    $pdo = db();
    $pdo->prepare('INSERT INTO login_attempts (username, ip, attempted_at) VALUES (?, ?, ?)')
        ->execute([$username, client_ip_bin(), time()]);
    if (mt_rand(1, 20) === 1) { // occasional cleanup
        $pdo->prepare('DELETE FROM login_attempts WHERE attempted_at < ?')->execute([time() - 86400]);
    }
}

/* ---------- settings ---------- */

const THEMES = ['auto', 'win95', 'xp', 'flat', 'rgb'];

function load_settings(int $uid): array
{
    $st = db()->prepare('SELECT theme, show_ticker, show_walkers FROM user_settings WHERE user_id = ?');
    $st->execute([$uid]);
    $r = $st->fetch();
    if (!$r) {
        return ['theme' => 'auto', 'showTicker' => true, 'showWalkers' => true];
    }
    return ['theme' => $r['theme'], 'showTicker' => (bool) $r['show_ticker'], 'showWalkers' => (bool) $r['show_walkers']];
}

/* ---------- save helpers ---------- */

/** Validates a decoded game state. Returns an error string, or null when it looks sane. */
function validate_state($s): ?string
{
    if (!is_array($s)) {
        return 'state_not_object';
    }
    foreach (['cash', 'cal'] as $k) {
        if (!isset($s[$k]) || !is_numeric($s[$k]) || !is_finite((float) $s[$k])) {
            return "bad_$k";
        }
    }
    if ($s['cash'] < 0 || $s['cal'] < 0 || $s['cal'] > GAME_END_CAL + 0.001) {
        return 'out_of_range';
    }
    if (!isset($s['stats']) || !is_array($s['stats']) || !isset($s['up']) || !is_array($s['up'])) {
        return 'missing_fields';
    }
    if (isset($s['meta'])) {
        $m = $s['meta'];
        if (!is_array($m) || !isset($m['tokens']) || !is_numeric($m['tokens']) || $m['tokens'] < 0 || !is_finite((float) $m['tokens'])) {
            return 'bad_meta';
        }
    }
    return null;
}

function clean_name($name): string
{
    $name = preg_replace('/[\x00-\x1F\x7F]/u', '', (string) $name);
    return mb_substr(trim((string) $name), 0, 30, 'UTF-8');
}
