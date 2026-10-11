<?php
// CLI only:  php tools/install.php
// Creates the tables in the database configured in inc/config.php (safe to re-run).
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('Run this from the command line.');
}
require __DIR__ . '/../inc/bootstrap.php';
$files = array_merge([__DIR__ . '/../sql/schema.sql'], glob(__DIR__ . '/../sql/upgrade_*.sql'));
$pdo = db();
$n = 0;
foreach ($files as $file) {
    $sql = preg_replace('/--[^\n]*/', '', file_get_contents($file)); // strip comments
    foreach (array_filter(array_map('trim', explode(';', $sql))) as $stmt) {
        $pdo->exec($stmt);
        $n++;
    }
}
echo "Done: $n statements applied to database '" . cfg('db_name') . "'.\n";
