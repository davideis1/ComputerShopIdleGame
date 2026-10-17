<?php
// Tiny outgoing-mail helper. No Composer: a minimal SMTP client (STARTTLS + AUTH LOGIN) is enough for a few reset emails.
// Config (inc/config.php): mail_transport 'smtp' (default) | 'log' (writes to mail_log instead of sending; for tests),
// smtp_host, smtp_port (587), smtp_user, smtp_pass, mail_from, mail_from_name.

/** Sends a plain-text email. Returns true if the server accepted it. Never throws. */
function send_mail(string $to, string $subject, string $text): bool
{
    $from = (string) cfg('mail_from', '');
    $fromName = (string) cfg('mail_from_name', 'Mega Byte Computers');
    if (!valid_email($to) || (!valid_email($from) && cfg('mail_transport', 'smtp') !== 'log')) {
        return false;
    }
    $headers = [
        'Date: ' . date('r'),
        'From: ' . mime_word($fromName) . ' <' . $from . '>',
        'To: <' . $to . '>',
        'Subject: ' . mime_word($subject),
        'Message-ID: <' . bin2hex(random_bytes(12)) . '@' . (preg_replace('/^.*@/', '', $from) ?: 'localhost') . '>',
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
    ];
    $message = implode("\r\n", $headers) . "\r\n\r\n" . str_replace(["\r\n", "\r"], "\n", $text);
    $message = str_replace("\n", "\r\n", $message);

    if (cfg('mail_transport', 'smtp') === 'log') {
        $file = (string) cfg('mail_log', sys_get_temp_dir() . '/csig-mail.log');
        return file_put_contents($file, "=== " . date('c') . " ===\n" . $message . "\n", FILE_APPEND | LOCK_EX) !== false;
    }
    try {
        return smtp_send($from, $to, $message);
    } catch (Throwable $e) {
        error_log('send_mail: ' . $e->getMessage());
        return false;
    }
}

/** RFC 2047 encoded-word for header values that may contain non-ASCII. */
function mime_word(string $s): string
{
    $s = preg_replace('/[\r\n]+/', ' ', $s);
    return preg_match('/^[\x20-\x7E]*$/', $s) ? $s : '=?UTF-8?B?' . base64_encode($s) . '?=';
}

function smtp_expect($fp, array $ok): string
{
    $line = '';
    do { // multi-line replies are "250-..." until "250 ..."
        $l = fgets($fp, 1024);
        if ($l === false) {
            throw new RuntimeException('connection closed');
        }
        $line = $l;
    } while (strlen($l) >= 4 && $l[3] === '-');
    if (!in_array((int) substr($line, 0, 3), $ok, true)) {
        throw new RuntimeException('unexpected reply: ' . trim($line));
    }
    return $line;
}

function smtp_cmd($fp, string $cmd, array $ok): string
{
    fwrite($fp, $cmd . "\r\n");
    return smtp_expect($fp, $ok);
}

function smtp_send(string $from, string $to, string $message): bool
{
    $host = (string) cfg('smtp_host', 'smtp.ionos.com');
    $port = (int) cfg('smtp_port', 587);
    $fp = @stream_socket_client("tcp://$host:$port", $errno, $errstr, 10);
    if (!$fp) {
        throw new RuntimeException("connect failed: $errstr");
    }
    stream_set_timeout($fp, 15);
    try {
        smtp_expect($fp, [220]);
        $me = 'localhost';
        smtp_cmd($fp, "EHLO $me", [250]);
        smtp_cmd($fp, 'STARTTLS', [220]);
        if (!cfg('smtp_verify_peer', true)) { // tests only: allow a self-signed certificate
            stream_context_set_option($fp, 'ssl', 'verify_peer', false);
            stream_context_set_option($fp, 'ssl', 'verify_peer_name', false);
        }
        if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT | STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT)) {
            throw new RuntimeException('TLS failed');
        }
        smtp_cmd($fp, "EHLO $me", [250]);
        smtp_cmd($fp, 'AUTH LOGIN', [334]);
        smtp_cmd($fp, base64_encode((string) cfg('smtp_user', $from)), [334]);
        smtp_cmd($fp, base64_encode((string) cfg('smtp_pass', '')), [235]);
        smtp_cmd($fp, "MAIL FROM:<$from>", [250]);
        smtp_cmd($fp, "RCPT TO:<$to>", [250, 251]);
        smtp_cmd($fp, 'DATA', [354]);
        $body = preg_replace('/^\./m', '..', $message); // dot-stuffing
        fwrite($fp, $body . "\r\n.\r\n");
        smtp_expect($fp, [250]);
        @smtp_cmd($fp, 'QUIT', [221]);
        return true;
    } finally {
        fclose($fp);
    }
}
