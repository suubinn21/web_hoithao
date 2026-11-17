import {
  Team,
  Venue,
  Referee,
  Match,
  Complaint,
  FinancialTransaction,
  TournamentAward,
  AuditLog,
  TournamentStatus,
  UserRole,
  Tournament,
  PaidFineRecord,
  getGroupLetters,
} from '@/types';
import { ScheduleEngine, DEFAULT_STUDENT_SCHEDULE_CONFIG } from './scheduleEngine';
import { SecureStorage } from '@/utils/secureStorage';

const STORAGE_KEYS = {
  ALL_TOURNAMENTS: 'itftms_all_tournaments_list',
  ACTIVE_TOURNAMENT_ID: 'itftms_active_tournament_id',
  TOURNAMENT: 'itftms_tournament_profile_2026',
  TEAMS: 'itftms_teams_2026',
  MATCHES: 'itftms_matches_2026',
  VENUES: 'itftms_venues_2026',
  REFEREES: 'itftms_referees_2026',
  COMPLAINTS: 'itftms_complaints_2026',
  FINANCES: 'itftms_finances_2026',
  AWARDS: 'itftms_awards_2026',
  AUDIT_LOGS: 'itftms_audit_logs_2026',
  STATUS: 'itftms_tournament_status_2026',
  CURRENT_ROLE: 'itftms_current_role_2026',
  INITIALIZED: 'itftms_initialized_2026',
  DELETED_TOURNAMENTS: 'itftms_deleted_tournaments_2026',
  MANUAL_SUSPENSIONS: 'itftms_manual_suspensions_2026',
  BTC_TIEBREAKS: 'itftms_btc_tiebreaks_2026',
  PAID_FINES: 'itftms_paid_fines_2026',
};

export const defaultTournament: Tournament = {
  id: 'TOUR-2026-IT',
  name: 'Giải Bóng Đá Khoa Công Nghệ Thông Tin 2026',
  shortCode: 'CTUT-CNTT-2026',
  year: 2026,
  organizer: 'Đoàn Khoa CNTT – ĐH Kỹ thuật – Công nghệ Cần Thơ',
  format: 'Sân 5 - Vòng tròn 1 lượt (12 đội)',
  formatType: 'SINGLE_LEAGUE',
  maxTeams: 12,
  numberOfGroups: 1,
  teamsPerGroup: 12,
  advancePerGroup: 3,
  numberOfVenues: 3,
  maxPlayersPerTeam: 12,
  matchDurationMinutes: 60,
  breakDurationMinutes: 5,
  registrationFee: 100000,
  depositFee: 0,
  startDate: '2026-10-17',
  endDate: '2026-11-29',
  status: 'REGISTRATION',
  description: 'Giải bóng đá sân 5 truyền thống Khoa CNTT – CTUT. 12 đội thi đấu vòng tròn 1 lượt tính điểm (66 trận), 2 hiệp x 30 phút.',
  scheduleConfig: { ...DEFAULT_STUDENT_SCHEDULE_CONFIG },
};

export const initialTournamentsList: Tournament[] = [];

// 3 Sân chính (mỗi ngày thuê 3 sân x 2 trận = 6 trận/vòng) + Sân 4 dự phòng cho giải chia bảng
export const defaultVenues: Venue[] = [
  { id: 'V01', name: 'Sân 1 - Cụm Sân Cỏ Nhân Tạo Số 1', location: 'Khu thể thao sinh viên CTUT', status: 'AVAILABLE' },
  { id: 'V02', name: 'Sân 2 - Cụm Sân Cỏ Nhân Tạo Số 2', location: 'Khu thể thao sinh viên CTUT', status: 'AVAILABLE' },
  { id: 'V03', name: 'Sân 3 - Cụm Sân Cỏ Nhân Tạo Số 3', location: 'Khu thể thao sinh viên CTUT', status: 'AVAILABLE' },
  { id: 'V04', name: 'Sân 4 - Sân Dự Phòng', location: 'Sân cỏ nhân tạo phụ (khi mở rộng 4 sân)', status: 'AVAILABLE' },
];

