<?php
include "db.php";

try {
    $stmt = $conn->query("
        SELECT column_name, data_type, character_maximum_length 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'passkeys';
    ");
    $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo "Columns of public.passkeys:\n";
    print_r($columns);

    $stmt2 = $conn->query("
        SELECT column_name, data_type, character_maximum_length 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'passkey_items';
    ");
    $columns2 = $stmt2->fetchAll(PDO::FETCH_ASSOC);
    echo "\nColumns of public.passkey_items:\n";
    print_r($columns2);

} catch (PDOException $e) {
    echo "Query failed: " . $e->getMessage();
}
?>