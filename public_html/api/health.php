<?php
/**
 * ITFTMS 2026 - Kiểm tra tình trạng PHP & MySQL trên Hosting
 * Chỉ trả về trạng thái kết nối, KHÔNG lộ thông tin nhạy cảm.
 */
require_once __DIR__ . '/bootstrap.php';

$phpOk = version_compare(PHP_VERSION, '7.4.0', '>=');
$pdoAvailable = extension_loaded('pdo_mysql');
$pdo = getDb();

$tables = [];
$requiredTables = ['users', 'tournaments', 'auth_audit_logs', 'login_attempts'];
foreach ($requiredTables as $tbl) {
    $stmt = $pdo->prepare('SHOW TABLES LIKE ?');
    $stmt->execute([$tbl]);
    $tables[$tbl] = (bool)$stmt->fetch();
}

$hasUsers = false;
$tournamentsCount = 0;
if (!empty($tables['users'])) {
    $cnt = (int)$pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
    $hasUsers = $cnt > 0;
}
if (!empty($tables['tournaments'])) {
    $tournamentsCount = (int)$pdo->query('SELECT COUNT(*) FROM tournaments')->fetchColumn();
}

jsonResponse([
    'ok' => true,
    'phpVersion' => PHP_VERSION,
    'phpSupported' => $phpOk,
    'pdoMysql' => $pdoAvailable,
    'tables' => $tables,
    'hasAnyUsers' => $hasUsers,
    'tournamentsCount' => $tournamentsCount,
]);
