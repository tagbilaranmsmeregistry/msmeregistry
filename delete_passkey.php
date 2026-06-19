<?php
include "db.php";
$id = $_POST['id'] ?? 0;

$stmt = $conn->prepare("DELETE FROM passkey_items WHERE passkey_id = ?");
$stmt->execute([$id]);

$stmt = $conn->prepare("DELETE FROM passkey_filters WHERE passkey_id = ?");
$stmt->execute([$id]);

$stmt = $conn->prepare("DELETE FROM passkeys WHERE id = ?");
$stmt->execute([$id]);
echo "success";
?>
