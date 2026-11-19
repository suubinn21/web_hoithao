
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




