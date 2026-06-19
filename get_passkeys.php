<?php
include "db.php";
header("Content-Type: application/json");

$sql = "SELECT
            p.id,
            p.name,
            p.filter_by_type,
            p.filter_by_location,
            p.filter_by_owner,
            p.allowed_databases,
            p.created_at,
            p.is_active,
            string_agg(pi.business_number::text, ',') as ids 
        FROM passkeys p 
        LEFT JOIN passkey_items pi ON p.id = pi.passkey_id 
        GROUP BY p.id";

$stmt = $conn->query($sql);
$data = [];
while($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    $row['ids'] = $row['ids'] ? explode(',', $row['ids']) : [];
    $data[] = $row;
}
echo json_encode($data);
?>
