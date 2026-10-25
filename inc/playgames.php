<?php
// Sign in with Google Play Games: the Android app asks Play Games for a single-use server auth code
// (GamesSignInClient.requestServerSideAccess); this exchanges it with Google for an access token and asks the Games API
// who that token belongs to. Google signs the answer for us: the code can only be minted by Google Play services for a
// signed-in player and only for OUR web client id, and a code can be redeemed once.
//
// Config (inc/config.php): pg_client_id + pg_client_secret = the OAuth *web* client of the "Game server" credential in the
// Play Console (Play Games Services -> Configuration). Tests only: pg_token_url / pg_api_url point at tools/api-pg-smoke.js.

const PG_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const PG_API_URL = 'https://games.googleapis.com/games/v1';

/** Small HTTP helper (works without the curl extension). Returns [status, decoded JSON|null]. */
function pg_http(string $method, string $url, array $form = [], array $headers = []): array
{
    $opts = ['http' => ['method' => $method, 'timeout' => 8, 'ignore_errors' => true, 'header' => implode("\r\n", $headers)],
             'ssl' => ['verify_peer' => true, 'verify_peer_name' => true]];
    if ($method === 'POST') {
        $opts['http']['header'] .= "\r\nContent-Type: application/x-www-form-urlencoded";
        $opts['http']['content'] = http_build_query($form);
    }
    $body = @file_get_contents($url, false, stream_context_create($opts));
    $status = 0;
    foreach (($http_response_header ?? []) as $h) {
        if (preg_match('#^HTTP/\S+\s+(\d{3})#', $h, $m)) {
            $status = (int) $m[1];
        }
    }
    return [$status, $body === false ? null : json_decode($body, true)];
}

/** Redeems the app's server auth code. Returns ['player' => id, 'name' => displayName] or ['error' => code]. */
function pg_verify(string $code): array
{
    $id = (string) cfg('pg_client_id', '');
    $secret = (string) cfg('pg_client_secret', '');
    if ($id === '' || $secret === '') {
        return ['error' => 'pg_not_configured'];
    }
    if ($code === '' || strlen($code) > 2000 || !preg_match('#^[A-Za-z0-9._~/+\-]+$#', $code)) {
        return ['error' => 'pg_bad_code'];
    }
    [$st, $tok] = pg_http('POST', (string) cfg('pg_token_url', PG_TOKEN_URL), [
        'code' => $code, 'client_id' => $id, 'client_secret' => $secret, 'grant_type' => 'authorization_code', 'redirect_uri' => '',
    ]);
    if ($st === 0) {
        return ['error' => 'pg_unreachable'];
    }
    if ($st !== 200 || empty($tok['access_token'])) {
        return ['error' => 'pg_bad_code']; // used, expired or minted for another client
    }
    [$st, $me] = pg_http('GET', rtrim((string) cfg('pg_api_url', PG_API_URL), '/') . '/players/me', [], ['Authorization: Bearer ' . $tok['access_token']]);
    if ($st === 0) {
        return ['error' => 'pg_unreachable'];
    }
    $player = (string) ($me['playerId'] ?? '');
    if ($st !== 200 || $player === '' || strlen($player) > 128) {
        return ['error' => 'pg_bad_code'];
    }
    return ['player' => $player, 'name' => (string) ($me['displayName'] ?? '')];
}
