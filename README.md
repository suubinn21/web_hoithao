# ITFTMS 2026 — Hệ Thống Quản Lý Hội Thao Khoa CNTT 2026

Hệ thống quản lý, điều hành và cổng thông tin trực tiếp cho Hội thao Khoa Công nghệ Thông tin (**ITFTMS 2026**), hỗ trợ đa môn thi đấu (Bóng đá, Cầu lông, Bóng chuyền) và tối ưu triển khai trên Shared Hosting / DirectAdmin (Next.js Static Export + PHP + MySQL/MariaDB).

---

## Tính năng chính

- **Cổng thông tin công khai (`PublicHome`, `TournamentPortal`)**: Theo dõi lịch thi đấu, kết quả, bảng xếp hạng, nhánh đấu và thông tin giải đấu theo thời gian thực.
- **Quản lý giải đấu đa môn (`CreateTournamentModal`)**: Hỗ trợ Bóng đá (`FOOTBALL`), Cầu lông (`BADMINTON`), Bóng chuyền (`VOLLEYBALL`) với các thể thức vòng tròn (`SINGLE_LEAGUE`), chia bảng + loại trực tiếp, hoặc loại trực tiếp.
- **Quản lý đội & vận động viên (`TeamsView`)**: Đăng ký, duyệt đội, quản lý danh sách cầu thủ/VĐV.
- **Bốc thăm chia bảng (`DrawStudio`)**: Giao diện bốc thăm trực quan và phân bảng tự động.
- **Xếp lịch thi đấu (`ScheduleView`, `scheduleEngine`)**: Tự động tạo lịch thi đấu theo sân, thời lượng trận và thời gian nghỉ.
- **Điều hành trận đấu trực tiếp (`LiveMatchCenter`)**: Cập nhật tỷ số (bao gồm tỷ số từng set cho Cầu lông / Bóng chuyền), ghi nhận bàn thắng, thẻ phạt và sự kiện trận đấu.
- **Bảng xếp hạng & Nhánh đấu (`StandingsView`, `BracketTree`, `rankingEngine`, `knockoutEngine`)**: Tự động tính điểm, hiệu số, đối đầu và cập nhật sơ đồ vòng loại trực tiếp.
- **Kỷ luật, Khiếu nại, Tài chính & Giải thưởng**:
  - Theo dõi thẻ vàng/thẻ đỏ và án treo giò (`DisciplineView`, `disciplineEngine`).
  - Tiếp nhận và xử lý khiếu nại (`ComplaintsView`).
  - Quản lý lệ phí đăng ký, tiền cọc và tiền phạt (`FinanceView`).
  - Vinh danh và trao giải (`AwardsView`).
- **Phân quyền & Đồng bộ dữ liệu**:
  - 5 vai trò người dùng: `SUPER_ADMIN`, `ORGANIZER`, `TEAM_MANAGER`, `REFEREE`, `STUDENT`.
  - Nhật ký kiểm tra hệ thống (`AuditLogsView`) và đồng bộ dữ liệu với MySQL (`dbSync`, `CloudSyncBadge`).

---

## Công nghệ sử dụng

- **Frontend**: Next.js 14 (`output: 'export'`), React 18, TypeScript 5, Tailwind CSS 3, Lucide React, `canvas-confetti`
- **Backend API**: PHP (REST API cho Shared Hosting)
- **Database**: MySQL 5.7+ / MariaDB 10.x (`utf8mb4`)

---

## Cấu trúc thư mục

```text
web_hoithao/
├── frontend-src/          # Mã nguồn Next.js (TypeScript + Tailwind CSS)
│   ├── public/            # Tài nguyên tĩnh (hình ảnh)
│   └── src/
│       ├── app/           # App Router (layout, page, globals.css)
│       ├── components/    # Các module giao diện chức năng
│       ├── services/      # Engine xử lý nghiệp vụ & đồng bộ API
│       ├── types/         # Định nghĩa kiểu TypeScript
│       └── utils/         # Tiện ích (crypto, theme, sound, storage...)
├── public_html/           # Thư mục triển khai lên Hosting (Static Export + PHP API)
│   ├── api/               # Backend PHP (auth, bootstrap, config, health, tournaments)
│   ├── images/            # Hình ảnh public
│   └── _next/             # Static assets sau khi build Next.js
└── sql/
    └── database.sql       # Script khởi tạo cơ sở dữ liệu MySQL/MariaDB
```

---

## Hướng dẫn cài đặt & chạy

### 1. Phát triển Frontend (Local)

```bash
cd frontend-src
npm install
npm run dev
```

Mở trình duyệt tại `http://localhost:3000`.

### 2. Build Static Export cho Hosting

```bash
cd frontend-src
npm run build
```

Kết quả build tĩnh được xuất ra thư mục `frontend-src/out/`, sau đó sao chép vào `public_html/` để triển khai cùng thư mục `public_html/api/`.

### 3. Triển khai trên DirectAdmin / Shared Hosting

1. Tạo cơ sở dữ liệu MySQL/MariaDB và import file [`sql/database.sql`](sql/database.sql).
2. Mở file [`public_html/api/config.php`](public_html/api/config.php) và điền thông tin kết nối database:
   ```php
   define('DB_HOST', 'localhost');
   define('DB_PORT', '3306');
   define('DB_NAME', 'TEN_DATABASE_MYSQL_CUA_BAN');
   define('DB_USER', 'TEN_USER_MYSQL_CUA_BAN');
   define('DB_PASS', 'MAT_KHAU_MYSQL_CUA_BAN');
   ```
3. Tải toàn bộ nội dung trong `public_html/` lên thư mục `public_html` của hosting.
4. Kiểm tra trạng thái API qua đường dẫn `/api/health.php`.
