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

    // Password-reset email (optional; without it the "forgot password" pages still load but no mail is sent).
    // IONOS: smtp.ionos.com, port 587 with STARTTLS, authenticate with the mailbox login. Use 'mail_transport' => 'log' to test
    // (writes the emails to mail_log instead of sending).
    'mail_from'      => '',                 // e.g. admin@example.com (must be the mailbox you authenticate with)
    'mail_from_name' => 'Mega Byte Computers',
    'smtp_host'      => 'smtp.ionos.com',
    'smtp_port'      => 587,
    'smtp_user'      => '',                 // usually the full mailbox address
    'smtp_pass'      => '',
    // 'public_url'  => 'https://example.com',  // optional: base of the link in reset emails (default: this request's host)
    'forgot_max_per_ip_hour' => 5,

    // How long a login lasts (seconds). Idle games are left open for days, so 30 days.
    'session_lifetime' => 2592000,

    // Set to true to allow new sign-ups. Turn off once your friends have registered.
    'allow_registration' => true,

    // Failed-login throttling: max failures per window (seconds).
    'login_max_per_user' => 8,
    'login_max_per_ip'   => 30,
    'login_window'       => 900,
];
