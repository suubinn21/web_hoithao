<?php
/**
 * ITFTMS 2026 - Bootstrap chung cho API PHP + MySQL (DirectAdmin)
 * Tương thích PHP 7.4+ và PHP 8.x
 */
require_once __DIR__ . '/config.php';

date_default_timezone_set(defined('APP_TIMEZONE') ? APP_TIMEZONE : 'Asia/Ho_Chi_Minh');

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('X-Content-Type-Options: nosniff');

function isHttpsRequest() {
    if (!empty($_SERVER['HTTPS']) && strtolower($_SERVER['HTTPS']) !== 'off') {
        return true;
    }
    if (isset($_SERVER['SERVER_PORT']) && intval($_SERVER['SERVER_PORT']) === 443) {
        return true;
    }
    if (!empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && strtolower($_SERVER['HTTP_X_FORWARDED_PROTO']) === 'https') {
        return true;
    }
    return false;
}

function startSecureSession() {
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $cookieName = defined('SESSION_COOKIE_NAME') ? SESSION_COOKIE_NAME : 'ITFTMS_SID';
    $lifetime = defined('SESSION_LIFETIME_SEC') ? SESSION_LIFETIME_SEC : 604800;

    session_name($cookieName);
    if (PHP_VERSION_ID >= 70300) {
        session_set_cookie_params([
            'lifetime' => $lifetime,
            'path' => '/',
            'secure' => isHttpsRequest(),
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    } else {
        session_set_cookie_params($lifetime, '/; samesite=Lax', '', isHttpsRequest(), true);
    }
    @session_start();
}

function jsonResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function readJsonBody() {
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        jsonResponse(['ok' => false, 'error' => 'Dữ liệu JSON gửi lên không hợp lệ.'], 400);
    }
    return $decoded;
}

function requireMethod($expectedMethod) {
    $method = isset($_SERVER['REQUEST_METHOD']) ? strtoupper($_SERVER['REQUEST_METHOD']) : 'GET';
    if ($method !== strtoupper($expectedMethod)) {
        jsonResponse(['ok' => false, 'error' => 'Phương thức HTTP không được hỗ trợ.'], 405);
    }
}

function getClientIp() {
    $keys = ['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR'];
    foreach ($keys as $k) {
        if (!empty($_SERVER[$k])) {
            $parts = explode(',', $_SERVER[$k]);
            return trim($parts[0]);
        }
    }
    return '0.0.0.0';
}

function getDb() {
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    if (
        !defined('DB_NAME') || DB_NAME === '' || DB_NAME === 'TEN_DATABASE_MYSQL_CUA_BAN' ||
        !defined('DB_USER') || DB_USER === '' || DB_USER === 'TEN_USER_MYSQL_CUA_BAN'
    ) {
        jsonResponse([
            'ok' => false,
            'code' => 'DB_NOT_CONFIGURED',
            'error' => 'Chưa cấu hình thông tin MySQL trong api/config.php.',
        ], 500);
    }

    if (!class_exists('PDO') || !extension_loaded('pdo_mysql')) {
        jsonResponse([
            'ok' => false,
            'code' => 'PDO_MYSQL_MISSING',
            'error' => 'Máy chủ PHP chưa bật extension pdo_mysql (kiểm tra trong DirectAdmin -> Cài đặt PHP). PHP hiện tại: ' . PHP_VERSION,
        ], 500);
    }

    $dsn = sprintf(
        'mysql:host=%s;port=%s;dbname=%s;charset=%s',
        DB_HOST,
        defined('DB_PORT') ? DB_PORT : '3306',
        DB_NAME,
        defined('DB_CHARSET') ? DB_CHARSET : 'utf8mb4'
    );

    try {
        $pdoOptions = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ];
        if (defined('PDO::MYSQL_ATTR_USE_BUFFERED_QUERY')) {
            $pdoOptions[PDO::MYSQL_ATTR_USE_BUFFERED_QUERY] = true;
        }
        $pdo = new PDO($dsn, DB_USER, DB_PASS, $pdoOptions);
        $pdo->exec("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
        return $pdo;
    } catch (PDOException $e) {
        jsonResponse([
            'ok' => false,
            'code' => 'DB_CONNECT_FAILED',
            'error' => 'Không thể kết nối CSDL MySQL trên hosting. Vui lòng kiểm tra api/config.php và đảm bảo đã import sql/database.sql.',
        ], 500);
    }
}

function normalizeVi($str) {
    $s = mb_strtolower(trim((string)$str), 'UTF-8');
    $map = [
        'à'=>'a','á'=>'a','ạ'=>'a','ả'=>'a','ã'=>'a',
        'â'=>'a','ầ'=>'a','ấ'=>'a','ậ'=>'a','ẩ'=>'a','ẫ'=>'a',
        'ă'=>'a','ằ'=>'a','ắ'=>'a','ặ'=>'a','ẳ'=>'a','ẵ'=>'a',
        'è'=>'e','é'=>'e','ẹ'=>'e','ẻ'=>'e','ẽ'=>'e',
        'ê'=>'e','ề'=>'e','ế'=>'e','ệ'=>'e','ể'=>'e','ễ'=>'e',
        'ì'=>'i','í'=>'i','ị'=>'i','ỉ'=>'i','ĩ'=>'i',
        'ò'=>'o','ó'=>'o','ọ'=>'o','ỏ'=>'o','õ'=>'o',
        'ô'=>'o','ồ'=>'o','ố'=>'o','ộ'=>'o','ổ'=>'o','ỗ'=>'o',
        'ơ'=>'o','ờ'=>'o','ớ'=>'o','ợ'=>'o','ở'=>'o','ỡ'=>'o',
        'ù'=>'u','ú'=>'u','ụ'=>'u','ủ'=>'u','ũ'=>'u',
        'ư'=>'u','ừ'=>'ư','ứ'=>'u','ự'=>'u','ử'=>'u','ữ'=>'u',
        'ỳ'=>'y','ý'=>'y','ỵ'=>'y','ỷ'=>'y','ỹ'=>'y',
        'đ'=>'d',
    ];
    $s = strtr($s, $map);
    // Fix accidental 'ừ'=>'ư' if any, normalize strictly to ascii alnum
    $s = str_replace('ư', 'u', $s);
    return preg_replace('/[^a-z0-9]/', '', $s);
}

function sanitizeUser($row) {
    if (!$row || !is_array($row)) {
        return null;
    }
    $hash = isset($row['password_hash']) ? (string)$row['password_hash'] : '';
    $algo = 'bcrypt';
    if (preg_match('/^[a-f0-9]{64}$/i', $hash) || strpos($hash, 'sha256$') === 0) {
        $algo = 'sha256';
    }
    return [
        'id' => $row['id'],
        'username' => $row['username'],
        'fullName' => $row['full_name'],
        'role' => $row['role'],
        'email' => $row['email'],
        'phone' => isset($row['phone']) ? $row['phone'] : '',
        'avatarUrl' => isset($row['avatar_url']) ? $row['avatar_url'] : '',
        'studentId' => isset($row['student_id']) ? $row['student_id'] : '',
        'class' => isset($row['class_name']) ? $row['class_name'] : '',
        'teamId' => isset($row['team_id']) && $row['team_id'] !== '' ? $row['team_id'] : null,
        'teamName' => isset($row['team_name']) ? $row['team_name'] : '',
        'createdAt' => isset($row['created_at']) ? $row['created_at'] : '',
        'hasPassword' => $hash !== '',
        'passwordAlgo' => $algo,
    ];
}

function currentSessionUser($pdo) {
    startSecureSession();
    if (empty($_SESSION['user_id'])) {
        return null;
    }
    $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ? AND is_active = 1 LIMIT 1');
    $stmt->execute([$_SESSION['user_id']]);
    $user = $stmt->fetch();
    $stmt->closeCursor();
    if (!$user) {
        $_SESSION = [];
        return null;
    }
    return $user;
}

function requireAuth($pdo) {
    $user = currentSessionUser($pdo);
    if (!$user) {
        jsonResponse(['ok' => false, 'error' => 'Bạn chưa đăng nhập hoặc phiên đăng nhập đã hết hạn.'], 401);
    }
    return $user;
}

function isOrganizerOrAdminRole($role) {
    return $role === 'SUPER_ADMIN' || $role === 'ORGANIZER';
}

function requireOrganizerOrAdmin($pdo) {
    $user = requireAuth($pdo);
    if (!isOrganizerOrAdminRole($user['role'])) {
        jsonResponse(['ok' => false, 'error' => 'Chỉ Ban Tổ Chức (BTC) hoặc Super Admin mới có quyền thực hiện thao tác này.'], 403);
    }
    return $user;
}

/**
 * Kiểm tra mật khẩu an toàn:
 * - Hỗ trợ chuẩn password_hash() của PHP ($2y$, $argon2...)
 * - Hỗ trợ SHA2(..., 256) tạo trực tiếp trong SQL/phpMyAdmin (64 ký tự hex) và tự động nâng cấp lên Bcrypt
 * - Hỗ trợ định dạng sha256$salt$hash và tự động nâng cấp lên Bcrypt
 * - KHÔNG hỗ trợ mật khẩu rỗng hay mật khẩu mặc định cứng
 */
function verifyAndUpgradePassword($pdo, $userRow, $plainPassword) {
    $plain = trim((string)$plainPassword);
    $stored = isset($userRow['password_hash']) ? trim((string)$userRow['password_hash']) : '';

    if ($plain === '' || $stored === '') {
        return false;
    }

    // 1. Standard PHP password_hash (bcrypt / argon2)
    if (password_verify($plain, $stored)) {
        if (password_needs_rehash($stored, PASSWORD_BCRYPT)) {
            $newHash = password_hash($plain, PASSWORD_BCRYPT);
            $up = $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
            $up->execute([$newHash, $userRow['id']]);
        }
        return true;
    }

    // 2. Pure 64-char SHA-256 hex created via MySQL SHA2('...', 256)
    if (preg_match('/^[a-f0-9]{64}$/i', $stored)) {
        if (hash_equals(strtolower($stored), hash('sha256', $plain))) {
            $newHash = password_hash($plain, PASSWORD_BCRYPT);
            $up = $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
            $up->execute([$newHash, $userRow['id']]);
            return true;
        }
        return false;
    }

    // 3. Salted SHA-256 format: sha256$<salt>$<hash>
    if (strpos($stored, 'sha256$') === 0) {
        $parts = explode('$', $stored);
        if (count($parts) === 3) {
            $calc = hash('sha256', $parts[1] . ':' . $plain);
            if (hash_equals(strtolower($parts[2]), $calc)) {
                $newHash = password_hash($plain, PASSWORD_BCRYPT);
                $up = $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
                $up->execute([$newHash, $userRow['id']]);
                return true;
            }
        }
        return false;
    }

    return false;
}

function validateBtcPasswordStrength($password) {
    $p = trim((string)$password);
    $errors = [];
    if (mb_strlen($p, 'UTF-8') < 8) {
        $errors[] = 'Tối thiểu 8 ký tự';
    }
    if (!preg_match('/[A-Z]/', $p)) {
        $errors[] = 'Có ít nhất 1 chữ HOA (A-Z)';
    }
    if (!preg_match('/[a-z]/', $p)) {
        $errors[] = 'Có ít nhất 1 chữ thường (a-z)';
    }
    if (!preg_match('/[0-9]/', $p)) {
        $errors[] = 'Có ít nhất 1 chữ số (0-9)';
    }
    if (!preg_match('/[^A-Za-z0-9]/', $p)) {
        $errors[] = 'Có ít nhất 1 ký tự đặc biệt (!@#$%...)';
    }
    return $errors;
}

function writeAuthAuditLog($pdo, $actorName, $actorRole, $action, $target, $details) {
    try {
        $stmt = $pdo->prepare(
            'INSERT INTO auth_audit_logs (actor_name, actor_role, action, target, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            mb_substr((string)$actorName, 0, 190, 'UTF-8'),
            mb_substr((string)$actorRole, 0, 40, 'UTF-8'),
            mb_substr((string)$action, 0, 120, 'UTF-8'),
            mb_substr((string)$target, 0, 190, 'UTF-8'),
            mb_substr((string)$details, 0, 1000, 'UTF-8'),
            getClientIp(),
        ]);
    } catch (Exception $e) {
        // Bỏ qua nếu bảng auth_audit_logs chưa tạo
    }
}
