<?php
include "db.php";
header("Content-Type: application/json");

$name = $_POST['name'] ?? '';
$ids = json_decode($_POST['ids'] ?? '[]');
$filter_by_type = normalize_json_field($_POST['filter_by_type'] ?? null);
$filter_by_location = normalize_json_field($_POST['filter_by_location'] ?? null);
$filter_by_owner = normalize_json_field($_POST['filter_by_owner'] ?? null);
$allowed_databases = trim($_POST['allowed_databases'] ?? '') ?: 'msme_registry';

if (empty($name) || empty($ids)) {
    http_response_code(400);
    echo json_encode(["ok" => false, "error" => "Missing passkey name or business ids"]);
    exit;
}

try {
    $conn->beginTransaction();

    $stmt = $conn->prepare("
        INSERT INTO passkeys (
            name,
            filter_by_type,
            filter_by_location,
            filter_by_owner,
            allowed_databases
        )
        VALUES (?, ?::jsonb, ?::jsonb, ?::jsonb, ?)
        ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
            , filter_by_type = EXCLUDED.filter_by_type
            , filter_by_location = EXCLUDED.filter_by_location
            , filter_by_owner = EXCLUDED.filter_by_owner
            , allowed_databases = EXCLUDED.allowed_databases
        RETURNING id
    ");
    $stmt->execute([$name, $filter_by_type, $filter_by_location, $filter_by_owner, $allowed_databases]);
    $passkey_id = $stmt->fetchColumn();

    $stmt = $conn->prepare("DELETE FROM passkey_items WHERE passkey_id = ?");
    $stmt->execute([$passkey_id]);

    $stmt = $conn->prepare("
        INSERT INTO passkey_items (passkey_id, business_number)
        VALUES (?, ?)
        ON CONFLICT (passkey_id, business_number) DO NOTHING
    ");
    foreach ($ids as $id) {
        $stmt->execute([$passkey_id, (string)$id]);
    }

    $conn->commit();
    echo json_encode(["ok" => true, "id" => $passkey_id]);
} catch (Throwable $e) {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }
    http_response_code(500);
    echo json_encode(["ok" => false, "error" => $e->getMessage()]);
}

function normalize_json_field($value) {
    if ($value === null || trim((string)$value) === '') {
        return null;
    }

    $decoded = json_decode((string)$value, true);
    if (json_last_error() === JSON_ERROR_NONE) {
        return json_encode($decoded);
    }

    $items = array_values(array_filter(array_map('trim', explode(',', (string)$value))));
    return json_encode($items);
}
?>
