<?php
// CLI only:  php tools/reset_password.php <username> <new-password>
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('Run this from the command line.');
}
require __DIR__ . '/../inc/bootstrap.php';
if ($argc < 3) {
    exit("Usage: php tools/reset_password.php <username> <new-password>\n");
}
if (strlen($argv[2]) < 8) {
    exit("Password must be at least 8 characters.\n");
}
$st = db()->prepare('UPDATE users SET password_hash = ? WHERE username = ?');
$st->execute([password_hash($argv[2], PASSWORD_DEFAULT), $argv[1]]);
echo $st->rowCount() ? "Password updated.\n" : "No such user.\n";
