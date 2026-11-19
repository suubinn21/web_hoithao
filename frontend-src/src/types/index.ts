// ITFTMS 2026 - TypeScript Data Definitions & Enums

export type UserRole = 'SUPER_ADMIN' | 'ORGANIZER' | 'TEAM_MANAGER' | 'REFEREE' | 'STUDENT';

export interface UserAccount {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  email: string;
  phone?: string;
  avatarUrl?: string;
  studentId?: string;
  class?: string;
  teamId?: string;
  teamName?: string;
  createdAt?: string;
  hasPassword?: boolean;
  passwordAlgo?: 'bcrypt' | 'sha256';
}

export type TournamentStatus =
  | 'DRAFT'
  | 'REGISTRATION'
  | 'REGISTRATION_CLOSED'
  | 'DRAWING'
  | 'GROUP_STAGE'
  | 'QUARTER_FINAL'
  | 'SEMI_FINAL'
  | 'THIRD_PLACE'
  | 'FINAL'
  | 'COMPLETED';

export type SportType = 'FOOTBALL' | 'BADMINTON' | 'VOLLEYBALL';

export type BadmintonCategory =
  | 'MEN_SINGLES'
  | 'WOMEN_SINGLES'
  | 'MEN_DOUBLES'
  | 'WOMEN_DOUBLES'
  | 'MIXED_DOUBLES'
  | 'TEAM_TIE';

export interface SportSetConfig {
  bestOf: 1 | 3 | 5;
  pointsPerSet: number;
  decidingSetPoints: number;
  winByTwo: boolean;
  maxPointCap?: number;
  badmintonCategory?: BadmintonCategory;
}

export interface MatchSetScore {
  setNumber: number;
  homePoints: number;
  awayPoints: number;
  winner?: 'HOME' | 'AWAY';
}

export type TournamentFormatType = 'SINGLE_LEAGUE' | 'GROUP_KNOCKOUT' | 'KNOCKOUT';

export interface TeamBusyConstraint {
  busyDates?: string[];
  busyTimeSlots?: string[];
  busyWeekdays?: number[];
  preferredTimeSlot?: string;
  note?: string;
}

export interface StudentScheduleConfig {
  matchDaysOfWeek: number[]; // 0 = CN, 1 = T2 ... 6 = T7
  pitchesCount: number;      // Mặc định 3 sân
  slotsPerDay: number;       // Mặc định 2 ca/sân -> 6 trận/ngày
  timeSlots: string[];       // Ví dụ ['07:00', '08:20'] hoặc ['15:30', '16:50']
  excludedDates: string[];   // Các ngày nghỉ lễ / thi giữa kỳ né lịch sinh viên
  fixedDates?: string[];     // Các ngày thi đấu cố định do BTC chọn sẵn
  teamBusySlots?: Record<string, TeamBusyConstraint>;
  hasThirdPlace?: boolean;   // Có trận tranh hạng 3 trong thể thức Loại trực tiếp hay không
}

export interface PaidFineRecord {
  paid: boolean;
  paidAt?: string;
  amount: number;
  teamId?: string;
  playerName?: string;
  note?: string;
}

export interface Tournament {
  id: string;
  name: string;
  shortCode: string;
  year: number;
  organizer: string;
  sportType?: SportType;
  setConfig?: SportSetConfig;
  format: string;
  formatType?: TournamentFormatType;
  maxTeams: number;
  maxPlayersPerTeam: number;
  matchDurationMinutes: number;
  breakDurationMinutes: number;
  registrationFee: number;
  depositFee: number;
  startDate: string;
  endDate: string;
  status: TournamentStatus;
  description?: string;
  numberOfGroups?: number;  // 1 nếu là vòng tròn chung
  teamsPerGroup?: number;   // 12 nếu là vòng tròn 12 đội
  advancePerGroup?: number; // 3 (Top 3 huy chương)
  numberOfVenues?: number;  // 3 sân
  scheduleConfig?: StudentScheduleConfig;
}

export const getGroupLetters = (num: number = 4): string[] => {
  const count = Math.max(1, Math.min(26, num || 4));
  return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.slice(0, count).split('');
};

export type TeamStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN' | 'DISQUALIFIED';
export type PaymentStatus = 'UNPAID' | 'PAID' | 'REFUNDED' | 'FORFEITED';

