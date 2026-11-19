<?php
/**
 * ITFTMS 2026 - API Xác Thực & Quản Lý Tài Khoản (MySQL + PHP Session)
 * Không chứa bất kỳ mật khẩu mặc định hay tài khoản tạo sẵn nào trong mã nguồn.
 */
require_once __DIR__ . '/bootstrap.php';

$pdo = getDb();
$action = isset($_GET['action']) ? trim($_GET['action']) : '';

function cleanMobileInput($str) {
    $cleaned = preg_replace('/[\x{00a0}\x{1680}\x{2000}-\x{200a}\x{2028}\x{2029}\x{202f}\x{205f}\x{3000}\x{feff}\x{200b}-\x{200d}]/u', ' ', (string)$str);
    return trim((string)$cleaned);
}

function getCaptainMatchedTeamIds($pdo, $cleanId, $normTarget, $normCore) {
    $matchedIds = [];
    try {
        $stmt = $pdo->query('SELECT teams_json FROM tournaments');
        while ($row = $stmt->fetch()) {
            $teams = json_decode($row['teams_json'], true);
            if (!is_array($teams)) continue;
            foreach ($teams as $t) {
                if (empty($t['id'])) continue;
                $tId = strtolower((string)$t['id']);
                $tNameNorm = normalizeVi(isset($t['name']) ? $t['name'] : '');
                $tShortNorm = normalizeVi(isset($t['shortName']) ? $t['shortName'] : '');
                $tClassNorm = normalizeVi(isset($t['class']) ? $t['class'] : '');
                $tIdNorm = normalizeVi($t['id']);
                if (
                    $tId === $cleanId ||
                    ($normTarget !== '' && ($tNameNorm === $normTarget || $tShortNorm === $normTarget || $tClassNorm === $normTarget || $tIdNorm === $normTarget)) ||
                    ($normCore !== '' && (
                        $tNameNorm === $normCore ||
                        $tShortNorm === $normCore ||
                        $tClassNorm === $normCore ||
                        $tIdNorm === $normCore ||
                        (strlen($normCore) >= 3 && strpos($tNameNorm, $normCore) !== false)
                    ))
                ) {
                    $matchedIds[$t['id']] = true;
                }
            }
        }
        $stmt->closeCursor();
    } catch (Exception $e) {
        // Ignore if no tournaments table rows yet
    }
    return array_keys($matchedIds);
}

function checkRateLimit($pdo, $key) {
    try {
        $stmt = $pdo->prepare('SELECT attempts, last_attempt_at FROM login_attempts WHERE attempt_key = ?');
        $stmt->execute([$key]);
        $row = $stmt->fetch();
        $stmt->closeCursor();
        if (!$row) return;
        $lastTs = strtotime($row['last_attempt_at']);
        if ($lastTs !== false && (time() - $lastTs) > 300) {
            $del = $pdo->prepare('DELETE FROM login_attempts WHERE attempt_key = ?');
            $del->execute([$key]);
            return;
        }
        if ((int)$row['attempts'] >= 10) {
            jsonResponse([
                'ok' => false,
                'error' => 'Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau 5 phút!',
            ], 429);
        }
    } catch (Exception $e) {
        // Bỏ qua nếu bảng login_attempts chưa được tạo
    }
}

function recordFailedAttempt($pdo, $key) {
    try {
        $stmt = $pdo->prepare(
            'INSERT INTO login_attempts (attempt_key, attempts, last_attempt_at) VALUES (?, 1, NOW())
             ON DUPLICATE KEY UPDATE
               attempts = IF(TIMESTAMPDIFF(SECOND, last_attempt_at, NOW()) > 300, 1, attempts + 1),
               last_attempt_at = NOW()'
        );
        $stmt->execute([$key]);
    } catch (Exception $e) {
    }
}

function clearFailedAttempts($pdo, $key) {
    try {
        $stmt = $pdo->prepare('DELETE FROM login_attempts WHERE attempt_key = ?');
        $stmt->execute([$key]);
    } catch (Exception $e) {
    }
}

