<?php
$host     = getenv('DB_HOST')     ?: "db.zxszyarzzhzhnwuwaqaa.supabase.co";
$port     = getenv('DB_PORT')     ?: "5432";
$dbname   = getenv('DB_NAME')     ?: "postgres";
$user     = getenv('DB_USER')     ?: "postgres";
$password = getenv('DB_PASSWORD') ?: "Portrias mark22";

try {
    $dsn = "pgsql:host=$host;port=$port;dbname=$dbname;sslmode=require";
    $conn = new PDO($dsn, $user, $password, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
} catch (PDOException $e) {
    die(json_encode(["error" => "Database connection failed: " . $e->getMessage()]));
}
?>