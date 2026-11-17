<?php
/**
 * ITFTMS 2026 - Cấu hình kết nối MySQL trên DirectAdmin Hosting
 * Chặn truy cập trực tiếp từ trình duyệt
 */
if (basename(isset($_SERVER['SCRIPT_FILENAME']) ? $_SERVER['SCRIPT_FILENAME'] : '') === 'config.php') {
    http_response_code(403);
    exit('Forbidden');
}

// ============================================================================
// ĐIỀN THÔNG TIN MYSQL DATABASE BẠN TẠO TRONG DIRECTADMIN VÀO ĐÂY
// ============================================================================
define('DB_HOST', 'localhost');
define('DB_PORT', '3306');
define('DB_NAME', 'TEN_DATABASE_MYSQL_CUA_BAN');
define('DB_USER', 'TEN_USER_MYSQL_CUA_BAN');
define('DB_PASS', 'MAT_KHAU_MYSQL_CUA_BAN');
define('DB_CHARSET', 'utf8mb4');

define('APP_TIMEZONE', 'Asia/Ho_Chi_Minh');
define('SESSION_COOKIE_NAME', 'ITFTMS_SID');
define('SESSION_LIFETIME_SEC', 60 * 60 * 24 * 7); // 7 ngày
