<?php
// Shared helpers: config, database, sessions, CSRF, JSON responses, login throttling.
// Written for PHP 7.4+ and MariaDB 10.3+ (PDO, no Composer needed).

define('APP_ROOT', dirname(__DIR__));
const GAME_END_CAL = 42.8;          // keep in sync with core/data.js (C.END_CAL); tools/limits-check.js fails if they drift
const MAX_STATE_BYTES = 400000;     // reject absurdly large saves
const TOKEN_LIFETIME = 15552000;    // 180 days, sliding: every use pushes the expiry out again
const MAX_TOKENS_PER_USER = 10;     // oldest tokens are dropped when a user signs in on more devices than this

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

/* ---------- API tokens (native app) ---------- */

/** The raw token from "Authorization: Bearer <64 hex>" (or X-Api-Token, for hosts that strip Authorization). */
function bearer_token(): ?string
{
    $h = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if ($h !== '' && preg_match('/^Bearer\s+([0-9a-f]{64})$/i', trim($h), $m)) {
        return strtolower($m[1]);
    }
    $x = trim($_SERVER['HTTP_X_API_TOKEN'] ?? '');
    return preg_match('/^[0-9a-f]{64}$/i', $x) ? strtolower($x) : null;
}

function token_hash(string $token): string
{
    return hash('sha256', $token);
}

/** Creates a token for a user and returns the raw value (the only time it is ever visible). */
function issue_token(int $uid, string $label = ''): string
{
    $token = bin2hex(random_bytes(32));
    $now = time();
    $pdo = db();
    $pdo->prepare('INSERT INTO api_tokens (user_id, token_hash, label, last_used_at, expires_at) VALUES (?, ?, ?, ?, ?)')
        ->execute([$uid, token_hash($token), mb_substr(preg_replace('/[\x00-\x1F\x7F]/u', '', $label), 0, 40, 'UTF-8'), $now, $now + TOKEN_LIFETIME]);
    // Keep only the newest MAX_TOKENS_PER_USER, and sweep anything long expired.
    $pdo->prepare('DELETE FROM api_tokens WHERE user_id = ? AND id NOT IN (
                       SELECT id FROM (SELECT id FROM api_tokens WHERE user_id = ? ORDER BY id DESC LIMIT ' . MAX_TOKENS_PER_USER . ') keep)')
        ->execute([$uid, $uid]);
    $pdo->prepare('DELETE FROM api_tokens WHERE expires_at < ?')->execute([$now]);
    return $token;
}

/** The user a token belongs to, or null if it is unknown or expired. Slides the expiry forward (at most every 10 min). */
function user_from_token(string $token): ?array
{
    $now = time();
    $st = db()->prepare('SELECT t.id AS tid, t.last_used_at, u.id, u.username
                         FROM api_tokens t JOIN users u ON u.id = t.user_id
                         WHERE t.token_hash = ? AND t.expires_at > ?');
    $st->execute([token_hash($token), $now]);
    $r = $st->fetch();
    if (!$r) {
        return null;
    }
    if ($now - (int) $r['last_used_at'] >= 600) {
        db()->prepare('UPDATE api_tokens SET last_used_at = ?, expires_at = ? WHERE id = ?')
            ->execute([$now, $now + TOKEN_LIFETIME, $r['tid']]);
    }
    return ['id' => (int) $r['id'], 'username' => $r['username']];
}

function revoke_token(string $token): void
{
    db()->prepare('DELETE FROM api_tokens WHERE token_hash = ?')->execute([token_hash($token)]);
}

/** Reads and validates a JSON POST body (size-limited). Exits with an error response on any problem. */
function read_json_body(int $maxBytes): array
{
    send_security_headers();
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        header('Allow: POST');
        json_out(['ok' => false, 'error' => 'method_not_allowed'], 405);
    }
    $raw = file_get_contents('php://input', false, null, 0, $maxBytes + 1);
    if ($raw === false || strlen($raw) > $maxBytes) {
        json_out(['ok' => false, 'error' => 'too_large'], 413);
    }
    $body = json_decode($raw, true);
    if (!is_array($body)) {
        json_out(['ok' => false, 'error' => 'bad_json'], 400);
    }
    return $body;
}

/** For endpoints that run before anyone is logged in (register, login): POST + small JSON body, no auth. */
function api_public(): array
{
    return read_json_body(4000);
}

/**
 * Common preamble for API endpoints: POST only, logged in, valid JSON. Returns [user, body].
 * Two ways to prove who you are:
 *  - the website: session cookie + CSRF token (a browser attaches cookies by itself, so CSRF matters);
 *  - the native app: "Authorization: Bearer <token>" (never sent automatically, so no CSRF token is needed).
 * If a bearer token is present it alone decides; a bad one is rejected rather than falling back to the cookie.
 */
function api_guard(): array
{
    $body = read_json_body(MAX_STATE_BYTES + 10000);
    $token = bearer_token();
    if ($token !== null) {
        $user = user_from_token($token);
        if (!$user) {
            json_out(['ok' => false, 'error' => 'bad_token'], 401);
        }
        return [$user, $body];
    }
    $user = current_user();
    if (!$user) {
        json_out(['ok' => false, 'error' => 'not_logged_in'], 401);
    }
    $csrf = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? ($body['csrf'] ?? null);
    if (!csrf_ok($csrf)) {
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

/** Throttling records (username + IP) are only needed for a short window; drop anything older than a day, now and then. */
function sweep_attempts(): void
{
    if (mt_rand(1, 20) === 1) {
        db()->prepare('DELETE FROM login_attempts WHERE attempted_at < ?')->execute([time() - 86400]);
    }
}

function login_failed(string $username): void
{
    db()->prepare('INSERT INTO login_attempts (username, ip, attempted_at) VALUES (?, ?, ?)')
        ->execute([$username, client_ip_bin(), time()]);
    sweep_attempts();
}

/** Sign-ups per IP per hour (the API is open to anyone with the URL, so keep scripted account spam in check). */
function register_blocked(): bool
{
    $st = db()->prepare("SELECT COUNT(*) FROM login_attempts WHERE username = '@register' AND ip = ? AND attempted_at > ?");
    $st->execute([client_ip_bin(), time() - 3600]);
    return (int) $st->fetchColumn() >= (int) cfg('register_max_per_ip_hour', 5);
}

function register_noted(): void
{
    db()->prepare("INSERT INTO login_attempts (username, ip, attempted_at) VALUES ('@register', ?, ?)")
        ->execute([client_ip_bin(), time()]);
    sweep_attempts();
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

function valid_username(string $u): bool
{
    return (bool) preg_match('/^[A-Za-z0-9_-]{3,20}$/', $u);
}

function clean_name($name): string
{
    $name = preg_replace('/[\x00-\x1F\x7F]/u', '', (string) $name);
    return mb_substr(trim((string) $name), 0, 30, 'UTF-8');
}
