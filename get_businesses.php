<?php
include "db.php";

header("Content-Type: application/json");

// Check if connection exists and is valid
if (!isset($conn)) {
    echo json_encode(["error" => "Database connection failed."]);
    exit;
}

$passkey = $_GET['passkey'] ?? '';

if (!empty($passkey)) {
    // Filter businesses based on passkey permissions
    $stmt = $conn->prepare("SELECT b.* FROM businesses b 
                            JOIN passkey_items pi ON b.number::text = pi.business_number 
                            JOIN passkeys p ON pi.passkey_id = p.id 
                            WHERE p.name = ?");
    $stmt->execute([$passkey]);
} else {
    // Default: Show all (Admin view or no filter)
    $stmt = $conn->query("SELECT * FROM businesses");
}

if (!$stmt) {
    echo json_encode(["error" => "Query failed."]);
    exit;
}

$businesses = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode($businesses);

unset($stmt);
unset($conn);
?>
