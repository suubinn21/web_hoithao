-- ============================================================================
-- ITFTMS 2026 - CƠ SỞ DỮ LIỆU MYSQL / MARIADB CHO DIRECTADMIN HOSTING
-- Phiên bản tối ưu cho Shared Hosting (PHP + MySQL/MariaDB, utf8mb4)
-- LƯU Ý: Không chứa sẵn bất kỳ tài khoản hay mật khẩu mặc định nào!
--        Bạn sẽ tự tạo tài khoản & mật khẩu bằng SQL bên dưới hoặc qua phpMyAdmin.
-- ============================================================================

SET NAMES utf8mb4;
SET time_zone = '+07:00';

-- ----------------------------------------------------------------------------
-- 1. BẢNG TÀI KHOẢN NGƯỜI DÙNG (users) - TRỐNG MẶC ĐỊNH
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `username` VARCHAR(100) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `full_name` VARCHAR(191) NOT NULL,
  `role` ENUM('SUPER_ADMIN', 'ORGANIZER', 'TEAM_MANAGER', 'REFEREE', 'STUDENT') NOT NULL DEFAULT 'STUDENT',
  `email` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(30) NOT NULL DEFAULT '',
  `avatar_url` VARCHAR(500) NOT NULL DEFAULT '',
  `student_id` VARCHAR(50) NOT NULL DEFAULT '',
  `class_name` VARCHAR(100) NOT NULL DEFAULT '',
  `team_id` VARCHAR(64) DEFAULT NULL,
  `team_name` VARCHAR(191) NOT NULL DEFAULT '',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_users_username` (`username`),
  UNIQUE KEY `uniq_users_email` (`email`),
  KEY `idx_users_role` (`role`),
  KEY `idx_users_team_id` (`team_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 2. BẢNG GIẢI ĐẤU & DỮ LIỆU GIẢI ĐẤU (tournaments)
-- Dùng LONGTEXT để tương thích 100% mọi phiên bản MySQL 5.7+ và MariaDB 10.x
-- Lưu ý: schedule_config_json còn lưu cấu hình đa môn (sportType: FOOTBALL/BADMINTON/VOLLEYBALL, setConfig)
--        và matches_json lưu tỷ số chi tiết từng set (sets) cho Cầu lông / Bóng chuyền.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `tournaments` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `short_code` VARCHAR(64) NOT NULL DEFAULT 'ITFTMS',
  `year` INT NOT NULL DEFAULT 2026,
  `organizer` VARCHAR(255) NOT NULL DEFAULT '',
  `format` VARCHAR(191) NOT NULL DEFAULT 'Bóng đá sân 5 – Vòng tròn một lượt (12 đội)',
  `format_type` VARCHAR(32) NOT NULL DEFAULT 'SINGLE_LEAGUE',
  `max_teams` INT NOT NULL DEFAULT 12,
  `number_of_groups` INT NOT NULL DEFAULT 1,
  `teams_per_group` INT NOT NULL DEFAULT 12,
  `advance_per_group` INT NOT NULL DEFAULT 3,
  `number_of_venues` INT NOT NULL DEFAULT 3,
  `max_players_per_team` INT NOT NULL DEFAULT 12,
  `match_duration_minutes` INT NOT NULL DEFAULT 60,
  `break_duration_minutes` INT NOT NULL DEFAULT 5,
  `registration_fee` BIGINT NOT NULL DEFAULT 100000,
  `deposit_fee` BIGINT NOT NULL DEFAULT 0,
  `start_date` VARCHAR(20) NOT NULL DEFAULT '2026-10-18',
  `end_date` VARCHAR(20) NOT NULL DEFAULT '2026-11-29',
  `status` VARCHAR(40) NOT NULL DEFAULT 'REGISTRATION',
  `description` TEXT,
  `schedule_config_json` LONGTEXT NOT NULL,
  `teams_json` LONGTEXT NOT NULL,
  `matches_json` LONGTEXT NOT NULL,
  `venues_json` LONGTEXT NOT NULL,
  `referees_json` LONGTEXT NOT NULL,
  `complaints_json` LONGTEXT NOT NULL,
  `finances_json` LONGTEXT NOT NULL,
  `awards_json` LONGTEXT NOT NULL,
  `audit_logs_json` LONGTEXT NOT NULL,
  `manual_suspensions_json` LONGTEXT NOT NULL,
  `btc_tiebreaks_json` LONGTEXT NOT NULL,
  `paid_fines_json` LONGTEXT NOT NULL,
  `teams_count` INT NOT NULL DEFAULT 0,
  `matches_count` INT NOT NULL DEFAULT 0,
  `version` BIGINT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_tournaments_status` (`status`),
  KEY `idx_tournaments_year` (`year`),
  KEY `idx_tournaments_version` (`version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 3. BẢNG NHẬT KÝ XÁC THỰC HỆ THỐNG (auth_audit_logs)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `auth_audit_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `actor_name` VARCHAR(191) NOT NULL,
  `actor_role` VARCHAR(40) NOT NULL,
  `action` VARCHAR(120) NOT NULL,
  `target` VARCHAR(191) NOT NULL,
  `details` TEXT,
  `ip_address` VARCHAR(64) NOT NULL DEFAULT '',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_auth_audit_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 4. BẢNG CHỐNG DÒ MẬT KHẨU (login_attempts)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `login_attempts` (
  `attempt_key` VARCHAR(128) NOT NULL PRIMARY KEY,
  `attempts` INT NOT NULL DEFAULT 0,
  `last_attempt_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
