<?php
include "db.php";

if ($_SERVER["REQUEST_METHOD"] == "POST") {

    $number   = $_POST['number'] ?? '';
    $name     = $_POST['name'] ?? '';
    $location = $_POST['location'] ?? '';
    $owner    = $_POST['owner'] ?? '';
    $type     = $_POST['type'] ?? '';

    if (empty($number) || empty($name) || empty($location) || empty($owner)) {
        echo "error";
        exit;
    }

    $stmt = $conn->prepare("UPDATE businesses 
        SET business_name = ?, location = ?, owner = ?, line_of_business = ? 
        WHERE number = ?");
    if ($stmt->execute([$name, $location, $owner, $type, $number])) {
        echo "success";
    } else {
        echo "error";
    }
}
?>