<?php
// Sign in with Game Center: verifies the identity proof the iOS app gets from GameKit
// (GKLocalPlayer.fetchItems(forIdentityVerificationSignature:)) and maps the player to an account.
//
// The proof: Apple signs  teamPlayerID (UTF-8) || bundle id (UTF-8) || timestamp (UInt64, big-endian) || salt
// with the private key of the certificate at publicKeyUrl. We only fetch certificates over HTTPS from Apple's own
// hosts (so TLS vouches for them), accept proofs for our bundle id that are at most GC_MAX_AGE old, and remember
// every signature for an hour so a captured proof cannot be replayed.
//
// Config (inc/config.php): gc_bundle_id (default com.davideis.computershopidle); gc_test_public_key (PEM; tests only:
// used instead of fetching from Apple, see tools/api-gc-smoke.js).

const GC_MAX_AGE = 900;       // seconds a proof stays valid (Apple's timestamps are in milliseconds)
const GC_KEY_HOSTS = ['static.gc.apple.com', 'sandbox.gc.apple.com'];

/** Checks a proof from the app. Returns ['player' => teamPlayerID] or ['error' => code]. */
function gc_verify(array $p): array
{
    $player = (string) ($p['playerId'] ?? '');
    $bundle = (string) ($p['bundleId'] ?? '');
    $url = (string) ($p['publicKeyUrl'] ?? '');
    $sig = base64_decode((string) ($p['signature'] ?? ''), true);
    $salt = base64_decode((string) ($p['salt'] ?? ''), true);
    $ts = (string) ($p['timestamp'] ?? '');
    if ($player === '' || strlen($player) > 128 || $sig === false || $sig === '' || $salt === false || !ctype_digit($ts)) {
        return ['error' => 'gc_bad_proof'];
    }
    if ($bundle !== (string) cfg('gc_bundle_id', 'com.davideis.computershopidle')) {
        return ['error' => 'gc_bad_proof'];
    }
    if (abs(time() - intdiv((int) $ts, 1000)) > GC_MAX_AGE) {
        return ['error' => 'gc_expired'];
    }
    $key = gc_public_key($url);
    if (!$key) {
        return ['error' => 'gc_bad_key'];
    }
    $data = $player . $bundle . pack('J', (int) $ts) . $salt;
    if (openssl_verify($data, $sig, $key, OPENSSL_ALGO_SHA256) !== 1) {
        return ['error' => 'gc_bad_proof'];
    }
    // one use per signature
    $now = time();
    db()->prepare('DELETE FROM gc_proofs WHERE created_at < ?')->execute([$now - 3600]);
    try {
        db()->prepare('INSERT INTO gc_proofs (sig_hash, created_at) VALUES (?, ?)')->execute([hash('sha256', $sig), $now]);
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') {
            return ['error' => 'gc_replay'];
        }
        throw $e;
    }
    return ['player' => $player];
}

/** Apple's signing key from publicKeyUrl (cached on disk for a day), or the test key from config. */
function gc_public_key(string $url)
{
    $test = cfg('gc_test_public_key'); // tests only: a PEM, or the path of one
    if ($test) {
        $pem = strpos($test, '-----') === 0 ? $test : @file_get_contents($test);
        return $pem ? (openssl_pkey_get_public($pem) ?: null) : null;
    }
    $u = parse_url($url);
    if (!$u || ($u['scheme'] ?? '') !== 'https' || !in_array(strtolower($u['host'] ?? ''), GC_KEY_HOSTS, true) || isset($u['port']) || isset($u['user'])) {
        return null;
    }
    $cache = sys_get_temp_dir() . '/csig-gc-' . sha1($url) . '.cer';
    $der = (is_file($cache) && filemtime($cache) > time() - 86400) ? file_get_contents($cache) : false;
    if ($der === false || $der === '') {
        $ctx = stream_context_create(['http' => ['timeout' => 5], 'ssl' => ['verify_peer' => true, 'verify_peer_name' => true]]);
        $der = @file_get_contents($url, false, $ctx);
        if ($der === false || strlen($der) > 20000) {
            return null;
        }
        @file_put_contents($cache, $der);
    }
    $pem = "-----BEGIN CERTIFICATE-----\n" . chunk_split(base64_encode($der), 64, "\n") . "-----END CERTIFICATE-----\n";
    return openssl_pkey_get_public($pem) ?: null;
}

/** A free username for a new Game Center account, from the player's display name. */
function gc_new_username(string $name): string
{
    $base = preg_replace('/[^A-Za-z0-9_-]/', '', $name);
    if (strlen($base) < 3) {
        $base = 'Player';
    }
    $base = substr($base, 0, 14);
    $st = db()->prepare('SELECT 1 FROM users WHERE username = ?');
    for ($i = 0; $i < 20; $i++) {
        $candidate = $base . random_int(100, 99999);
        $st->execute([$candidate]);
        if (!$st->fetchColumn()) {
            return $candidate;
        }
    }
    return 'Player' . bin2hex(random_bytes(6));
}

/** The user object every auth reply returns. */
function auth_user_payload(int $uid): array
{
    $st = db()->prepare('SELECT id, username, email, gc_player_id, has_password FROM users WHERE id = ?');
    $st->execute([$uid]);
    $u = $st->fetch();
    return [
        'id' => (int) $u['id'], 'username' => $u['username'], 'email' => mask_email($u['email']),
        'gameCenter' => $u['gc_player_id'] !== null, 'hasPassword' => (bool) $u['has_password'],
    ];
}
