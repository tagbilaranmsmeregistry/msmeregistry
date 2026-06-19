<?php
include "db.php";

if ($_SERVER["REQUEST_METHOD"] == "POST") {

    $number = $_POST['number'] ?? '';

    if (empty($number)) {
        echo "error";
        exit;
    }

    $stmt = $conn->prepare("DELETE FROM businesses WHERE number = ?");
    if ($stmt->execute([$number])) {
        echo "success";
    } else {
        echo "error";
    }
}
?>