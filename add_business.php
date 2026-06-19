<?php
include "db.php";

if ($_SERVER["REQUEST_METHOD"] == "POST") {

    $name     = trim($_POST['name']     ?? '');
    $location = trim($_POST['location'] ?? '');
    $owner    = trim($_POST['owner']    ?? '');
    $type     = trim($_POST['type']     ?? '');

    // Check empty
    if ($name === "" || $location === "" || $owner === "") {
        echo "empty";
        exit;
    }

    // Check duplicate
    $check = $conn->prepare("SELECT number FROM businesses WHERE business_name = ? AND location = ?");
    $check->execute([$name, $location]);
    if ($check->fetch()) {
        echo "duplicate";
        exit;
    }

    // Insert
    $stmt = $conn->prepare("INSERT INTO businesses (business_name, location, owner, line_of_business) VALUES (?, ?, ?, ?)");
    if ($stmt->execute([$name, $location, $owner, $type])) {
        echo "success";
    } else {
        echo "error";
    }
}
?>