-- MẪU CÂU LỆNH SQL TẠO TÀI KHOẢN & MẬT KHẨU TRỰC TIẾP TRÊN CSDL (phpMyAdmin)
-- ============================================================================
-- HƯỚNG DẪN:
--   1. Mở phpMyAdmin trên DirectAdmin -> Chọn database -> Vào tab "SQL".
--   2. Bỏ dấu "-- " ở phần câu lệnh bạn muốn chạy và thay các giá trị thật
--      (đặc biệt là 'MAT_KHAU_MANH_CUA_BAN').
--   3. Bấm "Go" / "Thực hiện" để tạo tài khoản.
--   4. Hàm SHA2('...', 256) sẽ băm mật khẩu ngay trong SQL (không lộ chữ rõ);
--      ở lần đăng nhập đầu tiên trên web, PHP sẽ tự nâng cấp sang Bcrypt.
-- ============================================================================

-- [MẪU 1] Tạo tài khoản Quản Trị Cao Nhất (SUPER_ADMIN / Ban Tổ Chức):
-- INSERT INTO `users` (`id`, `username`, `password_hash`, `full_name`, `role`, `email`, `phone`)
-- VALUES (
--   'USR-ADMIN-01',
--   'admin',
--   SHA2('THAY_BANG_MAT_KHAU_MANH_CUA_BAN', 256),
--   'Ban Tổ Chức Giải Đấu',
--   'SUPER_ADMIN',
--   'admin@ctuet.edu.vn',
--   '0900000000'
-- );

-- [MẪU 2] Tạo tài khoản Ban Tổ Chức (ORGANIZER):
-- INSERT INTO `users` (`id`, `username`, `password_hash`, `full_name`, `role`, `email`, `phone`)
-- VALUES (
--   'USR-BTC-01',
--   'btc_01',
--   SHA2('THAY_BANG_MAT_KHAU_BTC', 256),
--   'Thành Viên Ban Tổ Chức',
--   'ORGANIZER',
--   'btc01@ctuet.edu.vn',
--   '0900000001'
-- );

-- [MẪU 3] Tạo tài khoản Trọng Tài (REFEREE):
-- INSERT INTO `users` (`id`, `username`, `password_hash`, `full_name`, `role`, `email`, `phone`)
-- VALUES (
--   'USR-REF-01',
--   'trongtai_01',
--   SHA2('THAY_BANG_MAT_KHAU_TRONG_TAI', 256),
--   'Trọng Tài 01',
--   'REFEREE',
--   'trongtai01@ctuet.edu.vn',
--   '0900000002'
-- );

-- [MẪU 4] Tạo tài khoản Đội Trưởng (TEAM_MANAGER) gắn với team_id (ví dụ T01):
-- INSERT INTO `users` (`id`, `username`, `password_hash`, `full_name`, `role`, `email`, `phone`, `team_id`, `team_name`)
-- VALUES (
--   'USR-CAP-T01',
--   'captain_t01',
--   SHA2('THAY_BANG_MAT_KHAU_DOI_TRUONG', 256),
--   'Đội Trưởng Đội 01',
--   'TEAM_MANAGER',
--   'captain_t01@ctuet.edu.vn',
--   '0900000003',
--   'T01',
--   'Tên Đội 01'
-- );

-- [MẪU 5] Đổi / Đặt lại mật khẩu cho tài khoản đã có bằng SQL:
-- UPDATE `users`
-- SET `password_hash` = SHA2('THAY_BANG_MAT_KHAU_MOI', 256)
-- WHERE `username` = 'admin';
