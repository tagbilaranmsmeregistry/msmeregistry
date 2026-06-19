<?php
// Simple admin authentication for two users:
// 1) Admin: PIN (default: 123456)
// 2) Passkey user: passkey "what admin is made for" (default: that exact string)
//
// Sets $_SESSION['role'] on success.

session_start();
include "db.php";

// Hardcoded credentials (as requested)
$ADMIN_PIN = '123456';

$redirect = 'admin/login.html';

function json_response($arr, $code = 200) {
  http_response_code($code);
  header('Content-Type: application/json');
  echo json_encode($arr);
  exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  json_response(['ok' => false, 'error' => 'Invalid request method'], 405);
}

$type = $_POST['type'] ?? '';
$credential = $_POST['credential'] ?? '';

$type = trim($type);
$credential = (string)$credential;

if ($type === 'pin') {
  if (hash_equals($ADMIN_PIN, $credential)) {
    $_SESSION['role'] = 'admin';
    $_SESSION['auth_at'] = time();
    json_response(['ok' => true, 'role' => 'admin']);
  }
  json_response(['ok' => false, 'error' => 'Invalid PIN'], 401);
}

if ($type === 'passkey') {
  $stmt = $conn->prepare("SELECT id FROM passkeys WHERE name = ? AND is_active = 1");
  $stmt->execute([$credential]);
  $user = $stmt->fetch();

  if ($user) {
    $_SESSION['role'] = 'passkey';
    $_SESSION['auth_at'] = time();
    json_response(['ok' => true, 'role' => 'passkey']);
  }
  json_response(['ok' => false, 'error' => 'Invalid passkey'], 401);
}

json_response(['ok' => false, 'error' => 'Unknown login type'], 400);