// Referees per Specification Section 24
export const defaultReferees: Referee[] = [
  { id: 'REF01', code: 'TT-01', name: 'Trần Văn Hùng', phoneNumber: '0901234567', status: 'ACTIVE' },
  { id: 'REF02', code: 'TT-02', name: 'Lê Minh Vũ', phoneNumber: '0912345678', status: 'ACTIVE' },
  { id: 'REF03', code: 'TT-03', name: 'Nguyễn Quốc Đạt', phoneNumber: '0923456789', status: 'ACTIVE' },
  { id: 'REF04', code: 'TT-04', name: 'Hoàng Đình Trọng', phoneNumber: '0934567890', status: 'ACTIVE' },
  { id: 'REF05', code: 'TT-05', name: 'Phạm Thanh Sơn', phoneNumber: '0945678901', status: 'ACTIVE' },
  { id: 'REF06', code: 'TT-06', name: 'Bùi Văn Hảo', phoneNumber: '0956789012', status: 'ACTIVE' },
];

// Clean empty awards list per CTUT Regulations
export const defaultCleanAwards: TournamentAward[] = [
  { id: 'AW-01', code: 'CHAMPION', title: '🥇 Giải Nhất (Huy chương Vàng + Cờ)', recipientName: 'Chưa xác định', recipientTeam: 'Hạng 1 BXH chung cuộc', prizeMoney: 1500000, icon: '🏆', customImage: '/images/trophy-celebration.jpg' },
  { id: 'AW-02', code: 'RUNNER_UP', title: '🥈 Giải Nhì (Huy chương Bạc + Cờ)', recipientName: 'Chưa xác định', recipientTeam: 'Hạng 2 BXH chung cuộc', prizeMoney: 1000000, icon: '🥈' },
  { id: 'AW-03', code: 'THIRD_PLACE', title: '🥉 Giải Ba (Huy chương Đồng + Cờ)', recipientName: 'Chưa xác định', recipientTeam: 'Hạng 3 BXH chung cuộc', prizeMoney: 700000, icon: '🥉' },
  { id: 'AW-04', code: 'BEST_PLAYER', title: '⚽ Vua Phá Lưới / Cầu Thủ Xuất Sắc', recipientName: 'Chưa xác định', recipientTeam: 'Chờ tổng kết giải', prizeMoney: 300000, icon: '⭐', customImage: '/images/tournament-hero.jpg' },
  { id: 'AW-05', code: 'BEST_GK', title: '🧤 Thủ Môn Xuất Sắc Nhất', recipientName: 'Chưa xác định', recipientTeam: 'Chờ tổng kết giải', prizeMoney: 300000, icon: '🧤', customImage: '/images/goalkeeper-save.jpg' },
];

export class StorageService {
  private static isClient = typeof window !== 'undefined';

  private static getScopedKey(baseKey: string): string {
    if (!this.isClient) return baseKey;
    const activeId = this.getActiveTournamentId();
    if (!activeId || activeId === defaultTournament.id) {
      return baseKey;
    }
    return `${baseKey}_${activeId}`;
  }

