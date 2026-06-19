<?php
session_start();

$_SESSION = [];
if (ini_get('session.use_cookies')) {
  $params = session_get_cookie_params();
  setcookie(session_name(), '', time() - 42000,
    $params['path'] ?? '/',
    $params['domain'] ?? '',
    $params['secure'] ?? false,
    $params['httponly'] ?? true
  );
}

session_destroy();

// Ensure the user is redirected specifically to login.html
header('Location: admin/login.html');
exit;
