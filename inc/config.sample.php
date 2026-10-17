<?php
// Copy this file to inc/config.php and fill in your hosting details.
// inc/config.php is git-ignored and must never be web-readable.
return [
    'db_host' => 'localhost',
    'db_port' => 3306,
    'db_name' => 'csig',
    'db_user' => 'csig',
    'db_pass' => 'change-me',

    // Shown on the public privacy and support pages (required by the app stores). Leave empty until you have one.
    'contact_email' => '',

    // How long a login lasts (seconds). Idle games are left open for days, so 30 days.
    'session_lifetime' => 2592000,

    // Set to true to allow new sign-ups. Turn off once your friends have registered.
    'allow_registration' => true,

    // Failed-login throttling: max failures per window (seconds).
    'login_max_per_user' => 8,
    'login_max_per_ip'   => 30,
    'login_window'       => 900,
];