  /**
   * Returns teams. Defaults to clean empty array []
   */
  static getTeams(): Team[] {
    if (!this.isClient) return [];
    const data = localStorage.getItem(this.getScopedKey(STORAGE_KEYS.TEAMS));
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  static saveTeams(teams: Team[]): void {
    if (!this.isClient) return;
    localStorage.setItem(this.getScopedKey(STORAGE_KEYS.TEAMS), JSON.stringify(teams));
  }

  /**
   * Returns matches. Defaults to clean empty array []
   * Automatically migrates matches to single-day 4-pitch schedule if needed.
   */
  static getMatches(): Match[] {
    if (!this.isClient) return [];
    const data = localStorage.getItem(this.getScopedKey(STORAGE_KEYS.MATCHES));
    if (!data) return [];
    try {
      const parsed: Match[] = JSON.parse(data);
      const teams = this.getTeams();
      const venues = this.getVenues();
      const referees = this.getReferees();
      const { matches: migratedMatches, migrated } = ScheduleEngine.migrateMatchesToSingleDay4Pitches(
        parsed,
        teams,
        venues,
        referees
      );
      if (migrated) {
        this.saveMatches(migratedMatches);
      }
      return migratedMatches;
    } catch {
      return [];
    }
  }

  static saveMatches(matches: Match[]): void {
    if (!this.isClient) return;
    localStorage.setItem(this.getScopedKey(STORAGE_KEYS.MATCHES), JSON.stringify(matches));
  }

  static getVenues(): Venue[] {
    if (!this.isClient) return defaultVenues;
    const data = localStorage.getItem(STORAGE_KEYS.VENUES);
    if (!data) {
      this.saveVenues(defaultVenues);
      return defaultVenues;
    }
    try {
      const parsed: Venue[] = JSON.parse(data);
      let changed = false;
      for (const def of defaultVenues) {
        if (!parsed.some((v) => v.id === def.id || v.name === def.name)) {
          parsed.push(def);
          changed = true;
        }
      }
      if (changed) {
        this.saveVenues(parsed);
      }
      return parsed;
    } catch {
      return defaultVenues;
    }
  }

  static saveVenues(venues: Venue[]): void {
    if (!this.isClient) return;
    localStorage.setItem(STORAGE_KEYS.VENUES, JSON.stringify(venues));
  }

  static getReferees(): Referee[] {
    if (!this.isClient) return defaultReferees;
    const data = localStorage.getItem(STORAGE_KEYS.REFEREES);
    if (!data) {
      this.saveReferees(defaultReferees);
      return defaultReferees;
    }
    try {
      return JSON.parse(data);
    } catch {
      return defaultReferees;
    }
  }

  static saveReferees(referees: Referee[]): void {
    if (!this.isClient) return;
    localStorage.setItem(STORAGE_KEYS.REFEREES, JSON.stringify(referees));
  }

  /**
   * Complaints. Defaults to clean empty array []
   */
  static getComplaints(): Complaint[] {
    if (!this.isClient) return [];
    const data = localStorage.getItem(this.getScopedKey(STORAGE_KEYS.COMPLAINTS));
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  static saveComplaints(complaints: Complaint[]): void {
    if (!this.isClient) return;
    localStorage.setItem(this.getScopedKey(STORAGE_KEYS.COMPLAINTS), JSON.stringify(complaints));
  }

  /**
   * Finances. Defaults to clean empty array []
   */
  static getFinances(): FinancialTransaction[] {
    if (!this.isClient) return [];
    const data = localStorage.getItem(this.getScopedKey(STORAGE_KEYS.FINANCES));
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  static saveFinances(finances: FinancialTransaction[]): void {
    if (!this.isClient) return;
    localStorage.setItem(this.getScopedKey(STORAGE_KEYS.FINANCES), JSON.stringify(finances));
  }

  static getAwards(): TournamentAward[] {
    if (!this.isClient) return defaultCleanAwards;
    const data = localStorage.getItem(this.getScopedKey(STORAGE_KEYS.AWARDS));
    if (!data) {
      this.saveAwards(defaultCleanAwards);
      return defaultCleanAwards;
    }
    try {
      let parsed: TournamentAward[] = JSON.parse(data);
      // Lọc bỏ danh hiệu FAIR_PLAY và TOP_SCORER nếu còn tồn dư cũ
      const filtered = parsed.filter(
        (a) => a.code !== 'FAIR_PLAY' && a.code !== 'TOP_SCORER'
      );
      // Đảm bảo BEST_PLAYER (Cầu thủ xuất sắc nhất Knockout) luôn có trong danh sách
      const hasBestPlayer = filtered.some((a) => a.code === 'BEST_PLAYER');
      if (!hasBestPlayer) {
        const bestPlayerDef = defaultCleanAwards.find((a) => a.code === 'BEST_PLAYER');
        if (bestPlayerDef) {
          filtered.push(bestPlayerDef);
        }
      }
      if (filtered.length !== parsed.length || !hasBestPlayer) {
        this.saveAwards(filtered);
      }
      return filtered;
    } catch {
      return defaultCleanAwards;
    }
  }

  static saveAwards(awards: TournamentAward[]): void {
    if (!this.isClient) return;
    localStorage.setItem(this.getScopedKey(STORAGE_KEYS.AWARDS), JSON.stringify(awards));
  }

  private static readonly MAX_AUDIT_LOGS = 150;

  static getAuditLogs(): AuditLog[] {
    const cleanInitLog: AuditLog[] = [
      {
        id: 'AUD-00',
        timestamp: new Date().toLocaleString('vi-VN'),
        actorName: 'Ban Quản Trị Hệ Thống',
        actorRole: 'SUPER_ADMIN',
        action: 'KHỞI TẠO CƠ SỞ DỮ LIỆU SẠCH',
        target: 'ITFTMS 2026',
        details: 'Hệ thống khởi tạo cơ sở dữ liệu sạch và sẵn sàng tiếp nhận đăng ký đội bóng mới.',
      },
    ];

    if (!this.isClient) return cleanInitLog;
    let logs = SecureStorage.getItem<AuditLog[]>(STORAGE_KEYS.AUDIT_LOGS);
    if (!logs || !Array.isArray(logs) || logs.length === 0) {
      this.saveAuditLogs(cleanInitLog);
      return cleanInitLog;
    }

    // Bảo mật: Tự động loại bỏ bất kỳ thông tin mật khẩu nào còn vướng trong các log cũ
    let hasChanges = false;
    logs = logs.map((log) => {
      if (log.details && (log.details.includes('Mật khẩu') || log.details.includes('password'))) {
        const sanitized = log.details
          .replace(/\(Mật khẩu:[^\)]+\)/gi, '(Mật khẩu đã được mã hóa bảo mật)')
          .replace(/\(Mật khẩu khởi tạo:[^\)]+\)/gi, '(Mật khẩu đã được mã hóa bảo mật)')
          .replace(/thành "[^"]+"/gi, 'thành công (Đã mã hóa bảo mật)');
        if (sanitized !== log.details) {
          hasChanges = true;
          return { ...log, details: sanitized };
        }
      }
      return log;
    });

    // Giới hạn tối đa số lượng bản ghi để tránh tràn giới hạn 1MB của Firestore
    if (logs.length > this.MAX_AUDIT_LOGS) {
      logs = logs.slice(0, this.MAX_AUDIT_LOGS);
      hasChanges = true;
    }

    if (hasChanges) {
      this.saveAuditLogs(logs);
    }
    return logs;
  }

  static saveAuditLogs(logs: AuditLog[]): void {
    if (!this.isClient) return;
    const capped = Array.isArray(logs) ? logs.slice(0, this.MAX_AUDIT_LOGS) : [];
    SecureStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, capped);
  }

