<?php
include "db.php";

$passkey = $_GET['passkey'] ?? '';

$sql_parts = [];
$params = [];
$types = ''; // For bind_param

if (!empty($passkey)) {
    // First, get the business numbers associated with the passkey
    $stmt_passkey = $conn->prepare("SELECT pi.business_number FROM passkey_items pi JOIN passkeys p ON pi.passkey_id = p.id WHERE p.name = ?");
    $stmt_passkey->execute([$passkey]);
    $business_numbers = $stmt_passkey->fetchAll(PDO::FETCH_COLUMN);

    unset($stmt_passkey);

    if (!empty($business_numbers)) {
        $placeholders = implode(',', array_fill(0, count($business_numbers), '?'));
        $sql_parts[] = "number::text IN ($placeholders)";
        $params = array_merge($params, $business_numbers);
    } else {
        // If no businesses found for the passkey, return empty types
        header("Content-Type: application/json");
        echo json_encode([]);
        exit;
    }
}

if (!empty($sql_parts)) {
    $where_clause = "WHERE (" . implode(' AND ', $sql_parts) . ") AND line_of_business IS NOT NULL AND line_of_business != ''";
} else {
    $where_clause = "WHERE line_of_business IS NOT NULL AND line_of_business != ''";
}

$query = "SELECT line_of_business FROM businesses " . $where_clause;

$stmt = $conn->prepare($query);
$stmt->execute($params);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

$frequency = [];

foreach ($rows as $row) {
    $parts = explode(",", $row['line_of_business']);
    foreach ($parts as $part) {
        $part = trim($part);
        if ($part === "") continue;
        $frequency[$part] = ($frequency[$part] ?? 0) + 1;
    }
}

/* Sort by most common first */
arsort($frequency);

$output = [];
foreach ($frequency as $type => $count) {
    $output[] = ["type" => $type, "count" => $count];
}

header("Content-Type: application/json");
echo json_encode($output);

unset($stmt);
unset($conn);
?>