<?php
// Minimal HTML shell for the account pages (login, register, account). The game itself is index.php.
function page_head(string $title): void
{
    send_security_headers();
    header('Cache-Control: no-store');
    $b = h(base_url());
    echo '<!doctype html><html lang="en"><head><meta charset="utf-8">'
        . '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
        . '<title>' . h($title) . ' — Mega Byte Computers</title>'
        . '<link rel="icon" href="' . $b . '/icon.svg" type="image/svg+xml">'
        . '<link rel="stylesheet" href="' . $b . '/style.css"></head>'
        . '<body data-theme="win95"><div id="app" class="authwrap"><div class="panel authbox">'
        . '<div class="title"><span>' . h($title) . '</span><span class="era">Mega Byte Computers</span></div><div class="pbody">';
}

function page_foot(): void
{
    $b = h(base_url());
    echo '<p class="legal"><small><a href="' . $b . '/privacy.php">Privacy policy</a> · <a href="' . $b . '/support.php">Support</a></small></p>';
    echo '</div></div></div></body></html>';
}

function flash_errors(array $errors): void
{
    foreach ($errors as $e) {
        echo '<div class="alert bad">' . h($e) . '</div>';
    }
}

function csrf_field(): string
{
    return '<input type="hidden" name="csrf" value="' . h(csrf_token()) . '">';
}