export type PlayerPosition =
  | 'GK'
  | 'DF'
  | 'MF'
  | 'FW'
  | 'SINGLES'
  | 'DOUBLES'
  | 'MIXED'
  | 'SETTER'
  | 'OUTSIDE'
  | 'MIDDLE'
  | 'OPPOSITE'
  | 'LIBERO';

export interface Player {
  id: string;
  teamId: string;
  name: string;
  studentId: string; // MSSV
  class: string;     // Lớp
  cohort: string;    // Khóa: K21, K22, K23, K24...
  dateOfBirth: string;
  jerseyNumber: number;
  position: PlayerPosition;
  avatarUrl?: string;
  yellowCards: number;
  redCards: number;
  isSuspended: boolean;
  suspensionReason?: string;
  goals: number;
  assists: number;
}

export interface Team {
  id: string;
  name: string;
  shortName: string;
  logo: string;
  class: string;
  department: string;
  leaderName: string;   // Trưởng đoàn
  captainName: string;  // Đội trưởng
  phoneNumber: string;
  email: string;
  primaryColor: string; // Hex color for primary kit
  secondaryColor: string;
  status: TeamStatus;
  feeStatus: PaymentStatus;
  registrationFee: number; // 500,000 VND
  depositFee: number;      // 50,000 VND
  group?: string; // Bảng A, B, C, D, E, F...
  players: Player[];
}

export type VenueStatus = 'AVAILABLE' | 'MAINTENANCE' | 'OCCUPIED';

export interface Venue {
  id: string;
  name: string;
  location: string;
  status: VenueStatus;
}

export interface Referee {
  id: string;
  code: string;
  name: string;
  phoneNumber: string;
  status: 'ACTIVE' | 'BUSY' | 'INACTIVE';
}

export type MatchStatus =
  | 'SCHEDULED'
  | 'CHECKING'
  | 'LIVE'
  | 'HALFTIME'
  | 'FINISHED'
  | 'POSTPONED'
  | 'CANCELLED';

export type CardType = 'YELLOW' | 'SECOND_YELLOW' | 'RED';

export interface MatchEvent {
  id: string;
  matchId: string;
  type: 'GOAL' | 'CARD' | 'SUBSTITUTION' | 'NOTE' | 'SET_WIN';
  minute: number;
  teamId: string;
  playerId?: string;
  playerName?: string;
  playerInId?: string;
  playerInName?: string;
  playerOutId?: string;
  playerOutName?: string;
  cardType?: CardType;
  assistPlayerId?: string;
  assistPlayerName?: string;
  isOwnGoal?: boolean;
  reason?: string;
  setNumber?: number;
  setScoreLabel?: string;
  timestamp: string;
}

export interface PenaltyShootout {
  homeScore: number;
  awayScore: number;
  shots: {
    teamId: string;
    round: number;
    scored: boolean;
    playerId?: string;
  }[];
}

export type MatchRound =
  | 'ROUND_OF_64'
  | 'ROUND_OF_32'
  | 'ROUND_OF_16'
  | 'GROUP'
  | 'QUARTER_FINAL'
  | 'SEMI_FINAL'
  | 'THIRD_PLACE'
  | 'FINAL';

export interface Match {
  id: string;
  matchNumber: number;
  round: MatchRound;
  roundNumber?: number; // Vòng 1..11 cho thể thức vòng tròn 1 lượt
  group?: string; // Bảng A, B, C, D, E, F...
  roundLabel: string; // e.g., "Vòng 1", "Tứ kết 1"
  venueId: string;
  venueName?: string;
  date: string;       // YYYY-MM-DD
  time: string;       // HH:mm
  homeTeamId: string;
  awayTeamId: string;
  refereeId: string;
  refereeName?: string;
  homeScore: number;
  awayScore: number;
  status: MatchStatus;
  currentMinute: number;
  half: 1 | 2;
  penaltyShootout?: PenaltyShootout;
  winnerTeamId?: string;
  events: MatchEvent[];
  completedAt?: string; // ISO string for complaint window
  needsBtcReview?: boolean;
  reviewReason?: string;
  isCustomMatchup?: boolean; // Đánh dấu trận do BTC tự chỉ định đội đấu thủ công
  isLocked?: boolean;        // Khóa lịch khi tinh chỉnh để không bị xếp đè
  durationMinutes?: number;  // Thời lượng trận riêng (phút), bỏ trống nếu dùng mặc định giải
  breakDurationMinutes?: number; // Nghỉ giữa hiệp riêng (phút)
  isForfeit?: boolean;       // Xử thua 0-3 (hoặc 0-2 / 0-3 set tùy môn)
  forfeitedTeamId?: string;
  forfeitReason?: string;
  sets?: MatchSetScore[];    // Tỷ số chi tiết từng set (Cầu lông / Bóng chuyền)
  currentSet?: number;       // Set đang diễn ra (1..5)
  badmintonCategory?: BadmintonCategory;
  bracketStage?: number;     // Chỉ số vòng trong nhánh loại trực tiếp (0 = vòng đầu)
  nextMatchId?: string;      // ID trận tiếp theo đội thắng sẽ vào
  nextSlot?: 'HOME' | 'AWAY';
  thirdPlaceMatchId?: string;
  thirdPlaceSlot?: 'HOME' | 'AWAY';
  byeNote?: string;          // Ghi chú đội được miễn vòng 1 (BYE)
  clockStartedAt?: number;   // Server-calibrated Unix ms when the current running clock started
  clockBaseSeconds?: number; // Accumulated elapsed seconds before clockStartedAt
  clockPaused?: boolean;     // True while match status is LIVE but referee paused clock
}

