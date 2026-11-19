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
$hasUsers = false;
$tournamentsCount = 0;

try {
    $tblStmt = $pdo->prepare(
        'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()'
    );
    $tblStmt->execute();
    $existingTables = array_flip($tblStmt->fetchAll(PDO::FETCH_COLUMN));
    $tblStmt->closeCursor();

    foreach ($requiredTables as $tbl) {
        $tables[$tbl] = isset($existingTables[$tbl]);
    }

    if (!empty($tables['users'])) {
        $cntStmt = $pdo->query('SELECT COUNT(*) FROM users');
        $cnt = (int)$cntStmt->fetchColumn();
        $cntStmt->closeCursor();
        $hasUsers = $cnt > 0;
    }
    if (!empty($tables['tournaments'])) {
        $tourStmt = $pdo->query('SELECT COUNT(*) FROM tournaments');
        $tournamentsCount = (int)$tourStmt->fetchColumn();
        $tourStmt->closeCursor();
    }
} catch (\Throwable $e) {
    jsonResponse([
        'ok' => false,
        'code' => 'HEALTH_QUERY_FAILED',
        'phpVersion' => PHP_VERSION,
        'pdoMysql' => $pdoAvailable,
        'error' => 'Lỗi truy vấn kiểm tra CSDL: ' . $e->getMessage(),
    ], 500);
} catch (Exception $e) {
    jsonResponse([
        'ok' => false,
        'code' => 'HEALTH_QUERY_FAILED',
        'phpVersion' => PHP_VERSION,
        'pdoMysql' => $pdoAvailable,
        'error' => 'Lỗi truy vấn kiểm tra CSDL: ' . $e->getMessage(),
    ], 500);
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