switch ($action) {
    case 'me':
        requireMethod('GET');
        $user = currentSessionUser($pdo);
        jsonResponse([
            'ok' => true,
            'authenticated' => $user !== null,
            'user' => sanitizeUser($user),
        ]);
        break;

    case 'login':
        requireMethod('POST');
        startSecureSession();
        $body = readJsonBody();
        $rawId = cleanMobileInput(isset($body['identifier']) ? $body['identifier'] : '');
        $password = cleanMobileInput(isset($body['password']) ? $body['password'] : '');

        if ($rawId === '' || $password === '') {
            jsonResponse(['ok' => false, 'error' => 'Vui lòng nhập tên đăng nhập/email và mật khẩu!'], 400);
        }

        $strippedId = trim(ltrim($rawId, '@'));
        $cleanId = mb_strtolower($strippedId, 'UTF-8');
        $rateKey = hash('sha256', getClientIp() . '|' . $cleanId);
        checkRateLimit($pdo, $rateKey);

        $emailPrefix = strpos($cleanId, '@') !== false ? trim(explode('@', $cleanId)[0]) : '';
        $normEmailPrefix = $emailPrefix !== '' ? normalizeVi($emailPrefix) : '';
        $idWithoutCaptain = trim(preg_replace('/^captain[_.\s-]*/i', '', $strippedId));
        $normTarget = normalizeVi($strippedId);
        $normCore = normalizeVi($idWithoutCaptain);
        $matchedTeamIds = getCaptainMatchedTeamIds($pdo, $cleanId, $normTarget, $normCore);

        $stmt = $pdo->query('SELECT * FROM users WHERE is_active = 1');
        $allUsers = $stmt->fetchAll();
        $stmt->closeCursor();

        $authenticatedUser = null;
        foreach ($allUsers as $u) {
            $uUserLower = mb_strtolower((string)$u['username'], 'UTF-8');
            $uEmailLower = mb_strtolower((string)$u['email'], 'UTF-8');
            $uNorm = normalizeVi($u['username']);
            $uCore = preg_replace('/^captain/', '', $uNorm);
            $uFullNorm = normalizeVi($u['full_name']);
            $uTeamNorm = normalizeVi(isset($u['team_name']) ? $u['team_name'] : '');
            $uTeamId = isset($u['team_id']) ? (string)$u['team_id'] : '';

            $matchUsername = (
                $uUserLower === $cleanId ||
                ($emailPrefix !== '' && $uUserLower === $emailPrefix) ||
                ($normTarget !== '' && $uNorm === $normTarget) ||
                ($normEmailPrefix !== '' && $uNorm === $normEmailPrefix) ||
                ($normCore !== '' && ($uCore === $normCore || $uNorm === ('captain' . $normCore) || $uUserLower === ('captain_' . $normCore)))
            );

            $matchEmail = (
                $uEmailLower === $cleanId ||
                ($emailPrefix !== '' && $uUserLower === $emailPrefix && (substr($cleanId, -13) === '@ctuet.edu.vn' || substr($cleanId, -10) === '@itftms.vn'))
            );

            $matchFullName = (
                ($normTarget !== '' && $uFullNorm === $normTarget) ||
                ($normEmailPrefix !== '' && $uFullNorm === $normEmailPrefix) ||
                ($normCore !== '' && $uFullNorm === $normCore) ||
                ($normCore !== '' && strlen($normCore) >= 3 && strpos($uFullNorm, $normCore) !== false)
            );

            $matchCaptain = false;
            if ($u['role'] === 'TEAM_MANAGER') {
                $matchCaptain = (
                    ($uTeamId !== '' && in_array($uTeamId, $matchedTeamIds, true)) ||
                    ($uTeamId !== '' && (strtolower($uTeamId) === $cleanId || normalizeVi($uTeamId) === $normTarget || normalizeVi($uTeamId) === $normCore)) ||
                    ($uTeamNorm !== '' && (
                        ($normTarget !== '' && $uTeamNorm === $normTarget) ||
                        ($normCore !== '' && $uTeamNorm === $normCore) ||
                        ($normCore !== '' && strlen($normCore) >= 3 && strpos($uTeamNorm, $normCore) !== false)
                    ))
                );
            }

            if (!$matchUsername && !$matchEmail && !$matchFullName && !$matchCaptain) {
                continue;
            }

            if (verifyAndUpgradePassword($pdo, $u, $password)) {
                $authenticatedUser = $u;
                break;
            }
        }

        if (!$authenticatedUser) {
            recordFailedAttempt($pdo, $rateKey);
            jsonResponse([
                'ok' => false,
                'error' => 'Tên đăng nhập hoặc mật khẩu không chính xác! Vui lòng kiểm tra lại (tài khoản và mật khẩu phải được tạo trong CSDL SQL hoặc qua Admin).',
            ], 401);
        }

        clearFailedAttempts($pdo, $rateKey);
        if (function_exists('session_regenerate_id')) {
            @session_regenerate_id(true);
        }
        $_SESSION['user_id'] = $authenticatedUser['id'];

        writeAuthAuditLog(
            $pdo,
            $authenticatedUser['full_name'],
            $authenticatedUser['role'],
            'ĐĂNG NHẬP HỆ THỐNG',
            'Xác thực MySQL',
            'Tài khoản @' . $authenticatedUser['username'] . ' đăng nhập thành công (' . $authenticatedUser['role'] . ').'
        );

        jsonResponse([
            'ok' => true,
            'user' => sanitizeUser($authenticatedUser),
        ]);
        break;

    case 'register':
        requireMethod('POST');
        startSecureSession();
        $body = readJsonBody();

        $fullName = trim((string)(isset($body['fullName']) ? $body['fullName'] : ''));
        $rawUsername = trim((string)(isset($body['username']) ? $body['username'] : ''));
        $cleanUsername = preg_replace('/[^a-z0-9_]/', '', mb_strtolower($rawUsername, 'UTF-8'));
        $cleanEmail = mb_strtolower(trim((string)(isset($body['email']) ? $body['email'] : '')), 'UTF-8');
        $password = trim((string)(isset($body['password']) ? $body['password'] : ''));
        $studentId = trim((string)(isset($body['studentId']) ? $body['studentId'] : ''));
        $className = trim((string)(isset($body['class']) ? $body['class'] : ''));
        $phone = trim((string)(isset($body['phone']) ? $body['phone'] : ''));

        if ($fullName === '' || $cleanUsername === '' || $cleanEmail === '' || $password === '') {
            jsonResponse(['ok' => false, 'error' => 'Vui lòng điền đầy đủ các thông tin bắt buộc!'], 400);
        }
        if (strlen($cleanUsername) < 3) {
            jsonResponse(['ok' => false, 'error' => 'Tên tài khoản tối thiểu 3 ký tự (a-z, 0-9, _).'], 400);
        }
        if (!filter_var($cleanEmail, FILTER_VALIDATE_EMAIL)) {
            jsonResponse(['ok' => false, 'error' => 'Địa chỉ email không hợp lệ!'], 400);
        }
        if (mb_strlen($password, 'UTF-8') < 6) {
            jsonResponse(['ok' => false, 'error' => 'Mật khẩu đăng ký phải có tối thiểu 6 ký tự!'], 400);
        }

        $chk = $pdo->prepare('SELECT id, username, email FROM users WHERE LOWER(username) = ? OR LOWER(email) = ? LIMIT 1');
        $chk->execute([$cleanUsername, $cleanEmail]);
        $dup = $chk->fetch();
        $chk->closeCursor();
        if ($dup) {
            if (strtolower($dup['username']) === $cleanUsername) {
                jsonResponse(['ok' => false, 'error' => 'Tên tài khoản "' . $cleanUsername . '" đã tồn tại!'], 409);
            }
            jsonResponse(['ok' => false, 'error' => 'Email "' . $cleanEmail . '" đã được đăng ký trong hệ thống!'], 409);
        }

        // Đăng ký công khai chỉ được gán vai trò STUDENT
        $newId = 'USR-' . round(microtime(true) * 1000) . '-' . substr(bin2hex(random_bytes(3)), 0, 6);
        $hash = password_hash($password, PASSWORD_BCRYPT);
        $avatar = 'https://api.dicebear.com/7.x/bottts/svg?seed=' . urlencode($cleanUsername);

        $ins = $pdo->prepare(
            'INSERT INTO users (id, username, password_hash, full_name, role, email, phone, avatar_url, student_id, class_name)
             VALUES (?, ?, ?, ?, "STUDENT", ?, ?, ?, ?, ?)'
        );
        $ins->execute([$newId, $cleanUsername, $hash, $fullName, $cleanEmail, $phone, $avatar, $studentId, $className]);

        $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ? LIMIT 1');
        $stmt->execute([$newId]);
        $created = $stmt->fetch();
        $stmt->closeCursor();

        if (function_exists('session_regenerate_id')) {
            @session_regenerate_id(true);
        }
        $_SESSION['user_id'] = $newId;

        writeAuthAuditLog(
            $pdo,
            $fullName,
            'STUDENT',
            'ĐĂNG KÝ TÀI KHOẢN MỚI',
            'Đăng ký Sinh viên',
            'Tài khoản @' . $cleanUsername . ' đã đăng ký mới trên hệ thống.'
        );

        jsonResponse(['ok' => true, 'user' => sanitizeUser($created)]);
        break;

    case 'logout':
        requireMethod('POST');
        startSecureSession();
        $user = currentSessionUser($pdo);
        if ($user) {
            writeAuthAuditLog(
                $pdo,
                $user['full_name'],
                $user['role'],
                'ĐĂNG XUẤT',
                'Phiên làm việc',
                'Tài khoản @' . $user['username'] . ' đã đăng xuất.'
            );
        }
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(
                session_name(),
                '',
                time() - 42000,
                $params['path'],
                $params['domain'],
                $params['secure'],
                $params['httponly']
            );
        }
        @session_destroy();
        jsonResponse(['ok' => true]);
        break;

    case 'users':
        requireMethod('GET');
        requireOrganizerOrAdmin($pdo);
        $stmt = $pdo->query('SELECT * FROM users ORDER BY created_at DESC');
        $rows = $stmt->fetchAll();
        $users = array_map('sanitizeUser', $rows);
        jsonResponse(['ok' => true, 'users' => $users]);
        break;

    case 'create_staff':
        requireMethod('POST');
        $actor = requireOrganizerOrAdmin($pdo);
        $body = readJsonBody();

        $fullName = trim((string)(isset($body['fullName']) ? $body['fullName'] : ''));
        $rawUsername = trim((string)(isset($body['username']) ? $body['username'] : ''));
        $cleanUsername = preg_replace('/[^a-z0-9_]/', '', normalizeVi($rawUsername) !== '' && strpos($rawUsername, '_') !== false ? strtolower($rawUsername) : strtolower($rawUsername));
        $cleanUsername = preg_replace('/[^a-z0-9_]/', '', $cleanUsername);
        $password = trim((string)(isset($body['password']) ? $body['password'] : ''));
        $role = trim((string)(isset($body['role']) ? $body['role'] : 'REFEREE'));
        $phone = trim((string)(isset($body['phone']) ? $body['phone'] : ''));
        $email = mb_strtolower(trim((string)(isset($body['email']) ? $body['email'] : '')), 'UTF-8');
        $teamId = isset($body['teamId']) && trim((string)$body['teamId']) !== '' ? trim((string)$body['teamId']) : null;
        $teamName = trim((string)(isset($body['teamName']) ? $body['teamName'] : ''));

        $allowedRoles = ['ORGANIZER', 'REFEREE', 'TEAM_MANAGER'];
        if ($actor['role'] === 'SUPER_ADMIN') {
            $allowedRoles[] = 'SUPER_ADMIN';
        }
        if (!in_array($role, $allowedRoles, true)) {
            jsonResponse(['ok' => false, 'error' => 'Vai trò được chọn không hợp lệ hoặc bạn không đủ quyền tạo!'], 403);
        }

        if ($fullName === '' || $cleanUsername === '') {
            jsonResponse(['ok' => false, 'error' => 'Vui lòng nhập đầy đủ họ tên và tên đăng nhập!'], 400);
        }
        if ($password === '') {
            jsonResponse(['ok' => false, 'error' => 'Vui lòng nhập mật khẩu cho tài khoản (hệ thống không sử dụng mật khẩu mặc định)!'], 400);
        }

        if ($role === 'ORGANIZER' || $role === 'SUPER_ADMIN') {
            $strengthErrors = validateBtcPasswordStrength($password);
            if (!empty($strengthErrors)) {
                jsonResponse([
                    'ok' => false,
                    'error' => 'Mật khẩu tài khoản BTC/Admin chưa đạt chuẩn: ' . implode(', ', $strengthErrors),
                ], 400);
            }
        } elseif (mb_strlen($password, 'UTF-8') < 6) {
            jsonResponse(['ok' => false, 'error' => 'Mật khẩu phải có tối thiểu 6 ký tự!'], 400);
        }

        if ($email === '') {
            $email = $cleanUsername . '@ctuet.edu.vn';
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            jsonResponse(['ok' => false, 'error' => 'Email không hợp lệ!'], 400);
        }

        $chk = $pdo->prepare('SELECT id, username, email FROM users WHERE LOWER(username) = ? OR LOWER(email) = ? LIMIT 1');
        $chk->execute([$cleanUsername, $email]);
        $dup = $chk->fetch();
        $chk->closeCursor();
        if ($dup) {
            if (strtolower($dup['username']) === $cleanUsername) {
                jsonResponse(['ok' => false, 'error' => 'Tên đăng nhập "' . $cleanUsername . '" đã tồn tại!'], 409);
            }
            jsonResponse(['ok' => false, 'error' => 'Email "' . $email . '" đã tồn tại trong CSDL!'], 409);
        }

        $prefix = $role === 'REFEREE' ? 'USR-REF-' : ($role === 'TEAM_MANAGER' ? 'USR-CAP-' : 'USR-BTC-');
        $newId = $prefix . round(microtime(true) * 1000) . '-' . substr(bin2hex(random_bytes(2)), 0, 4);
        $hash = password_hash($password, PASSWORD_BCRYPT);
        $avatar = 'https://api.dicebear.com/7.x/bottts/svg?seed=' . urlencode($cleanUsername);

        $ins = $pdo->prepare(
            'INSERT INTO users (id, username, password_hash, full_name, role, email, phone, avatar_url, team_id, team_name)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $ins->execute([$newId, $cleanUsername, $hash, $fullName, $role, $email, $phone, $avatar, $teamId, $teamName]);

        $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ? LIMIT 1');
        $stmt->execute([$newId]);
        $created = $stmt->fetch();
        $stmt->closeCursor();

        writeAuthAuditLog(
            $pdo,
            $actor['full_name'],
            $actor['role'],
            'TẠO TÀI KHOẢN NHÂN SỰ',
            '@' . $cleanUsername,
            'Tạo tài khoản ' . $fullName . ' với vai trò ' . $role . ' (lưu Bcrypt trong MySQL).'
        );

        jsonResponse(['ok' => true, 'user' => sanitizeUser($created)]);
        break;

    case 'create_captain':
        requireMethod('POST');
        $actor = requireOrganizerOrAdmin($pdo);
        $body = readJsonBody();

        $teamId = trim((string)(isset($body['teamId']) ? $body['teamId'] : ''));
        $teamName = trim((string)(isset($body['teamName']) ? $body['teamName'] : ''));
        $fullName = trim((string)(isset($body['captainName']) ? $body['captainName'] : ''));
        $rawUsername = trim((string)(isset($body['username']) ? $body['username'] : ''));
        $cleanUsername = preg_replace('/[^a-z0-9_]/', '', strtolower($rawUsername));
        $password = trim((string)(isset($body['password']) ? $body['password'] : ''));
        $email = mb_strtolower(trim((string)(isset($body['email']) ? $body['email'] : '')), 'UTF-8');
        $phone = trim((string)(isset($body['phone']) ? $body['phone'] : ''));

        if ($teamId === '' || $teamName === '' || $cleanUsername === '') {
            jsonResponse(['ok' => false, 'error' => 'Thiếu thông tin đội bóng hoặc tên đăng nhập Đội trưởng!'], 400);
        }
        if (mb_strlen($password, 'UTF-8') < 6) {
            jsonResponse(['ok' => false, 'error' => 'Mật khẩu Đội trưởng phải có tối thiểu 6 ký tự (không dùng mật khẩu mặc định)!'], 400);
        }

        if ($fullName === '') {
            $fullName = 'Đội trưởng ' . $teamName;
        }
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $email = $cleanUsername . '@ctuet.edu.vn';
        }

        $find = $pdo->prepare('SELECT * FROM users WHERE team_id = ? OR LOWER(username) = ? LIMIT 1');
        $find->execute([$teamId, $cleanUsername]);
        $existing = $find->fetch();
        $find->closeCursor();

        $hash = password_hash($password, PASSWORD_BCRYPT);
        $avatar = 'https://api.dicebear.com/7.x/bottts/svg?seed=' . urlencode($cleanUsername);

        if ($existing) {
            $up = $pdo->prepare(
                'UPDATE users SET username = ?, password_hash = ?, full_name = ?, role = "TEAM_MANAGER", phone = ?, team_id = ?, team_name = ? WHERE id = ?'
            );
            $up->execute([$cleanUsername, $hash, $fullName, $phone, $teamId, $teamName, $existing['id']]);
            $targetId = $existing['id'];
        } else {
            // Đảm bảo email không trùng
            $chkEmail = $pdo->prepare('SELECT id FROM users WHERE LOWER(email) = ? LIMIT 1');
            $chkEmail->execute([$email]);
            $hasDupEmail = (bool)$chkEmail->fetch();
            $chkEmail->closeCursor();
            if ($hasDupEmail) {
                $email = $cleanUsername . '_' . substr(bin2hex(random_bytes(2)), 0, 4) . '@ctuet.edu.vn';
            }
            $targetId = 'USR-CAP-' . preg_replace('/[^A-Za-z0-9_-]/', '', $teamId) . '-' . substr(bin2hex(random_bytes(2)), 0, 4);
            $ins = $pdo->prepare(
                'INSERT INTO users (id, username, password_hash, full_name, role, email, phone, avatar_url, team_id, team_name)
                 VALUES (?, ?, ?, ?, "TEAM_MANAGER", ?, ?, ?, ?, ?)'
            );
            $ins->execute([$targetId, $cleanUsername, $hash, $fullName, $email, $phone, $avatar, $teamId, $teamName]);
        }

        $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ? LIMIT 1');
        $stmt->execute([$targetId]);
        $saved = $stmt->fetch();
        $stmt->closeCursor();

        writeAuthAuditLog(
            $pdo,
            $actor['full_name'],
            $actor['role'],
            'CẤP TÀI KHOẢN ĐỘI TRƯỞNG',
            $teamName,
            'Cấp tài khoản @' . $cleanUsername . ' cho Đội trưởng đội ' . $teamName . '.'
        );

        jsonResponse(['ok' => true, 'user' => sanitizeUser($saved)]);
        break;

    case 'reset_password':
        requireMethod('POST');
        $actor = requireOrganizerOrAdmin($pdo);
        $body = readJsonBody();

        $userId = trim((string)(isset($body['userId']) ? $body['userId'] : ''));
        $newPassword = trim((string)(isset($body['newPassword']) ? $body['newPassword'] : ''));

        if ($userId === '' || $newPassword === '') {
            jsonResponse(['ok' => false, 'error' => 'Vui lòng nhập mật khẩu mới (hệ thống không đặt lại về mật khẩu mặc định)!'], 400);
        }

        $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ? LIMIT 1');
        $stmt->execute([$userId]);
        $target = $stmt->fetch();
        $stmt->closeCursor();
        if (!$target) {
            jsonResponse(['ok' => false, 'error' => 'Không tìm thấy tài khoản cần đổi mật khẩu!'], 404);
        }

        if ($target['role'] === 'SUPER_ADMIN' && $actor['role'] !== 'SUPER_ADMIN') {
            jsonResponse(['ok' => false, 'error' => 'Chỉ Super Admin mới có quyền đổi mật khẩu tài khoản Super Admin!'], 403);
        }

        if ($target['role'] === 'ORGANIZER' || $target['role'] === 'SUPER_ADMIN') {
            $strengthErrors = validateBtcPasswordStrength($newPassword);
            if (!empty($strengthErrors)) {
                jsonResponse([
                    'ok' => false,
                    'error' => 'Mật khẩu tài khoản BTC/Admin phải đạt chuẩn phức tạp: ' . implode(', ', $strengthErrors),
                ], 400);
            }
        } elseif (mb_strlen($newPassword, 'UTF-8') < 6) {
            jsonResponse(['ok' => false, 'error' => 'Mật khẩu mới phải có tối thiểu 6 ký tự!'], 400);
        }

        $hash = password_hash($newPassword, PASSWORD_BCRYPT);
        $up = $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
        $up->execute([$hash, $userId]);

        writeAuthAuditLog(
            $pdo,
            $actor['full_name'],
            $actor['role'],
            'ĐỔI MẬT KHẨU TÀI KHOẢN',
            '@' . $target['username'],
            'Đặt mật khẩu mới cho tài khoản @' . $target['username'] . ' (lưu Bcrypt).'
        );

        jsonResponse(['ok' => true]);
        break;

    case 'delete_user':
        requireMethod('POST');
        $actor = requireOrganizerOrAdmin($pdo);
        $body = readJsonBody();
        $userId = trim((string)(isset($body['userId']) ? $body['userId'] : ''));

        if ($userId === '') {
            jsonResponse(['ok' => false, 'error' => 'Thiếu ID tài khoản cần xóa!'], 400);
        }
        if ($userId === $actor['id']) {
            jsonResponse(['ok' => false, 'error' => 'Không thể xóa chính tài khoản bạn đang đăng nhập!'], 400);
        }

        $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ? LIMIT 1');
        $stmt->execute([$userId]);
        $target = $stmt->fetch();
        $stmt->closeCursor();
        if (!$target) {
            jsonResponse(['ok' => false, 'error' => 'Không tìm thấy tài khoản cần xóa!'], 404);
        }
        if ($target['role'] === 'SUPER_ADMIN' && $actor['role'] !== 'SUPER_ADMIN') {
            jsonResponse(['ok' => false, 'error' => 'Chỉ Super Admin mới có quyền xóa tài khoản Super Admin!'], 403);
        }

        $del = $pdo->prepare('DELETE FROM users WHERE id = ?');
        $del->execute([$userId]);

        writeAuthAuditLog(
            $pdo,
            $actor['full_name'],
            $actor['role'],
            'XÓA TÀI KHOẢN',
            '@' . $target['username'],
            'Đã xóa tài khoản @' . $target['username'] . ' (' . $target['full_name'] . ', vai trò: ' . $target['role'] . ').'
        );

        jsonResponse(['ok' => true, 'deletedUser' => sanitizeUser($target)]);
        break;

    default:
        jsonResponse(['ok' => false, 'error' => 'Action không hợp lệ.'], 400);
}