export interface GroupStanding {
  teamId: string;
  teamName: string;
  shortName: string;
  logo: string;
  played: number; // ST
  won: number;    // T
  drawn: number;  // H
  lost: number;   // B
  goalsFor: number;    // BT (hoặc Set/Ván thắng)
  goalsAgainst: number;// BB (hoặc Set/Ván thua)
  goalDifference: number; // +/- (hiệu số bàn hoặc hiệu số set)
  points: number; // Đ
  yellowCards: number; // Thẻ vàng vòng bảng
  redCards: number;    // Thẻ đỏ trực tiếp vòng bảng
  cardPoints: number;  // Điểm thẻ quy đổi (01 thẻ đỏ trực tiếp = 02 thẻ vàng)
  setsWon?: number;
  setsLost?: number;
  setDifference?: number;
  pointsFor?: number;
  pointsAgainst?: number;
  pointsDifference?: number;
  rank: number;
  needsBtcTieBreak?: boolean;
  btcTieBreakResolved?: boolean;
  isWithdrawn?: boolean;
}

export interface KnockoutBracketItem {
  id: string; // e.g. "TK1", "BK1", "FINAL"
  label: string;
  matchId?: string;
  homeTeam?: {
    id: string;
    name: string;
    logo: string;
    placeholderLabel: string; // e.g. "Nhất bảng A"
    score?: number;
    penaltyScore?: number;
    isWinner?: boolean;
  };
  awayTeam?: {
    id: string;
    name: string;
    logo: string;
    placeholderLabel: string; // e.g. "Nhì bảng B"
    score?: number;
    penaltyScore?: number;
    isWinner?: boolean;
  };
  winnerId?: string;
  status: MatchStatus;
  date?: string;
  time?: string;
  venue?: string;
}

export type ComplaintStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'RESOLVED';
export type ComplaintType = 'REFEREE_DECISION' | 'PLAYER_ELIGIBILITY' | 'UNSPORTSMANLIKE' | 'FACILITY' | 'OTHER';

export interface Complaint {
  id: string;
  matchId: string;
  teamId: string;
  teamName: string;
  submittedAt: string;
  expiresAt: string; // 15 minutes after match finish
  type: ComplaintType;
  title: string;
  content: string;
  evidenceUrls: string[];
  status: ComplaintStatus;
  reviewerResponse?: string;
  resolvedAt?: string;
}

export type ExpenseCategory =
  | 'VENUE_RENTAL'
  | 'REFEREE'
  | 'TROPHY_MEDALS'
  | 'WATER_MEDICAL'
  | 'BANNER_PRINT'
  | 'PRIZES'
  | 'OTHER';

export type RevenueCategory =
  | 'REGISTRATION_FEE'
  | 'DEPOSIT'
  | 'SPONSORSHIP'
  | 'OTHER';

export interface FinancialTransaction {
  id: string;
  type: 'INCOME' | 'EXPENSE';
  category: RevenueCategory | ExpenseCategory;
  categoryName: string;
  amount: number;
  date: string;
  description: string;
  recipientOrPayer: string;
  teamId?: string;
  receiptUrl?: string;
}

export interface TournamentAward {
  id: string;
  code: 'CHAMPION' | 'RUNNER_UP' | 'THIRD_PLACE' | 'BEST_GK' | 'CUSTOM' | string;
  title: string;
  recipientName: string;
  recipientTeam: string;
  prizeMoney: number;
  icon: string;
  customImage?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  target: string;
  details: string;
  reason?: string;
}