  static logAction(actorName: string, actorRole: UserRole, action: string, target: string, details: string, reason?: string): void {
    // Bỏ qua các log tự động lặp lại gây phình dung lượng CSDL
    if (action === 'TỰ ĐỘNG TẠO TÀI KHOẢN ĐỘI TRƯỞNG' || action === 'CHUYỂN VAI TRÒ HỆ THỐNG') {
      return;
    }

    const logs = this.getAuditLogs();
    const safeDetails = details && details.length > 300 ? `${details.slice(0, 300)}...` : details;

    // Chống ghi trùng liên tiếp cùng một nội dung thao tác
    if (logs.length > 0 && logs[0].action === action && logs[0].target === target && logs[0].details === safeDetails) {
      return;
    }

    const newLog: AuditLog = {
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toLocaleString('vi-VN'),
      actorName,
      actorRole,
      action,
      target,
      details: safeDetails,
      reason,
    };
    logs.unshift(newLog);
    this.saveAuditLogs(logs.slice(0, this.MAX_AUDIT_LOGS));
  }

  static getDeletedTournamentIds(): string[] {
    if (!this.isClient) return [];
    try {
      const data = localStorage.getItem(STORAGE_KEYS.DELETED_TOURNAMENTS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  static addDeletedTournamentId(id: string): void {
    if (!this.isClient || !id) return;
    const current = this.getDeletedTournamentIds();
    if (!current.includes(id)) {
      current.push(id);
      localStorage.setItem(STORAGE_KEYS.DELETED_TOURNAMENTS, JSON.stringify(current));
    }
  }

  static isTournamentDeleted(id: string): boolean {
    if (!id) return false;
    return this.getDeletedTournamentIds().includes(id);
  }

  static mergeDeletedTournamentIds(ids: string[]): void {
    if (!this.isClient || !Array.isArray(ids)) return;
    const current = new Set(this.getDeletedTournamentIds());
    ids.forEach((id) => {
      if (id) current.add(id);
    });
    localStorage.setItem(STORAGE_KEYS.DELETED_TOURNAMENTS, JSON.stringify(Array.from(current)));
  }

  static purgeLegacyTournaments(): void {
    // Đã đồng bộ hoàn toàn qua CSDL MySQL trên hosting, không tự động xóa dữ liệu người dùng.
  }

  static getManualSuspensions(): Record<
    string,
    { isSuspended: boolean; reason?: string; yellows: number; reds: number; decision?: 'PENDING' | 'SUSPENDED' | 'CLEARED' }
  > {
    if (!this.isClient) return {};
    try {
      const raw = localStorage.getItem(this.getScopedKey(STORAGE_KEYS.MANUAL_SUSPENSIONS));
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  static saveManualSuspensions(
    overrides: Record<string, { isSuspended: boolean; reason?: string; yellows: number; reds: number; decision?: 'PENDING' | 'SUSPENDED' | 'CLEARED' }>
  ): void {
    if (!this.isClient) return;
    localStorage.setItem(this.getScopedKey(STORAGE_KEYS.MANUAL_SUSPENSIONS), JSON.stringify(overrides || {}));
  }

  static getPaidFines(): Record<string, PaidFineRecord> {
    if (!this.isClient) return {};
    try {
      const raw = localStorage.getItem(this.getScopedKey(STORAGE_KEYS.PAID_FINES));
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  static savePaidFines(map: Record<string, PaidFineRecord>): void {
    if (!this.isClient) return;
    localStorage.setItem(this.getScopedKey(STORAGE_KEYS.PAID_FINES), JSON.stringify(map || {}));
  }

  static getBtcTieBreaks(): Record<string, string[]> {
    if (!this.isClient) return {};
    try {
      const raw = localStorage.getItem(this.getScopedKey(STORAGE_KEYS.BTC_TIEBREAKS));
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  static saveBtcTieBreaks(map: Record<string, string[]>): void {
    if (!this.isClient) return;
    localStorage.setItem(this.getScopedKey(STORAGE_KEYS.BTC_TIEBREAKS), JSON.stringify(map || {}));
  }

  static getAllTournaments(): Tournament[] {
    if (!this.isClient) return [];
    this.purgeLegacyTournaments();
    const deletedIds = new Set(this.getDeletedTournamentIds());
    const data = localStorage.getItem(STORAGE_KEYS.ALL_TOURNAMENTS);
    if (data === null) {
      return [];
    }
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed.filter((t) => t && t.id && !deletedIds.has(t.id));
      }
      return [];
    } catch {
      return [];
    }
  }

  static saveAllTournaments(list: Tournament[]): void {
    if (!this.isClient) return;
    localStorage.setItem(STORAGE_KEYS.ALL_TOURNAMENTS, JSON.stringify(list));
  }

  static getActiveTournamentId(): string {
    if (!this.isClient) return '';
    const id = localStorage.getItem(STORAGE_KEYS.ACTIVE_TOURNAMENT_ID);
    if (id && !this.isTournamentDeleted(id)) return id;
    const all = this.getAllTournaments();
    return all.length > 0 ? all[0].id : '';
  }

  static setActiveTournamentId(id: string): void {
    if (!this.isClient) return;
    localStorage.setItem(STORAGE_KEYS.ACTIVE_TOURNAMENT_ID, id);
    const tour = this.getAllTournaments().find((t) => t.id === id);
    if (tour) {
      localStorage.setItem(STORAGE_KEYS.TOURNAMENT, JSON.stringify(tour));
    }
  }

  static getTournament(): Tournament {
    const blankTournament: Tournament = {
      id: '',
      name: '',
      shortCode: '',
      year: 2026,
      organizer: '',
      format: 'Sân 5 - Vòng tròn 1 lượt (12 đội)',
      formatType: 'SINGLE_LEAGUE',
      maxTeams: 12,
      numberOfGroups: 1,
      teamsPerGroup: 12,
      advancePerGroup: 3,
      numberOfVenues: 3,
      maxPlayersPerTeam: 12,
      matchDurationMinutes: 60,
      breakDurationMinutes: 5,
      registrationFee: 100000,
      depositFee: 0,
      startDate: '2026-10-17',
      endDate: '2026-11-29',
      status: 'REGISTRATION',
      description: '',
      scheduleConfig: { ...DEFAULT_STUDENT_SCHEDULE_CONFIG },
    };

    if (!this.isClient) return blankTournament;
    const deletedIds = new Set(this.getDeletedTournamentIds());
    const all = this.getAllTournaments();
    const activeId = this.getActiveTournamentId();

    if (activeId && !deletedIds.has(activeId)) {
      const found = all.find((t) => t.id === activeId);
      if (found) return found;
    }

    if (all.length > 0) {
      this.setActiveTournamentId(all[0].id);
      return all[0];
    }

    return blankTournament;
  }

  static saveTournament(tournament: Tournament): void {
    if (!this.isClient) return;
    localStorage.setItem(STORAGE_KEYS.TOURNAMENT, JSON.stringify(tournament));
    const all = this.getAllTournaments();
    const idx = all.findIndex((t) => t.id === tournament.id);
    if (idx >= 0) {
      all[idx] = tournament;
    } else {
      all.unshift(tournament);
    }
    this.saveAllTournaments(all);
  }

  static updateTournament(tournament: Tournament): void {
    this.saveTournament(tournament);
    this.logAction(
      'Ban Tổ Chức',
      'ORGANIZER',
      'CẬP NHẬT CẤU HÌNH GIẢI ĐẤU',
      tournament.name,
      `Cấu hình: ${tournament.numberOfGroups || 4} bảng đấu, ${tournament.teamsPerGroup || 4} đội/bảng, tối đa ${tournament.maxTeams || 16} đội.`
    );
  }

  static deleteTournament(id: string): void {
    if (!this.isClient || !id) return;
    this.addDeletedTournamentId(id);

    let all = this.getAllTournaments().filter((t) => t.id !== id);
    this.saveAllTournaments(all);

    if (this.getActiveTournamentId() === id) {
      if (all.length > 0) {
        this.setActiveTournamentId(all[0].id);
      } else {
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_TOURNAMENT_ID);
        localStorage.removeItem(STORAGE_KEYS.TOURNAMENT);
      }
    }

    // Xóa sạch dữ liệu của giải đấu này trong localStorage
    const keysToPurge = [
      `${STORAGE_KEYS.TEAMS}_${id}`,
      `${STORAGE_KEYS.MATCHES}_${id}`,
      `${STORAGE_KEYS.VENUES}_${id}`,
      `${STORAGE_KEYS.REFEREES}_${id}`,
      `${STORAGE_KEYS.COMPLAINTS}_${id}`,
      `${STORAGE_KEYS.FINANCES}_${id}`,
      `${STORAGE_KEYS.AWARDS}_${id}`,
      `${STORAGE_KEYS.AUDIT_LOGS}_${id}`,
      `${STORAGE_KEYS.STATUS}_${id}`,
      `${STORAGE_KEYS.MANUAL_SUSPENSIONS}_${id}`,
      `${STORAGE_KEYS.BTC_TIEBREAKS}_${id}`,
      `${STORAGE_KEYS.PAID_FINES}_${id}`,
      `itftms_stats_cache_${id}`,
    ];
    if (id === defaultTournament.id) {
      keysToPurge.push(
        STORAGE_KEYS.TEAMS,
        STORAGE_KEYS.MATCHES,
        STORAGE_KEYS.COMPLAINTS,
        STORAGE_KEYS.FINANCES,
        STORAGE_KEYS.TOURNAMENT,
        STORAGE_KEYS.MANUAL_SUSPENSIONS,
        STORAGE_KEYS.BTC_TIEBREAKS,
        STORAGE_KEYS.PAID_FINES
      );
    }
    keysToPurge.forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch {}
    });

    this.logAction(
      'Ban Tổ Chức',
      'SUPER_ADMIN',
      'XÓA GIẢI ĐẤU VĨNH VIỄN',
      `Giải ID: ${id}`,
      `Đã xóa vĩnh viễn giải đấu và toàn bộ dữ liệu kèm theo khỏi hệ thống.`
    );
  }

  static getTournamentStats(tournamentId: string): { teamsCount: number; matchesCount: number } {
    if (!this.isClient) return { teamsCount: 0, matchesCount: 0 };
    const teamKey = tournamentId === defaultTournament.id ? STORAGE_KEYS.TEAMS : `${STORAGE_KEYS.TEAMS}_${tournamentId}`;
    const matchKey = tournamentId === defaultTournament.id ? STORAGE_KEYS.MATCHES : `${STORAGE_KEYS.MATCHES}_${tournamentId}`;
    try {
      const teams = JSON.parse(localStorage.getItem(teamKey) || '[]');
      const matches = JSON.parse(localStorage.getItem(matchKey) || '[]');
      return {
        teamsCount: Array.isArray(teams) ? teams.length : 0,
        matchesCount: Array.isArray(matches) ? matches.length : 0,
      };
    } catch {
      return { teamsCount: 0, matchesCount: 0 };
    }
  }

  static saveTournamentStatsCache(tournamentId: string, teams: Team[], matches: Match[]): void {
    if (!this.isClient) return;
    const teamKey = tournamentId === defaultTournament.id ? STORAGE_KEYS.TEAMS : `${STORAGE_KEYS.TEAMS}_${tournamentId}`;
    const matchKey = tournamentId === defaultTournament.id ? STORAGE_KEYS.MATCHES : `${STORAGE_KEYS.MATCHES}_${tournamentId}`;
    localStorage.setItem(teamKey, JSON.stringify(teams));
    localStorage.setItem(matchKey, JSON.stringify(matches));
  }

  static createNewTournament(tournament: Tournament): void {
    if (!this.isClient) return;
    
    // Gỡ bỏ ID này khỏi danh sách đã xóa nếu từng bị xóa trước đó
    const remainingDeleted = this.getDeletedTournamentIds().filter((dId) => dId !== tournament.id);
    localStorage.setItem(STORAGE_KEYS.DELETED_TOURNAMENTS, JSON.stringify(remainingDeleted));

    // Save to all tournaments list and set as active
    const all = this.getAllTournaments();
    const existingIndex = all.findIndex((t) => t.id === tournament.id);
    if (existingIndex >= 0) {
      all[existingIndex] = tournament;
    } else {
      all.unshift(tournament);
    }
    this.saveAllTournaments(all);
    this.setActiveTournamentId(tournament.id);

    this.saveTournament(tournament);
    this.setTournamentStatus(tournament.status || 'REGISTRATION');
    this.saveComplaints([]);
    this.saveFinances([]);
    this.saveAwards(defaultCleanAwards);
    this.savePaidFines({});
    this.saveManualSuspensions({});
    this.saveBtcTieBreaks({});
    this.saveTeams([]);
    this.saveMatches([]);

    this.logAction(
      'Ban Tổ Chức',
      'SUPER_ADMIN',
      'TẠO MỚI GIẢI ĐẤU (CREATE TOURNAMENT)',
      tournament.name,
      `Khởi tạo giải đấu: ${tournament.name} (${tournament.shortCode}), Thể thức: ${tournament.format}, Khởi tranh: ${tournament.startDate}`
    );
  }

  static getTournamentStatus(): TournamentStatus {
    if (!this.isClient) return 'REGISTRATION';
    const key = this.getScopedKey(STORAGE_KEYS.STATUS);
    return (localStorage.getItem(key) as TournamentStatus) || 'REGISTRATION';
  }

  static setTournamentStatus(status: TournamentStatus): void {
    if (!this.isClient) return;
    const key = this.getScopedKey(STORAGE_KEYS.STATUS);
    localStorage.setItem(key, status);
  }

  static getCurrentRole(): UserRole {
    if (!this.isClient) return 'STUDENT';
    return (localStorage.getItem(STORAGE_KEYS.CURRENT_ROLE) as UserRole) || 'STUDENT';
  }

  static setCurrentRole(role: UserRole): void {
    if (!this.isClient) return;
    localStorage.setItem(STORAGE_KEYS.CURRENT_ROLE, role);
  }

  /**
   * Cleans up teams and matches belonging to excess groups beyond the tournament's numberOfGroups
   */
  static cleanExcessGroupsData(tournament: Tournament): { teams: Team[]; matches: Match[] } {
    if (!this.isClient) return { teams: [], matches: [] };
    if (!tournament || !tournament.id) return { teams: [], matches: [] };
    const isSingleLeague = tournament.formatType === 'SINGLE_LEAGUE' || (tournament.numberOfGroups || 1) === 1;
    const validGroups = getGroupLetters(tournament.numberOfGroups || (isSingleLeague ? 1 : 4));
    const teams = this.getTeams();
    const cleanedTeams = isSingleLeague
      ? teams.map((t) => ({ ...t, group: t.group || 'A' }))
      : teams.filter((t) => !t.group || validGroups.includes(t.group));
    const validTeamIds = new Set(cleanedTeams.map((t) => t.id));

    const matches = this.getMatches();
    const cleanedMatches = matches
      .filter((m) => {
        if (m.round !== 'GROUP') return !isSingleLeague;
        if (!isSingleLeague && m.group && !validGroups.includes(m.group)) return false;
        if (m.homeTeamId && !validTeamIds.has(m.homeTeamId)) return false;
        if (m.awayTeamId && !validTeamIds.has(m.awayTeamId)) return false;
        return true;
      })
      .map((m) => {
        if (m.round !== 'GROUP') {
          return {
            ...m,
            homeTeamId: m.homeTeamId && validTeamIds.has(m.homeTeamId) ? m.homeTeamId : '',
            awayTeamId: m.awayTeamId && validTeamIds.has(m.awayTeamId) ? m.awayTeamId : '',
          };
        }
        return m;
      });

    this.saveTeams(cleanedTeams);
    this.saveMatches(cleanedMatches);

    return { teams: cleanedTeams, matches: cleanedMatches };
  }

  /**
   * Clears ALL mock and transactional data, creating a clean empty slate!
   */
  static clearAllData(): void {
    if (!this.isClient) return;
    this.saveTeams([]);
    this.saveMatches([]);
    this.saveComplaints([]);
    this.saveFinances([]);
    this.saveAwards(defaultCleanAwards);
    this.savePaidFines({});
    this.saveManualSuspensions({});
    this.saveBtcTieBreaks({});
    this.setTournamentStatus('REGISTRATION');

    const cleanLog: AuditLog[] = [
      {
        id: `AUD-${Date.now()}`,
        timestamp: new Date().toLocaleString('vi-VN'),
        actorName: 'Ban Tổ Chức',
        actorRole: 'SUPER_ADMIN',
        action: 'XÓA SẠCH DỮ LIỆU GIẢI ĐẤU (CLEAN DATABASE)',
        target: 'Toàn Hệ Thống ITFTMS 2026',
        details: 'Đã xóa trắng danh sách đội bóng, lịch thi đấu, tỷ số, khiếu nại và thu chi.',
      },
    ];
    this.saveAuditLogs(cleanLog);
  }
}
