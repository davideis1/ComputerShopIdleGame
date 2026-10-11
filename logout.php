<?php
require __DIR__ . '/inc/bootstrap.php';
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' && csrf_ok($_POST['csrf'] ?? null)) {
    log_out();
}
redirect('login.php');