export interface SportMetaInfo {
  sportType: SportType;
  icon: string;
  label: string;
  fullLabel: string;
  unitLabel: string;
  unitShortLabel: string;
  playerLabel: string;
  venueLabel: string;
  scoreLabel: string;
  isSetSport: boolean;
  defaultPosition: PlayerPosition;
  positions: { value: PlayerPosition; label: string }[];
  defaultSetConfig: SportSetConfig;
}

const DEFAULT_BADMINTON_SET_CONFIG: SportSetConfig = {
  bestOf: 3,
  pointsPerSet: 21,
  decidingSetPoints: 21,
  winByTwo: true,
  maxPointCap: 30,
  badmintonCategory: 'MEN_DOUBLES',
};

const DEFAULT_VOLLEYBALL_SET_CONFIG: SportSetConfig = {
  bestOf: 3,
  pointsPerSet: 25,
  decidingSetPoints: 15,
  winByTwo: true,
};

const DEFAULT_FOOTBALL_SET_CONFIG: SportSetConfig = {
  bestOf: 3,
  pointsPerSet: 21,
  decidingSetPoints: 21,
  winByTwo: true,
};

export function getSportMeta(sportType?: SportType): SportMetaInfo {
  if (sportType === 'BADMINTON') {
    return {
      sportType: 'BADMINTON',
      icon: '🏸',
      label: 'Cầu Lông',
      fullLabel: 'Cầu lông (Đơn / Đôi / Đồng đội)',
      unitLabel: 'Đội / Cặp VĐV',
      unitShortLabel: 'Đội/Cặp',
      playerLabel: 'VĐV',
      venueLabel: 'Sân cầu',
      scoreLabel: 'Ván thắng',
      isSetSport: true,
      defaultPosition: 'DOUBLES',
      positions: [
        { value: 'SINGLES', label: 'Đánh Đơn (Singles)' },
        { value: 'DOUBLES', label: 'Đánh Đôi (Doubles)' },
        { value: 'MIXED', label: 'Đôi Nam Nữ (Mixed)' },
      ],
      defaultSetConfig: { ...DEFAULT_BADMINTON_SET_CONFIG },
    };
  }
  if (sportType === 'VOLLEYBALL') {
    return {
      sportType: 'VOLLEYBALL',
      icon: '🏐',
      label: 'Bóng Chuyền',
      fullLabel: 'Bóng chuyền (6 người / Hội thao)',
      unitLabel: 'Đội bóng chuyền',
      unitShortLabel: 'Đội',
      playerLabel: 'VĐV',
      venueLabel: 'Sân bóng chuyền',
      scoreLabel: 'Set thắng',
      isSetSport: true,
      defaultPosition: 'OUTSIDE',
      positions: [
        { value: 'SETTER', label: 'Chuyền Hai (Setter)' },
        { value: 'OUTSIDE', label: 'Chủ Công (Outside)' },
        { value: 'MIDDLE', label: 'Phụ Công (Middle)' },
        { value: 'OPPOSITE', label: 'Đối Chuyền (Opposite)' },
        { value: 'LIBERO', label: 'Libero (Phòng thủ)' },
      ],
      defaultSetConfig: { ...DEFAULT_VOLLEYBALL_SET_CONFIG },
    };
  }
  return {
    sportType: 'FOOTBALL',
    icon: '⚽',
    label: 'Bóng Đá',
    fullLabel: 'Bóng đá sân 5',
    unitLabel: 'Đội bóng',
    unitShortLabel: 'Đội',
    playerLabel: 'Cầu thủ',
    venueLabel: 'Sân bóng',
    scoreLabel: 'Bàn thắng',
    isSetSport: false,
    defaultPosition: 'FW',
    positions: [
      { value: 'GK', label: 'Thủ Môn (GK)' },
      { value: 'DF', label: 'Hậu Vệ (DF)' },
      { value: 'MF', label: 'Tiền Vệ (MF)' },
      { value: 'FW', label: 'Tiền Đạo (FW)' },
    ],
    defaultSetConfig: { ...DEFAULT_FOOTBALL_SET_CONFIG },
  };
}

export function getBadmintonCategoryLabel(category?: BadmintonCategory): string {
  switch (category) {
    case 'MEN_SINGLES':
      return 'Đơn Nam';
    case 'WOMEN_SINGLES':
      return 'Đơn Nữ';
    case 'MEN_DOUBLES':
      return 'Đôi Nam';
    case 'WOMEN_DOUBLES':
      return 'Đôi Nữ';
    case 'MIXED_DOUBLES':
      return 'Đôi Nam Nữ';
    case 'TEAM_TIE':
      return 'Đồng Đội';
    default:
      return 'Đôi / Đơn';
  }
}

export function getEffectiveSetConfig(tournament?: Partial<Tournament>): SportSetConfig {
  const meta = getSportMeta(tournament?.sportType);
  return {
    ...meta.defaultSetConfig,
    ...(tournament?.setConfig || {}),
  };
}

export function determineSetWinner(
  homePoints: number,
  awayPoints: number,
  setNumber: number,
  cfg: SportSetConfig
): 'HOME' | 'AWAY' | undefined {
  if (homePoints === awayPoints) return undefined;
  const target = cfg.bestOf > 1 && setNumber >= cfg.bestOf ? cfg.decidingSetPoints : cfg.pointsPerSet;
  if (cfg.maxPointCap && cfg.maxPointCap > 0 && (homePoints >= cfg.maxPointCap || awayPoints >= cfg.maxPointCap)) {
    return homePoints > awayPoints ? 'HOME' : 'AWAY';
  }
  if (cfg.winByTwo) {
    if (homePoints >= target && homePoints - awayPoints >= 2) return 'HOME';
    if (awayPoints >= target && awayPoints - homePoints >= 2) return 'AWAY';
    return undefined;
  }
  if (homePoints >= target && homePoints > awayPoints) return 'HOME';
  if (awayPoints >= target && awayPoints > homePoints) return 'AWAY';
  return undefined;
}

export function computeSetsSummary(
  sets: MatchSetScore[] | undefined,
  cfg: SportSetConfig
): {
  homeSetsWon: number;
  awaySetsWon: number;
  homeTotalPoints: number;
  awayTotalPoints: number;
  normalizedSets: MatchSetScore[];
} {
  let homeSetsWon = 0;
  let awaySetsWon = 0;
  let homeTotalPoints = 0;
  let awayTotalPoints = 0;

  const normalizedSets = (sets || []).map((s, idx) => {
    const setNum = s.setNumber || idx + 1;
    const h = Math.max(0, Number(s.homePoints) || 0);
    const a = Math.max(0, Number(s.awayPoints) || 0);
    homeTotalPoints += h;
    awayTotalPoints += a;
    const winner = s.winner || determineSetWinner(h, a, setNum, cfg);
    if (winner === 'HOME') homeSetsWon += 1;
    else if (winner === 'AWAY') awaySetsWon += 1;
    return {
      setNumber: setNum,
      homePoints: h,
      awayPoints: a,
      ...(winner ? { winner } : {}),
    };
  });

  return {
    homeSetsWon,
    awaySetsWon,
    homeTotalPoints,
    awayTotalPoints,
    normalizedSets,
  };
}

export function formatMatchSetsCompact(match?: Match): string {
  if (!match || !Array.isArray(match.sets) || match.sets.length === 0) return '';
  return match.sets
    .filter((s) => s.homePoints > 0 || s.awayPoints > 0)
    .map((s) => `${s.homePoints}-${s.awayPoints}`)
    .join(', ');
}

/** Computes authoritative elapsed match seconds across all devices. */
export function computeMatchElapsedSeconds(
  match?: Pick<Match, 'status' | 'currentMinute' | 'clockStartedAt' | 'clockBaseSeconds' | 'clockPaused'>,
  nowMs: number = Date.now()
): number {
  if (!match) return 0;
  const baseSec =
    typeof match.clockBaseSeconds === 'number' && Number.isFinite(match.clockBaseSeconds)
      ? Math.max(0, Math.floor(match.clockBaseSeconds))
      : Math.max(0, Math.floor((match.currentMinute || 0) * 60));

  if (
    match.status === 'LIVE' &&
    !match.clockPaused &&
    typeof match.clockStartedAt === 'number' &&
    Number.isFinite(match.clockStartedAt) &&
    match.clockStartedAt > 0
  ) {
    const deltaSec = Math.max(0, Math.floor((nowMs - match.clockStartedAt) / 1000));
    return baseSec + deltaSec;
  }

  return baseSec;
}

/** Formats elapsed seconds as MM:SS without truncating matches >= 100 minutes. */
export function formatClockMMSS(totalSec: number): string {
  const clamped = Math.max(0, Math.floor(totalSec || 0));
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
