'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Match, Team, Venue, Referee, UserRole, Tournament, MatchStatus, StudentScheduleConfig, TeamBusyConstraint } from '@/types';
import { ScheduleEngine, DEFAULT_STUDENT_SCHEDULE_CONFIG } from '@/services/scheduleEngine';
import { KnockoutEngine } from '@/services/knockoutEngine';
import { StorageService } from '@/services/storage';
import { 
  Calendar, 
  MapPin, 
  Clock, 
  Sparkles, 
  CheckCircle2, 
  Radio, 
  AlertCircle,
  Filter,
  RefreshCw,
  Edit3,
  Zap,
  X,
  AlertTriangle,
  CalendarDays,
  LayoutGrid,
  Sun,
  Sunset,
  Timer,
  Coffee,
  Trophy,
  ArrowLeftRight,
  Lock,
  Unlock,
  GraduationCap,
  Sliders,
  Users
} from 'lucide-react';

interface ScheduleViewProps {
  matches: Match[];
  teams: Team[];
  venues: Venue[];
  referees: Referee[];
  onMatchesUpdate: (matches: Match[]) => void;
  onSelectMatch: (matchId: string) => void;
  currentRole: UserRole;
  tournament?: Tournament;
  onTournamentUpdate?: (tournament: Tournament) => void;
}

const WEEKDAY_OPTIONS = [
  { val: 1, label: 'Thứ 2' },
  { val: 2, label: 'Thứ 3' },
  { val: 3, label: 'Thứ 4' },
  { val: 4, label: 'Thứ 5' },
  { val: 5, label: 'Thứ 6' },
  { val: 6, label: 'Thứ 7' },
  { val: 0, label: 'Chủ Nhật' },
];

const STUDENT_SLOT_PRESETS = [
  { label: 'Sáng Cuối Tuần (07:00 & 08:20)', slots: ['07:00', '08:20'] },
  { label: 'Chiều Sau Giờ Học (15:30 & 16:50)', slots: ['15:30', '16:50'] },
  { label: 'Tối Đèn Sân (17:30 & 18:50)', slots: ['17:30', '18:50'] },
];

export const ScheduleView: React.FC<ScheduleViewProps> = ({
  matches,
  teams,
  venues,
  referees,
  onMatchesUpdate,
  onSelectMatch,
  currentRole,
  tournament,
  onTournamentUpdate,
}) => {
  const isSingleLeague = (tournament?.formatType || 'SINGLE_LEAGUE') === 'SINGLE_LEAGUE';

  const [filterVenue, setFilterVenue] = useState<string>('ALL');
  const [filterRound, setFilterRound] = useState<string>('ALL');
  const [filterRoundNum, setFilterRoundNum] = useState<number | 'ALL'>('ALL');
  const [filterTeamId, setFilterTeamId] = useState<string>('ALL');
  const [filterDate, setFilterDate] = useState<string>('ALL');
  const [filterTimeSlot, setFilterTimeSlot] = useState<string>('ALL');
  const [sortOrder, setSortOrder] = useState<'TIME_ASC' | 'TIME_DESC' | 'MATCH_NUM'>('TIME_ASC');
  const [viewLayout, setViewLayout] = useState<'GROUPED_BY_DATE' | 'GRID'>('GROUPED_BY_DATE');

  // Student-Friendly Scheduler Controls
  const [showStudentPanel, setShowStudentPanel] = useState<boolean>(false);
  const [newExcludedDate, setNewExcludedDate] = useState<string>('');
  const [newFixedDate, setNewFixedDate] = useState<string>('');
  const [newTimeSlotInput, setNewTimeSlotInput] = useState<string>('19:00');
  const [fixedDurationDraft, setFixedDurationDraft] = useState<number>(
    tournament?.matchDurationMinutes || (isSingleLeague ? 60 : 40)
  );
  const [fixedBreakDraft, setFixedBreakDraft] = useState<number>(
    tournament?.breakDurationMinutes ?? 5
  );

  useEffect(() => {
    setFixedDurationDraft(tournament?.matchDurationMinutes || (isSingleLeague ? 60 : 40));
    setFixedBreakDraft(tournament?.breakDurationMinutes ?? 5);
  }, [tournament?.id, tournament?.matchDurationMinutes, tournament?.breakDurationMinutes, isSingleLeague]);
  const [selectedConstraintTeamId, setSelectedConstraintTeamId] = useState<string>(teams[0]?.id || '');
  const [newTeamBusyDate, setNewTeamBusyDate] = useState<string>('');
  const [swapSourceMatchId, setSwapSourceMatchId] = useState<string | null>(null);
  const [shiftTargets, setShiftTargets] = useState<Record<string, string>>({});
  const [showConflictDetails, setShowConflictDetails] = useState<boolean>(false);

  // Edit Single Match Modal State
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editVenueId, setEditVenueId] = useState('');
  const [editRefereeId, setEditRefereeId] = useState('');
  const [editStatus, setEditStatus] = useState<MatchStatus>('SCHEDULED');
  const [editHomeTeamId, setEditHomeTeamId] = useState('');
  const [editAwayTeamId, setEditAwayTeamId] = useState('');
  const [editIsCustomMatchup, setEditIsCustomMatchup] = useState(false);
  const [editIsLocked, setEditIsLocked] = useState(false);
  const [editUseCustomDuration, setEditUseCustomDuration] = useState(false);
  const [editDurationMinutes, setEditDurationMinutes] = useState<number>(60);
  const [editBreakDurationMinutes, setEditBreakDurationMinutes] = useState<number>(5);

  const canGenerate = currentRole === 'SUPER_ADMIN' || currentRole === 'ORGANIZER';

  const scheduleConfig: StudentScheduleConfig = useMemo(() => {
    const base = tournament?.scheduleConfig;
    return {
      matchDaysOfWeek: base?.matchDaysOfWeek?.length ? base.matchDaysOfWeek : DEFAULT_STUDENT_SCHEDULE_CONFIG.matchDaysOfWeek,
      pitchesCount: base?.pitchesCount || tournament?.numberOfVenues || DEFAULT_STUDENT_SCHEDULE_CONFIG.pitchesCount,
      slotsPerDay: base?.slotsPerDay || DEFAULT_STUDENT_SCHEDULE_CONFIG.slotsPerDay,
      timeSlots: base?.timeSlots?.length ? base.timeSlots : DEFAULT_STUDENT_SCHEDULE_CONFIG.timeSlots,
      excludedDates: base?.excludedDates || [],
      fixedDates: base?.fixedDates || [],
      teamBusySlots: base?.teamBusySlots || {},
    };
  }, [tournament]);

  const updateScheduleConfig = (nextConfig: StudentScheduleConfig) => {
    if (!tournament) return;
    const updatedTour: Tournament = {
      ...tournament,
      numberOfVenues: nextConfig.pitchesCount,
      scheduleConfig: nextConfig,
    };
    StorageService.saveTournament(updatedTour);
    if (onTournamentUpdate) {
      onTournamentUpdate(updatedTour);
    }
  };

  // Conflict & Student Timetable Analysis
  const validationResult = ScheduleEngine.validateSchedule(matches);
  const studentAnalysis = useMemo(
    () => ScheduleEngine.analyzeScheduleForStudents(matches, teams, scheduleConfig),
    [matches, teams, scheduleConfig]
  );

  const studentWarningMatchIds = useMemo(
    () => new Set(studentAnalysis.studentWarnings.map((w) => w.matchId)),
    [studentAnalysis]
  );

  const getTeam = (teamId: string) => teams.find((t) => t.id === teamId);

  // Trigger Automatic Schedule Generator
  const handleAutoGenerate = () => {
    if (!canGenerate) return;
    try {
      const startDate = tournament?.startDate || '2026-10-17';

      if (isSingleLeague) {
        if (teams.length < 2) {
          alert('Cần ít nhất 2 đội đã đăng ký để xếp lịch thi đấu vòng tròn!');
          return;
        }
        const ok = matches.length === 0 || window.confirm(
          `Tạo lại toàn bộ lịch thi đấu vòng tròn 1 lượt cho ${teams.length} đội (${(teams.length * (teams.length - 1)) / 2} trận)?\n\n• Thuê ${scheduleConfig.pitchesCount} sân × ${scheduleConfig.slotsPerDay} trận/sân = ${scheduleConfig.pitchesCount * scheduleConfig.slotsPerDay} trận/ngày\n• Áp dụng lịch rảnh/bận sinh viên đã cấu hình\n• Nhấn OK để tạo lịch mới (hoặc dùng nút "Tối Ưu Phần Còn Lại" nếu muốn giữ các trận đã khóa / đã đá).`
        );
        if (!ok) return;

        const effectiveTour: Tournament = {
          ...(tournament || ({} as Tournament)),
          startDate,
          scheduleConfig,
          numberOfVenues: scheduleConfig.pitchesCount,
        };
        const generated = ScheduleEngine.generateStudentLeagueSchedule(teams, venues, referees, effectiveTour);
        onMatchesUpdate(generated);
        StorageService.saveMatches(generated);
        StorageService.logAction(
          currentRole,
          currentRole,
          'TỰ ĐỘNG XẾP LỊCH VÒNG TRÒN SINH VIÊN',
          `${generated.length} Trận (${teams.length} Đội • ${scheduleConfig.pitchesCount} Sân)`,
          `Xếp ${generated.length} trận vòng tròn 1 lượt theo ${scheduleConfig.pitchesCount} sân × ${scheduleConfig.slotsPerDay} ca/ngày (${scheduleConfig.timeSlots.join(', ')}) từ ${startDate}.`
        );
        alert(`Đã tự động xếp lịch ${generated.length} trận (${teams.length} đội) phù hợp lịch học sinh viên!`);
        return;
      }

      const generated = ScheduleEngine.generateGroupSchedule(teams, venues, referees, startDate);
      const knockouts = ScheduleEngine.generateKnockoutSchedule(venues, referees, startDate);
      const allUpdated = [...generated, ...knockouts];

      onMatchesUpdate(allUpdated);
      StorageService.saveMatches(allUpdated);

      StorageService.logAction(
        currentRole,
        currentRole,
        'TỰ ĐỘNG LẬP LỊCH THI ĐẤU (CHIA BẢNG + KNOCKOUT)',
        `${allUpdated.length} Trận Đấu`,
        `Tự động xếp ${allUpdated.length} trận vòng bảng và Knockout từ ${startDate}.`
      );

      alert(`Đã tạo thành công lịch thi đấu ${allUpdated.length} trận!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Có lỗi khi tạo lịch thi đấu.';
      alert(`Lỗi: ${msg}`);
    }
  };

  // Re-optimize only remaining unlocked & unplayed matches around student constraints
  const handleReoptimizeRemaining = () => {
    if (!canGenerate) return;
    if (matches.length === 0) {
      handleAutoGenerate();
      return;
    }
    const unlockedCount = matches.filter((m) => m.status === 'SCHEDULED' && !m.isLocked).length;
    if (unlockedCount === 0) {
      alert('Tất cả trận đấu đều đã đá hoặc đang được khóa (🔒). Hãy mở khóa trận cần chỉnh trước khi tối ưu lại.');
      return;
    }
    const confirmed = window.confirm(
      `Hệ thống sẽ giữ nguyên toàn bộ trận ĐÃ ĐÁ / ĐANG ĐÁ / ĐÃ KHÓA (🔒), và tự động xếp lại ${unlockedCount} trận còn lại sao cho:\n• Không trùng ngày nghỉ / tuần thi đã đánh dấu\n• Hạn chế tối đa ca học / lịch bận của sinh viên từng lớp\n• Đảm bảo ${scheduleConfig.pitchesCount} sân × ${scheduleConfig.slotsPerDay} trận/ngày không xung đột\n\nTiếp tục tối ưu?`
    );
    if (!confirmed) return;

    const effectiveTour: Tournament = {
      ...(tournament || ({} as Tournament)),
      startDate: tournament?.startDate || '2026-10-17',
      scheduleConfig,
      numberOfVenues: scheduleConfig.pitchesCount,
    };
    const optimized = ScheduleEngine.reoptimizeRemainingMatches(
      matches,
      teams,
      venues,
      referees,
      effectiveTour
    );
    onMatchesUpdate(optimized);
    StorageService.saveMatches(optimized);
    StorageService.logAction(
      currentRole,
      currentRole,
      'TỰ TỐI ƯU LẠI LỊCH THEO LỊCH SINH VIÊN',
      `${unlockedCount} trận chưa khóa`,
      `Giữ nguyên các trận đã khóa/đã đá, xếp lại ${unlockedCount} trận theo lịch rảnh/bận sinh viên và tránh ngày nghỉ.`
    );
    const afterCheck = ScheduleEngine.analyzeScheduleForStudents(optimized, teams, scheduleConfig);
    alert(
      `Đã tối ưu lại ${unlockedCount} trận đấu!\n• Xung đột cứng sân/giờ: ${afterCheck.hardConflicts.length}\n• Cảnh báo trùng giờ học sinh viên: ${afterCheck.studentWarnings.length}`
    );
  };

  // Toggle Lock on a Match Card
  const handleToggleLockMatch = (e: React.MouseEvent, matchId: string) => {
    e.stopPropagation();
    if (!canGenerate) return;
    const updated = matches.map((m) =>
      m.id === matchId ? { ...m, isLocked: !m.isLocked } : m
    );
    onMatchesUpdate(updated);
    StorageService.saveMatches(updated);
  };

  // Swap 2 Match Time/Date/Pitch slots interactively
  const handleSwapMatchClick = (e: React.MouseEvent, matchId: string) => {
    e.stopPropagation();
    if (!canGenerate) return;
    if (!swapSourceMatchId) {
      setSwapSourceMatchId(matchId);
      return;
    }
    if (swapSourceMatchId === matchId) {
      setSwapSourceMatchId(null);
      return;
    }
    const mA = matches.find((m) => m.id === swapSourceMatchId);
    const mB = matches.find((m) => m.id === matchId);
    const swapped = ScheduleEngine.swapMatchSlots(matches, swapSourceMatchId, matchId);
    onMatchesUpdate(swapped);
    StorageService.saveMatches(swapped);
    StorageService.logAction(
      currentRole,
      currentRole,
      'HOÁN ĐỔI CA / SÂN THI ĐẤU',
      `Trận #${mA?.matchNumber || ''} ↔ Trận #${mB?.matchNumber || ''}`,
      `Hoán đổi ngày/giờ/sân giữa Trận #${mA?.matchNumber} (${mA?.date} ${mA?.time}) và Trận #${mB?.matchNumber} (${mB?.date} ${mB?.time}).`
    );
    setSwapSourceMatchId(null);
  };

  // Shift whole matchday to a new date
  const handleShiftDay = (fromDate: string, toDate: string) => {
    if (!canGenerate || !toDate || toDate === fromDate) return;
    const ok = window.confirm(`Dời tất cả trận CHƯA ĐÁ từ ngày ${fromDate} sang ngày ${toDate}?`);
    if (!ok) return;
    const shifted = ScheduleEngine.shiftMatchDay(matches, fromDate, toDate);
    onMatchesUpdate(shifted);
    StorageService.saveMatches(shifted);
    StorageService.logAction(
      currentRole,
      currentRole,
      'DỜI NGÀY THI ĐẤU CẢ NGÀY',
      `${fromDate} ➔ ${toDate}`,
      `Đã dời các trận chưa diễn ra từ ${fromDate} sang ${toDate} để phù hợp lịch sinh viên.`
    );
  };

  // Trigger Synchronization of all 32 matches to tournament start date (GROUP_KNOCKOUT)
  const handleSyncAllSchedule = () => {
    if (!canGenerate) return;
    const startDate = tournament?.startDate || '2026-10-15';
    const confirmed = window.confirm(
      `Đồng bộ toàn bộ lịch 32 trận đấu theo mô hình TRỌN GÓI 1 NGÀY TRÊN 4 SÂN (${startDate})?\n\nToàn bộ tỉ số và sự kiện đã diễn ra được bảo toàn nguyên vẹn.`
    );
    if (!confirmed) return;

    const syncedMatches = ScheduleEngine.synchronizeMatchTimes(
      matches,
      teams,
      venues,
      referees,
      startDate
    );
    onMatchesUpdate(syncedMatches);
    StorageService.saveMatches(syncedMatches);
    StorageService.logAction(
      currentRole,
      currentRole,
      'ĐỒNG BỘ LỊCH THI ĐẤU 1 NGÀY TOÀN GIẢI (4 SÂN)',
      '32 Trận Đấu',
      `Đồng bộ 32 trận đấu ngày ${startDate}.`
    );
    alert(`Đã đồng bộ lịch thi đấu thành công (${startDate})!`);
  };

  // Open Edit Modal for a specific match
  const handleOpenEditMatch = (e: React.MouseEvent, m: Match) => {
    e.stopPropagation();
    setEditingMatch(m);
    setEditDate(m.date);
    setEditTime(m.time);
    setEditVenueId(m.venueId);
    setEditRefereeId(m.refereeId);
    setEditStatus(m.status);
    setEditHomeTeamId(m.homeTeamId || '');
    setEditAwayTeamId(m.awayTeamId || '');
    setEditIsCustomMatchup(Boolean(m.isCustomMatchup));
    setEditIsLocked(Boolean(m.isLocked));
    const hasCustomDuration = typeof m.durationMinutes === 'number' || typeof m.breakDurationMinutes === 'number';
    setEditUseCustomDuration(hasCustomDuration);
    setEditDurationMinutes(m.durationMinutes || tournament?.matchDurationMinutes || (isSingleLeague ? 60 : 40));
    setEditBreakDurationMinutes(m.breakDurationMinutes ?? tournament?.breakDurationMinutes ?? 5);
  };

  // Save Tournament-Wide Fixed Duration + Optional Apply & Lock
  const handleSaveFixedDuration = (applyAndLockMatches: boolean = false) => {
    if (!canGenerate) return;
    const validDuration = Math.max(10, Math.min(180, Number(fixedDurationDraft) || 60));
    const validBreak = Math.max(0, Math.min(30, Number(fixedBreakDraft) || 5));

    if (tournament) {
      const updatedTour: Tournament = {
        ...tournament,
        matchDurationMinutes: validDuration,
        breakDurationMinutes: validBreak,
        numberOfVenues: scheduleConfig.pitchesCount,
        scheduleConfig,
      };
      StorageService.saveTournament(updatedTour);
      if (onTournamentUpdate) onTournamentUpdate(updatedTour);
    }

    if (applyAndLockMatches && matches.length > 0) {
      const updatedMatches = ScheduleEngine.applyFixedTimeSchedule(
        matches,
        scheduleConfig.timeSlots,
        validDuration,
        validBreak,
        true
      );
      onMatchesUpdate(updatedMatches);
      StorageService.saveMatches(updatedMatches);
      StorageService.logAction(
        currentRole,
        currentRole,
        'TẠO & CỐ ĐỊNH THỜI GIAN THI ĐẤU TOÀN GIẢI',
        `${validDuration} phút (2×${Math.floor(validDuration / 2)}p) • Khung giờ: ${scheduleConfig.timeSlots.join(', ')}`,
        'Áp dụng khung giờ thi đấu cố định, thời lượng cố định và khóa lịch các trận chưa đấu.'
      );
      alert(
        `Đã tạo thời gian thi đấu cố định!\n• Thời lượng chuẩn: ${validDuration} phút (2 × ${Math.floor(validDuration / 2)}p, nghỉ ${validBreak}p)\n• Khung giờ cố định: ${scheduleConfig.timeSlots.join(', ')}\n• Đã khóa cố định thời gian các trận chưa đấu.`
      );
    } else {
      StorageService.logAction(
        currentRole,
        currentRole,
        'CẬP NHẬT THỜI LƯỢNG THI ĐẤU CỐ ĐỊNH',
        `${validDuration} phút (nghỉ ${validBreak}p)`,
        `Cập nhật thời lượng thi đấu cố định mặc định của giải thành ${validDuration} phút (2 × ${Math.floor(validDuration / 2)}p), nghỉ ${validBreak} phút.`
      );
      alert(`Đã lưu thời lượng thi đấu cố định mặc định của giải: ${validDuration} phút (2 × ${Math.floor(validDuration / 2)}p, nghỉ ${validBreak}p)!`);
    }
  };

  // Lock or Unlock all filtered matches
  const handleToggleLockAllFiltered = (lockState: boolean) => {
    if (!canGenerate || filteredMatches.length === 0) return;
    const ids = new Set(filteredMatches.map((m) => m.id));
    const updated = matches.map((m) => (ids.has(m.id) ? { ...m, isLocked: lockState } : m));
    onMatchesUpdate(updated);
    StorageService.saveMatches(updated);
    StorageService.logAction(
      currentRole,
      currentRole,
      lockState ? 'CỐ ĐỊNH LỊCH HÀNG LOẠT' : 'MỞ KHÓA LỊCH HÀNG LOẠT',
      `${filteredMatches.length} trận`,
      lockState
        ? `Đã khóa cố định ngày & giờ cho ${filteredMatches.length} trận đang lọc.`
        : `Đã mở khóa để cho phép tự động tối ưu lại ${filteredMatches.length} trận đang lọc.`
    );
  };

  // Save changes from Edit Modal
  const handleSaveMatchSchedule = () => {
    if (!editingMatch) return;
    const selectedVenue = venues.find((v) => v.id === editVenueId);
    const selectedRef = referees.find((r) => r.id === editRefereeId);
    const homeTeamChanged = editingMatch.homeTeamId !== editHomeTeamId;
    const awayTeamChanged = editingMatch.awayTeamId !== editAwayTeamId;
    const isCustom = editIsCustomMatchup || homeTeamChanged || awayTeamChanged;

    const updated = matches.map((m) => {
      if (m.id === editingMatch.id) {
        const nextMatch: Match = {
          ...m,
          homeTeamId: editHomeTeamId,
          awayTeamId: editAwayTeamId,
          isCustomMatchup: isCustom,
          isLocked: editIsLocked,
          date: editDate,
          time: editTime,
          venueId: editVenueId,
          venueName: selectedVenue?.name || m.venueName,
          refereeId: editRefereeId,
          refereeName: selectedRef?.name || m.refereeName,
          status: editStatus,
        };
        if (editUseCustomDuration) {
          nextMatch.durationMinutes = Math.max(10, Math.min(180, Number(editDurationMinutes) || 60));
          nextMatch.breakDurationMinutes = Math.max(0, Math.min(30, Number(editBreakDurationMinutes) || 5));
        } else {
          delete nextMatch.durationMinutes;
          delete nextMatch.breakDurationMinutes;
        }
        return nextMatch;
      }
      return m;
    });

    onMatchesUpdate(updated);
    StorageService.saveMatches(updated);

    const homeName = getTeam(editHomeTeamId)?.name || 'Chưa xác định';
    const awayName = getTeam(editAwayTeamId)?.name || 'Chưa xác định';
    const durDesc = editUseCustomDuration
      ? `${editDurationMinutes}p (nghỉ ${editBreakDurationMinutes}p)`
      : `Mặc định ${tournament?.matchDurationMinutes || 60}p`;

    StorageService.logAction(
      currentRole,
      currentRole,
      'CẬP NHẬT LỊCH & THỜI GIAN TRẬN ĐẤU',
      `Trận #${editingMatch.matchNumber} (${editingMatch.roundLabel})`,
      `Cập nhật [${homeName} VS ${awayName}] - Ngày ${editDate}, Giờ ${editTime}, Thời lượng: ${durDesc}, Sân ${selectedVenue?.name || editVenueId}`
    );
    setEditingMatch(null);
  };

  // Detect conflicts in real-time during manual match edit
  const conflictMatch = editingMatch
    ? matches.find(
        (m) =>
          m.id !== editingMatch.id &&
          m.date === editDate &&
          m.time === editTime &&
          m.venueId === editVenueId
      )
    : null;

  const getVenueDetails = (venueId?: string, venueNameFallback?: string) => {
    const v = venues.find((item) => item.id === venueId);
    const fullName = v?.name || venueNameFallback || 'Sân 1 - Cỏ Nhân Tạo Ký Túc Xá';
    const matchPitch = fullName.match(/Sân\s*\d+/i);
    const shortPitch = matchPitch ? matchPitch[0] : (fullName.split(' - ')[0] || 'Sân 1');
    return { fullName, shortPitch, location: v?.location || 'Khu phức hợp thể thao' };
  };

  // Lấy danh sách các ngày thi đấu thực tế và sắp xếp tăng dần
  const availableDates = Array.from(
    new Set(matches.map((m) => m.date).filter(Boolean))
  ).sort();

  // Lấy danh sách các ca thi đấu / khung giờ thực tế
  const availableTimeSlots = Array.from(
    new Set(matches.map((m) => m.time).filter(Boolean))
  ).sort();

  const formatDateHeader = (dateStr: string) => {
    if (!dateStr || dateStr === 'UNSCHEDULED') return 'Chưa xếp ngày thi đấu';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);
        const dateObj = new Date(year, month - 1, day);
        const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
        const dayName = days[dateObj.getDay()] || 'Ngày';
        return `${dayName}, ${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const availableRoundNumbers = Array.from(
    new Set(matches.map((m) => m.roundNumber).filter((n): n is number => typeof n === 'number' && n > 0))
  ).sort((a, b) => a - b);

  const filteredMatches = matches.filter((m) => {
    if (filterVenue !== 'ALL' && m.venueId !== filterVenue) return false;
    if (filterRound !== 'ALL' && m.round !== filterRound) return false;
    if (filterRoundNum !== 'ALL' && m.roundNumber !== filterRoundNum) return false;
    if (filterTeamId !== 'ALL' && m.homeTeamId !== filterTeamId && m.awayTeamId !== filterTeamId) return false;
    if (filterDate !== 'ALL' && m.date !== filterDate) return false;
    if (filterTimeSlot !== 'ALL' && m.time !== filterTimeSlot) return false;
    return true;
  });

  // Sắp xếp lịch thi đấu chuẩn xác theo thời gian (Ngày ➔ Giờ ➔ Sân)
  const sortedMatches = [...filteredMatches].sort((a, b) => {
    if (sortOrder === 'MATCH_NUM') {
      return (a.matchNumber || 0) - (b.matchNumber || 0);
    }
    if (sortOrder === 'TIME_DESC') {
      const dateComp = (b.date || '').localeCompare(a.date || '');
      if (dateComp !== 0) return dateComp;
      const timeComp = (b.time || '').localeCompare(a.time || '');
      if (timeComp !== 0) return timeComp;
      const pitchA = (a.venueName || '').match(/\d+/)?.[0] || '0';
      const pitchB = (b.venueName || '').match(/\d+/)?.[0] || '0';
      if (pitchA !== pitchB) return parseInt(pitchA, 10) - parseInt(pitchB, 10);
      return (b.matchNumber || 0) - (a.matchNumber || 0);
    }
    // Mặc định: TIME_ASC (Sắp xếp theo thời gian từ sớm nhất đến muộn nhất)
    const dateComp = (a.date || '').localeCompare(b.date || '');
    if (dateComp !== 0) return dateComp;
    const timeComp = (a.time || '').localeCompare(b.time || '');
    if (timeComp !== 0) return timeComp;
    const pitchA = (a.venueName || '').match(/\d+/)?.[0] || '0';
    const pitchB = (b.venueName || '').match(/\d+/)?.[0] || '0';
    if (pitchA !== pitchB) return parseInt(pitchA, 10) - parseInt(pitchB, 10);
    return (a.matchNumber || 0) - (b.matchNumber || 0);
  });

  // Reusable Match Card Renderer
  const renderMatchCard = (m: Match) => {
    const home = getTeam(m.homeTeamId);
    const away = getTeam(m.awayTeamId);
    const { fullName, shortPitch } = getVenueDetails(m.venueId, m.venueName);

    // Phân màu nổi bật cho từng Sân đấu để dễ nhận diện khi đá cùng giờ
    const pitchNum = shortPitch.match(/\d+/)?.[0] || '1';
    const pitchColorMap: Record<string, { badge: string; border: string; text: string }> = {
      '1': {
        badge: 'bg-sky-50 border-sky-300 text-sky-800',
        border: 'hover:border-sky-400',
        text: 'text-sky-600',
      },
      '2': {
        badge: 'bg-emerald-50 border-emerald-300 text-emerald-800',
        border: 'hover:border-emerald-400',
        text: 'text-emerald-600',
      },
      '3': {
        badge: 'bg-amber-50 border-amber-300 text-amber-800',
        border: 'hover:border-amber-400',
        text: 'text-amber-600',
      },
      '4': {
        badge: 'bg-purple-50 border-purple-300 text-purple-800',
        border: 'hover:border-purple-400',
        text: 'text-purple-600',
      },
    };
    const pitchStyle = pitchColorMap[pitchNum] || {
      badge: 'bg-slate-100 border-slate-200 text-slate-700',
      border: 'hover:border-blue-400',
      text: 'text-slate-600',
    };

    const homeName = home?.name || (m.round === 'GROUP' ? `Đội ${m.group || ''} (Chờ bốc thăm)` : 'Đội chờ xác định');
    const awayName = away?.name || (m.round === 'GROUP' ? `Đội ${m.group || ''} (Chờ bốc thăm)` : 'Đội chờ xác định');

    const isSwapSource = swapSourceMatchId === m.id;
    const hasStudentWarning = studentWarningMatchIds.has(m.id);

    return (
      <div
        key={m.id}
        onClick={() => onSelectMatch(m.id)}
        className={`bg-white border ${
          isSwapSource
            ? 'border-amber-500 ring-2 ring-amber-400/40'
            : swapSourceMatchId
            ? 'border-blue-300 border-dashed hover:border-amber-500'
            : 'border-slate-200'
        } ${pitchStyle.border} rounded-2xl p-4 shadow-xs transition-all cursor-pointer hover:shadow-md hover:border-blue-400 flex flex-col justify-between group text-slate-800`}
      >
        {/* Card Header: Match #, Round Label, Prominent PITCH BADGE & Match Status */}
        <div className="flex items-center justify-between text-[11px] pb-2.5 border-b border-slate-100 mb-3 gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded text-[10px] border border-slate-200">
              #{m.matchNumber || m.id}
            </span>
            <span className="font-extrabold text-blue-700">{m.roundLabel}</span>
            {/* SỐ SÂN THI ĐẤU NỔI BẬT THEO MÀU SÂN */}
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black tracking-wide border shadow-2xs ${pitchStyle.badge}`}>
              <MapPin className={`w-3 h-3 ${pitchStyle.text} shrink-0`} />
              <span>{shortPitch.toUpperCase()}</span>
            </span>
            {m.isLocked && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-bold" title="Trận đã khóa - giữ cố định khi tự tối ưu lại lịch">
                <Lock className="w-2.5 h-2.5" /> Khóa
              </span>
            )}
            {m.isForfeit && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold">
                Xử thua 0-3
              </span>
            )}
            {hasStudentWarning && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-50 border border-amber-300 text-amber-800 text-[10px] font-bold" title="Trùng giờ học / lịch bận sinh viên của 1 trong 2 đội">
                <GraduationCap className="w-2.5 h-2.5" /> Trùng lịch SV
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {m.status === 'LIVE' && (
              <span className="flex items-center gap-1 font-bold text-red-700 animate-pulse text-[10px] bg-red-50 border border-red-200 px-2 py-0.5 rounded-lg">
                <Radio className="w-3 h-3 text-red-600" /> LIVE {m.currentMinute}&apos;
              </span>
            )}
            {m.status === 'FINISHED' && (
              <span className="text-emerald-700 font-bold text-[10px] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
                KẾT THÚC
              </span>
            )}
            {m.status === 'SCHEDULED' && (
              <span className="text-slate-700 font-mono text-[10px] bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-500" /> {m.time}
              </span>
            )}
          </div>
        </div>

        {/* Match Teams & Score */}
        <div className="space-y-2.5 py-1">
          {/* Home */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 truncate">
              {home ? (
                <span
                  className="w-3.5 h-3.5 rounded-full border shadow-2xs flex-shrink-0"
                  style={{ backgroundColor: home.primaryColor, borderColor: home.secondaryColor }}
                ></span>
              ) : (
                <span className="w-3.5 h-3.5 rounded-full bg-slate-300 border border-slate-400 flex-shrink-0"></span>
              )}
              <span className={`text-xs font-bold truncate transition-colors ${home ? 'text-slate-900 group-hover:text-blue-700' : 'text-slate-500 italic'}`}>
                {homeName}
              </span>
            </div>

            <span className="font-mono font-black text-sm text-slate-900">
              {m.status === 'FINISHED' || m.status === 'LIVE' ? m.homeScore : '-'}
            </span>
          </div>

          {/* Away */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 truncate">
              {away ? (
                <span
                  className="w-3.5 h-3.5 rounded-full border shadow-2xs flex-shrink-0"
                  style={{ backgroundColor: away.primaryColor, borderColor: away.secondaryColor }}
                ></span>
              ) : (
                <span className="w-3.5 h-3.5 rounded-full bg-slate-300 border border-slate-400 flex-shrink-0"></span>
              )}
              <span className={`text-xs font-bold truncate transition-colors ${away ? 'text-slate-900 group-hover:text-blue-700' : 'text-slate-500 italic'}`}>
                {awayName}
              </span>
            </div>

            <span className="font-mono font-black text-sm text-slate-900">
              {m.status === 'FINISHED' || m.status === 'LIVE' ? m.awayScore : '-'}
            </span>
          </div>
        </div>

        {/* Penalty shootout if applicable */}
        {m.penaltyShootout && (
          <div className="my-2 p-1.5 bg-amber-50 border border-amber-200 rounded-lg text-[10px] text-amber-800 text-center font-bold">
            Luân lưu 6m: {m.penaltyShootout.homeScore} - {m.penaltyShootout.awayScore}
          </div>
        )}

        {/* Card Footer: Detailed Pitch / Venue & Synchronized Date/Time */}
        <div className="pt-2.5 border-t border-slate-100 mt-3 flex items-center justify-between text-[11px] gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 truncate max-w-[190px]" title={fullName}>
            <MapPin className={`w-3.5 h-3.5 ${pitchStyle.text} shrink-0`} />
            <span className="truncate font-semibold text-slate-600 group-hover:text-slate-900 transition-colors">{fullName}</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
              <Calendar className="w-3 h-3 text-slate-500" />
              <span>{m.date}</span>
              <Clock className="w-3 h-3 text-blue-600 ml-1" />
              <span className="font-bold text-blue-700">{m.time}</span>
            </div>
            <span
              className={`font-mono text-[10px] px-1.5 py-0.5 rounded border font-bold ${
                m.durationMinutes
                  ? 'bg-amber-50 border-amber-300 text-amber-800'
                  : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
              title={
                m.durationMinutes
                  ? 'Thời lượng tùy chỉnh riêng cho trận này'
                  : 'Thời lượng cố định mặc định của giải'
              }
            >
              ⏱ {m.durationMinutes || tournament?.matchDurationMinutes || (isSingleLeague ? 60 : 40)}p
            </span>

            {canGenerate && (
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => handleToggleLockMatch(e, m.id)}
                  className={`p-1 rounded-lg border text-[10px] font-bold transition-all ${
                    m.isLocked
                      ? 'bg-indigo-100 border-indigo-300 text-indigo-800'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-500'
                  }`}
                  title={m.isLocked ? 'Mở khóa trận đấu' : 'Khóa giờ/sân trận này để không bị xếp đè'}
                >
                  {m.isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                </button>
                <button
                  onClick={(e) => handleSwapMatchClick(e, m.id)}
                  className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold flex items-center gap-1 transition-all active:scale-95 ${
                    isSwapSource
                      ? 'bg-amber-500 border-amber-600 text-white'
                      : swapSourceMatchId
                      ? 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-800 animate-pulse'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                  }`}
                  title={swapSourceMatchId ? 'Đổi ca/sân với trận đang chọn' : 'Hoán đổi ca/sân với trận khác'}
                >
                  <ArrowLeftRight className="w-3 h-3" />
                  <span>{isSwapSource ? 'Hủy đổi' : swapSourceMatchId ? 'Đổi vào đây' : 'Đổi ca'}</span>
                </button>
                <button
                  onClick={(e) => handleOpenEditMatch(e, m)}
                  className="px-2 py-0.5 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 hover:text-blue-800 text-[10px] font-bold flex items-center gap-1 transition-all active:scale-95 shadow-2xs"
                  title="Chỉnh sửa ngày, giờ bắt đầu, thời lượng & sân thi đấu của trận này"
                >
                  <Edit3 className="w-3 h-3 text-blue-600" />
                  <span>Sửa Giờ/Lịch</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 text-slate-800">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2.5 py-0.5 rounded-full border border-blue-200">
              {isSingleLeague
                ? `LỊCH VÒNG TRÒN 1 LƯỢT • ${matches.length || Math.floor((teams.length * Math.max(0, teams.length - 1)) / 2)} TRẬN`
                : 'LỊCH THI ĐẤU TRỌN GÓI 1 NGÀY • 32 TRẬN'}
            </span>
            <span className="text-xs text-slate-500">
              {isSingleLeague
                ? `${teams.length || tournament?.maxTeams || 12} Đội • ${scheduleConfig.pitchesCount} Sân × ${scheduleConfig.slotsPerDay} Ca/Ngày • ${tournament?.matchDurationMinutes || 60} Phút (${Math.floor((tournament?.matchDurationMinutes || 60) / 2)}p×2)`
                : '16 Đội • 4 Bảng • 4 Sân'}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">
            {isSingleLeague
              ? 'Lịch Thi Đấu & Tối Ưu Thời Khóa Biểu Sinh Viên'
              : canGenerate
              ? 'Điều Hành Lịch Đấu 1 Ngày (06:30 – 17:35)'
              : 'Lịch Thi Đấu & Kết Quả (06:30 – 17:35)'}
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            {isSingleLeague
              ? `1 tuần 1–2 ngày (${scheduleConfig.matchDaysOfWeek.map((d) => WEEKDAY_OPTIONS.find((w) => w.val === d)?.label || '').filter(Boolean).join(', ')}), thuê ${scheduleConfig.pitchesCount} sân đá ${scheduleConfig.slotsPerDay} ca/sân (${scheduleConfig.timeSlots.join(' & ')}). Dự kiến ${studentAnalysis.totalMatchDays || 11} ngày thi đấu.`
              : '06:30 – 10:30: 24 trận vòng bảng (6 ca x 4 sân) • 10:30 – 15:00: Nghỉ trưa & tổng hợp BXH • 15:00 – 17:35: Tứ kết, Bán kết, Tranh hạng 3 & Chung kết.'}
          </p>
        </div>

        {/* Schedule Generator & Conflict Status */}
        <div className="flex flex-wrap items-center gap-2">
          {canGenerate && (
            <button
              type="button"
              onClick={() => setShowConflictDetails(!showConflictDetails)}
              className={`flex items-center gap-1.5 text-xs border px-3 py-1.5 rounded-xl font-bold transition-all ${
                validationResult.valid && studentAnalysis.studentWarnings.length === 0
                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                  : validationResult.valid
                  ? 'text-amber-800 bg-amber-50 border-amber-200 hover:bg-amber-100'
                  : 'text-red-700 bg-red-50 border-red-200 hover:bg-red-100'
              }`}
              title="Nhấn để xem chi tiết xung đột & trùng lịch sinh viên"
            >
              {validationResult.valid ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600" />
              )}
              <span>
                {validationResult.valid
                  ? studentAnalysis.studentWarnings.length > 0
                    ? `0 Xung đột cứng • ${studentAnalysis.studentWarnings.length} Cảnh báo lịch SV`
                    : '0 Xung Đột Sân/Giờ'
                  : `${validationResult.conflicts.length} Xung Đột`}
              </span>
            </button>
          )}

          {canGenerate && isSingleLeague && (
            <>
              <button
                type="button"
                onClick={() => setShowStudentPanel(!showStudentPanel)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border font-bold text-xs shadow-2xs transition-all active:scale-95 ${
                  showStudentPanel
                    ? 'bg-indigo-600 border-indigo-700 text-white'
                    : 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-800'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Thời Gian Cố Định &amp; Lịch SV</span>
              </button>

              <button
                type="button"
                onClick={handleReoptimizeRemaining}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-800 font-bold text-xs shadow-2xs transition-all active:scale-95"
                title="Giữ các trận đã khóa / đã đá, tự động xếp lại các trận còn lại tránh giờ học & ngày thi sinh viên"
              >
                <Zap className="w-3.5 h-3.5 text-sky-600" />
                <span>Tối Ưu Phần Còn Lại</span>
              </button>

              <button
                type="button"
                onClick={handleAutoGenerate}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Tạo Lịch {Math.floor((teams.length * Math.max(0, teams.length - 1)) / 2) || 66} Trận</span>
              </button>
            </>
          )}

          {canGenerate && !isSingleLeague && (
            <>
              <button
                onClick={handleSyncAllSchedule}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-800 font-bold text-xs shadow-2xs transition-all active:scale-95"
                title="Tự động đồng bộ toàn bộ ngày và giờ 32 trận đấu theo lịch 1 ngày (06:30 - 17:35)"
              >
                <Zap className="w-3.5 h-3.5 text-sky-600" />
                <span>Đồng Bộ Giờ 1 Ngày</span>
              </button>

              <button
                onClick={handleAutoGenerate}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Tự Động Tạo Lịch 32 Trận</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Interactive Swap Mode Banner */}
      {swapSourceMatchId && (() => {
        const src = matches.find((m) => m.id === swapSourceMatchId);
        return (
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900 shadow-xs">
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-amber-600" />
              <span>
                Đang chọn <strong>Trận #{src?.matchNumber} ({src?.date} • {src?.time})</strong> để hoán đổi ca/ngày/sân. Hãy nhấn nút <strong>&quot;Đổi vào đây&quot;</strong> trên 1 trận bất kỳ khác.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSwapSourceMatchId(null)}
              className="px-3 py-1 rounded-lg bg-white border border-amber-300 font-bold text-amber-800 hover:bg-amber-100"
            >
              Hủy Hoán Đổi
            </button>
          </div>
        );
      })()}

      {/* Detailed Conflict & Student Warning Drawer */}
      {showConflictDetails && (validationResult.conflicts.length > 0 || studentAnalysis.studentWarnings.length > 0) && (
        <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 space-y-2.5 text-xs text-slate-800">
          <div className="flex items-center justify-between">
            <span className="font-black text-amber-900 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Chi Tiết Rà Soát Xung Đột Sân/Giờ &amp; Lịch Học Sinh Viên
            </span>
            <button onClick={() => setShowConflictDetails(false)} className="text-slate-500 hover:text-slate-800">
              <X className="w-4 h-4" />
            </button>
          </div>
          {validationResult.conflicts.map((c, idx) => (
            <div key={`hc-${idx}`} className="p-2 rounded-xl bg-red-50 border border-red-200 text-red-800 font-semibold">
              ❌ {c}
            </div>
          ))}
          {studentAnalysis.studentWarnings.map((w, idx) => (
            <div key={`sw-${idx}`} className="p-2 rounded-xl bg-white border border-amber-200 text-amber-900 flex flex-wrap items-center justify-between gap-2">
              <span>
                🎓 <strong>Trận #{w.matchNumber} ({w.date} {w.time})</strong> — Đội <strong>{w.teamName}</strong>: {w.reason}
              </span>
              {canGenerate && (
                <button
                  type="button"
                  onClick={() => setSwapSourceMatchId(w.matchId)}
                  className="px-2 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-[11px]"
                >
                  Đổi ca trận này
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Student-Friendly Schedule Optimizer Configurator */}
      {canGenerate && isSingleLeague && showStudentPanel && (
        <div className="bg-white border border-indigo-200 rounded-3xl p-5 shadow-xs space-y-5 text-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900">
                  Tinh Chỉnh Lịch Thi Đấu Phù Hợp Sinh Viên (3 Sân × 2 Trận/Ngày)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Chọn 1–2 ngày rảnh mỗi tuần, khung giờ không kẹt tiết học, ngày nghỉ thi &amp; lịch bận riêng từng đội lớp.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowStudentPanel(false)}
              className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Row 1: Match Days of Week + Pitches + Slots */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="font-bold text-slate-800 block">1. Chọn ngày tổ chức mỗi tuần (1–2 ngày/tuần):</span>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAY_OPTIONS.map((wd) => {
                  const active = scheduleConfig.matchDaysOfWeek.includes(wd.val);
                  return (
                    <button
                      key={wd.val}
                      type="button"
                      onClick={() => {
                        const cur = scheduleConfig.matchDaysOfWeek;
                        const next = active
                          ? cur.length > 1
                            ? cur.filter((x) => x !== wd.val)
                            : cur
                          : [...cur, wd.val];
                        updateScheduleConfig({ ...scheduleConfig, matchDaysOfWeek: next });
                      }}
                      className={`px-2.5 py-1.5 rounded-xl font-bold border transition-all ${
                        active
                          ? 'bg-blue-600 border-blue-700 text-white shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {wd.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-500">
                Gợi ý sinh viên: chọn <strong>Thứ 7 &amp; Chủ Nhật</strong> (hoặc 1 ngày CN/tuần).
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="font-bold text-slate-800 block">2. Số sân thuê &amp; Số ca / sân / ngày:</span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">Số sân thuê</label>
                  <select
                    value={scheduleConfig.pitchesCount}
                    onChange={(e) =>
                      updateScheduleConfig({ ...scheduleConfig, pitchesCount: Number(e.target.value) })
                    }
                    className="w-full bg-white border border-slate-200 rounded-xl p-2 font-bold text-blue-700"
                  >
                    <option value={2}>2 Sân</option>
                    <option value={3}>3 Sân (Kế hoạch CTUT)</option>
                    <option value={4}>4 Sân</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">Số trận/sân/ngày</label>
                  <select
                    value={scheduleConfig.slotsPerDay}
                    onChange={(e) => {
                      const nextSlotsCount = Number(e.target.value);
                      const slots = [...scheduleConfig.timeSlots];
                      while (slots.length < nextSlotsCount) slots.push('10:00');
                      updateScheduleConfig({
                        ...scheduleConfig,
                        slotsPerDay: nextSlotsCount,
                        timeSlots: slots.slice(0, nextSlotsCount),
                      });
                    }}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2 font-bold text-emerald-700"
                  >
                    <option value={1}>1 trận / sân / ngày</option>
                    <option value={2}>2 trận / sân / ngày</option>
                    <option value={3}>3 trận / sân / ngày</option>
                  </select>
                </div>
              </div>
              <p className="text-[11px] text-blue-800 font-semibold">
                Công suất: {scheduleConfig.pitchesCount * scheduleConfig.slotsPerDay} trận/ngày (= {scheduleConfig.pitchesCount} sân × {scheduleConfig.slotsPerDay} ca).
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
              <span className="font-bold text-slate-800 block">3. Tạo khung giờ thi đấu cố định:</span>
              <div className="flex flex-wrap gap-1.5">
                {STUDENT_SLOT_PRESETS.map((pr) => (
                  <button
                    key={pr.label}
                    type="button"
                    onClick={() =>
                      updateScheduleConfig({
                        ...scheduleConfig,
                        slotsPerDay: pr.slots.length,
                        timeSlots: pr.slots,
                      })
                    }
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                      JSON.stringify(scheduleConfig.timeSlots.slice(0, pr.slots.length)) === JSON.stringify(pr.slots)
                        ? 'bg-emerald-600 border-emerald-700 text-white'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {pr.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {scheduleConfig.timeSlots.slice(0, scheduleConfig.slotsPerDay).map((tVal, idx) => (
                  <div key={idx} className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-1.5 py-0.5">
                    <span className="text-[11px] font-bold text-slate-600">Ca {idx + 1}:</span>
                    <input
                      type="time"
                      value={tVal}
                      onChange={(e) => {
                        const nextSlots = [...scheduleConfig.timeSlots];
                        nextSlots[idx] = e.target.value;
                        updateScheduleConfig({ ...scheduleConfig, timeSlots: nextSlots });
                      }}
                      className="font-mono font-bold text-xs text-blue-700 focus:outline-none"
                    />
                    {scheduleConfig.slotsPerDay > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const activeSlots = scheduleConfig.timeSlots.slice(0, scheduleConfig.slotsPerDay).filter((_, i) => i !== idx);
                          updateScheduleConfig({
                            ...scheduleConfig,
                            slotsPerDay: Math.max(1, activeSlots.length),
                            timeSlots: activeSlots,
                          });
                        }}
                        className="text-rose-500 hover:text-rose-700 text-[11px] px-1"
                        title="Xóa khung giờ này"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {/* Thêm khung giờ cố định mới */}
              <div className="flex items-center gap-1.5 pt-1 border-t border-slate-200/70">
                <input
                  type="time"
                  value={newTimeSlotInput}
                  onChange={(e) => setNewTimeSlotInput(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-2 py-1 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newTimeSlotInput) return;
                    const current = scheduleConfig.timeSlots.slice(0, scheduleConfig.slotsPerDay);
                    if (!current.includes(newTimeSlotInput)) {
                      const next = [...current, newTimeSlotInput].sort();
                      updateScheduleConfig({
                        ...scheduleConfig,
                        slotsPerDay: next.length,
                        timeSlots: next,
                      });
                    }
                  }}
                  className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px]"
                >
                  + Thêm Ca Cố Định
                </button>
              </div>
            </div>
          </div>

          {/* Row 1.5: Tạo Thời Gian Thi Đấu Cố Định (Thời Lượng Trận + Ngày Thi Đấu Cố Định + Khóa Hàng Loạt) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-2.5">
              <span className="font-bold text-indigo-900 block">
                ⏱️ Tạo Thời Lượng Thi Đấu Cố Định Toàn Giải (Mỗi Trận):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[40, 50, 60, 70].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setFixedDurationDraft(mins)}
                    className={`px-2.5 py-1 rounded-lg font-bold border text-[11px] transition-all ${
                      fixedDurationDraft === mins
                        ? 'bg-indigo-600 border-indigo-700 text-white'
                        : 'bg-white border-indigo-200 text-indigo-800 hover:bg-indigo-100'
                    }`}
                  >
                    {mins}p (2×{Math.floor(mins / 2)}p)
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-600 block mb-1">Tổng thời lượng 1 trận (phút)</label>
                  <input
                    type="number"
                    min={10}
                    max={180}
                    value={fixedDurationDraft}
                    onChange={(e) => setFixedDurationDraft(Number(e.target.value))}
                    className="w-full bg-white border border-indigo-200 rounded-xl px-2.5 py-1.5 font-mono font-bold text-indigo-800"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-600 block mb-1">Nghỉ giữa hiệp (phút)</label>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={fixedBreakDraft}
                    onChange={(e) => setFixedBreakDraft(Number(e.target.value))}
                    className="w-full bg-white border border-indigo-200 rounded-xl px-2.5 py-1.5 font-mono font-bold text-indigo-800"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleSaveFixedDuration(false)}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-indigo-100 border border-indigo-300 text-indigo-800 font-bold text-[11px]"
                >
                  Lưu Thời Lượng Cố Định
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveFixedDuration(true)}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px]"
                >
                  🔒 Áp Dụng &amp; Cố Định Vào Các Trận Chưa Đá
                </button>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-2.5">
              <span className="font-bold text-emerald-900 block">
                📌 Danh Sách Ngày Thi Đấu Cố Định (Tùy chọn - ưu tiên xếp vào các ngày này):
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={newFixedDate}
                  onChange={(e) => setNewFixedDate(e.target.value)}
                  className="bg-white border border-emerald-300 rounded-xl px-2.5 py-1.5 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newFixedDate) return;
                    const prev = scheduleConfig.fixedDates || [];
                    if (!prev.includes(newFixedDate)) {
                      updateScheduleConfig({
                        ...scheduleConfig,
                        fixedDates: [...prev, newFixedDate].sort(),
                      });
                    }
                    setNewFixedDate('');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  + Thêm Ngày Cố Định
                </button>
                <div className="ml-auto flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleToggleLockAllFiltered(true)}
                    className="px-2.5 py-1.5 rounded-xl bg-white border border-indigo-300 text-indigo-700 font-bold text-[11px] hover:bg-indigo-50"
                    title="Khóa cố định ngày/giờ tất cả trận đang lọc"
                  >
                    🔒 Khóa Tất Cả
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleLockAllFiltered(false)}
                    className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-600 font-bold text-[11px] hover:bg-slate-100"
                    title="Mở khóa các trận đang lọc"
                  >
                    🔓 Mở Khóa
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(scheduleConfig.fixedDates || []).length === 0 ? (
                  <span className="text-[11px] text-slate-500 italic">
                    Chưa chọn ngày cố định riêng (hệ thống tự lấy theo Thứ đã chọn ở mục 1).
                  </span>
                ) : (
                  (scheduleConfig.fixedDates || []).map((fd) => (
                    <span
                      key={fd}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-emerald-300 font-mono font-bold text-emerald-900"
                    >
                      {fd}
                      <button
                        type="button"
                        onClick={() =>
                          updateScheduleConfig({
                            ...scheduleConfig,
                            fixedDates: (scheduleConfig.fixedDates || []).filter((x) => x !== fd),
                          })
                        }
                        className="text-red-500 hover:text-red-700 ml-1"
                      >
                        ✕
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Row 2: Excluded Dates (Exams/Holidays) + Per-Team Student Busy Constraints */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-2.5">
              <span className="font-bold text-amber-900 block">4. Ngày nghỉ lễ / Tuần thi tránh xếp lịch:</span>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={newExcludedDate}
                  onChange={(e) => setNewExcludedDate(e.target.value)}
                  className="bg-white border border-amber-300 rounded-xl px-2.5 py-1.5 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newExcludedDate) return;
                    if (!scheduleConfig.excludedDates.includes(newExcludedDate)) {
                      updateScheduleConfig({
                        ...scheduleConfig,
                        excludedDates: [...scheduleConfig.excludedDates, newExcludedDate].sort(),
                      });
                    }
                    setNewExcludedDate('');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold"
                >
                  + Tránh Ngày Này
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {scheduleConfig.excludedDates.length === 0 ? (
                  <span className="text-[11px] text-slate-500 italic">Chưa thêm ngày nghỉ/thi nào.</span>
                ) : (
                  scheduleConfig.excludedDates.map((d) => (
                    <span
                      key={d}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-amber-300 font-mono font-bold text-amber-900"
                    >
                      {d}
                      <button
                        type="button"
                        onClick={() =>
                          updateScheduleConfig({
                            ...scheduleConfig,
                            excludedDates: scheduleConfig.excludedDates.filter((x) => x !== d),
                          })
                        }
                        className="text-red-500 hover:text-red-700 ml-1"
                      >
                        ✕
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-sky-50/60 border border-sky-200 space-y-2.5">
              <span className="font-bold text-sky-900 block">5. Ràng buộc lịch học / bận riêng của từng đội:</span>
              {teams.length === 0 ? (
                <span className="text-[11px] text-slate-500 italic">Chưa có đội bóng nào để cấu hình.</span>
              ) : (() => {
                const targetTeamId = selectedConstraintTeamId || teams[0].id;
                const teamMap = scheduleConfig.teamBusySlots || {};
                const curConstraint: TeamBusyConstraint = teamMap[targetTeamId] || {};
                const updateTeamConstraint = (nextC: TeamBusyConstraint) => {
                  updateScheduleConfig({
                    ...scheduleConfig,
                    teamBusySlots: { ...teamMap, [targetTeamId]: nextC },
                  });
                };
                return (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={targetTeamId}
                        onChange={(e) => setSelectedConstraintTeamId(e.target.value)}
                        className="bg-white border border-sky-300 rounded-xl px-2.5 py-1.5 font-bold text-xs text-slate-900"
                      >
                        {teams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} ({t.class})
                          </option>
                        ))}
                      </select>
                      <select
                        value={curConstraint.preferredTimeSlot || ''}
                        onChange={(e) => updateTeamConstraint({ ...curConstraint, preferredTimeSlot: e.target.value || undefined })}
                        className="bg-white border border-sky-300 rounded-xl px-2 py-1.5 text-xs text-emerald-700 font-semibold"
                      >
                        <option value="">-- Không ưu tiên ca --</option>
                        {scheduleConfig.timeSlots.map((slot) => (
                          <option key={slot} value={slot}>
                            Ưu tiên ca {slot}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-[11px] text-slate-600 mr-1">Bận ngày thứ:</span>
                      {WEEKDAY_OPTIONS.map((wd) => {
                        const busy = (curConstraint.busyWeekdays || []).includes(wd.val);
                        return (
                          <button
                            key={wd.val}
                            type="button"
                            onClick={() => {
                              const prev = curConstraint.busyWeekdays || [];
                              const next = busy ? prev.filter((x) => x !== wd.val) : [...prev, wd.val];
                              updateTeamConstraint({ ...curConstraint, busyWeekdays: next });
                            }}
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                              busy
                                ? 'bg-red-500 border-red-600 text-white'
                                : 'bg-white border-slate-200 text-slate-600'
                            }`}
                          >
                            {wd.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] text-slate-600">Bận ca giờ:</span>
                      {scheduleConfig.timeSlots.map((slot) => {
                        const busy = (curConstraint.busyTimeSlots || []).includes(slot);
                        return (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => {
                              const prev = curConstraint.busyTimeSlots || [];
                              const next = busy ? prev.filter((x) => x !== slot) : [...prev, slot];
                              updateTeamConstraint({ ...curConstraint, busyTimeSlots: next });
                            }}
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold font-mono border ${
                              busy
                                ? 'bg-red-500 border-red-600 text-white'
                                : 'bg-white border-slate-200 text-slate-600'
                            }`}
                          >
                            {slot} {busy ? '(Bận)' : ''}
                          </button>
                        );
                      })}
                      <input
                        type="date"
                        value={newTeamBusyDate}
                        onChange={(e) => setNewTeamBusyDate(e.target.value)}
                        className="bg-white border border-sky-200 rounded-lg px-2 py-0.5 font-mono text-[11px]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!newTeamBusyDate) return;
                          const prev = curConstraint.busyDates || [];
                          if (!prev.includes(newTeamBusyDate)) {
                            updateTeamConstraint({ ...curConstraint, busyDates: [...prev, newTeamBusyDate].sort() });
                          }
                          setNewTeamBusyDate('');
                        }}
                        className="px-2 py-0.5 rounded-lg bg-sky-600 text-white font-bold text-[10px]"
                      >
                        + Ngày bận
                      </button>
                    </div>
                    {(curConstraint.busyDates || []).length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {(curConstraint.busyDates || []).map((bd) => (
                          <span key={bd} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-50 border border-red-200 text-red-800 text-[10px] font-mono font-bold">
                            Bận {bd}
                            <button
                              type="button"
                              onClick={() =>
                                updateTeamConstraint({
                                  ...curConstraint,
                                  busyDates: (curConstraint.busyDates || []).filter((x) => x !== bd),
                                })
                              }
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-600">
            <span>
              📅 Dự kiến tổng <strong>{studentAnalysis.totalMatchDays} ngày đấu</strong> • Ngày kết thúc dự kiến:{' '}
              <strong className="font-mono text-blue-700">{studentAnalysis.estimatedEndDate || 'Chưa tạo lịch'}</strong>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReoptimizeRemaining}
                className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs flex items-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Áp Dụng &amp; Tối Ưu Lịch Còn Lại</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stage & Round Selector Pills */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-2.5 shadow-xs text-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
            <CalendarDays className="w-4 h-4 text-blue-600" />
            <span>
              {isSingleLeague
                ? 'Chọn Nhanh Theo Vòng Đấu (Vòng Tròn 1 Lượt)'
                : 'Chọn Nhanh Giai Đoạn Thi Đấu (Lịch 1 Ngày • 4 Sân)'}
            </span>
          </div>
          {(filterRound !== 'ALL' || filterRoundNum !== 'ALL' || filterTeamId !== 'ALL' || filterTimeSlot !== 'ALL' || filterDate !== 'ALL') && (
            <button
              onClick={() => {
                setFilterRound('ALL');
                setFilterRoundNum('ALL');
                setFilterTeamId('ALL');
                setFilterTimeSlot('ALL');
                setFilterDate('ALL');
              }}
              className="text-[11px] text-blue-600 hover:text-blue-700 font-bold transition-colors flex items-center gap-1"
            >
              <span>← Xem toàn bộ {matches.length} trận</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-thin">
          <button
            onClick={() => {
              setFilterRound('ALL');
              setFilterRoundNum('ALL');
              setFilterTimeSlot('ALL');
              setFilterDate('ALL');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
              filterRound === 'ALL' && filterRoundNum === 'ALL' && filterTimeSlot === 'ALL' && filterDate === 'ALL'
                ? 'bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Tất Cả ({matches.length} Trận)</span>
          </button>

          {isSingleLeague ? (
            availableRoundNumbers.map((rn) => (
              <button
                key={rn}
                onClick={() => setFilterRoundNum(filterRoundNum === rn ? 'ALL' : rn)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
                  filterRoundNum === rn
                    ? 'bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-600 text-white shadow-md shadow-blue-500/20'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                }`}
              >
                Vòng {rn}
              </button>
            ))
          ) : (
            <>
              <button
                onClick={() => {
                  setFilterRound('GROUP');
                  setFilterTimeSlot('ALL');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
                  filterRound === 'GROUP'
                    ? 'bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-600 text-white shadow-md shadow-blue-500/20'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                }`}
              >
                <span>🌅 Vòng Bảng</span>
              </button>

              <button
                onClick={() => {
                  setFilterRound('QUARTER_FINAL');
                  setFilterTimeSlot('ALL');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
                  filterRound === 'QUARTER_FINAL'
                    ? 'bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-600 text-white shadow-md shadow-blue-500/20'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                }`}
              >
                <span>⚡ Tứ Kết</span>
              </button>

              <button
                onClick={() => {
                  setFilterRound('SEMI_FINAL');
                  setFilterTimeSlot('ALL');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
                  filterRound === 'SEMI_FINAL'
                    ? 'bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-600 text-white shadow-md shadow-blue-500/20'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                }`}
              >
                <span>🔥 Bán Kết</span>
              </button>

              <button
                onClick={() => {
                  setFilterRound('FINAL');
                  setFilterTimeSlot('ALL');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
                  filterRound === 'FINAL' || filterRound === 'THIRD_PLACE'
                    ? 'bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-600 text-white shadow-md shadow-blue-500/20'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                }`}
              >
                <span>🏆 Chung Kết &amp; Tranh 3</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filter & Sort Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 text-xs shadow-xs text-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-slate-700 font-bold uppercase tracking-wider">
            <Filter className="w-4 h-4 text-blue-600" />
            <span>Bộ Lọc &amp; Sắp Xếp Lịch Thi Đấu</span>
          </div>

          {/* View Mode Toggle: Grouped by date vs Flat Grid */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewLayout('GROUPED_BY_DATE')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewLayout === 'GROUPED_BY_DATE'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Nhóm các trận đấu theo từng ngày thi đấu"
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Theo Ngày</span>
            </button>
            <button
              onClick={() => setViewLayout('GRID')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewLayout === 'GRID'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Hiển thị toàn bộ dưới dạng lưới"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Dạng Lưới</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          {/* Quick Pitch Filter Chips */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 overflow-x-auto max-w-full">
            <button
              onClick={() => setFilterVenue('ALL')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all shrink-0 ${
                filterVenue === 'ALL'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tất Cả Sân
            </button>
            {venues.map((v) => {
              const short = v.name.match(/Sân\s*\d+/i)?.[0] || v.name.split(' - ')[0] || v.name;
              const isActive = filterVenue === v.id;
              return (
                <button
                  key={v.id}
                  onClick={() => setFilterVenue(v.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 shrink-0 ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <MapPin className="w-2.5 h-2.5" />
                  <span>{short}</span>
                </button>
              );
            })}
          </div>

          {/* Time Slot Filter Dropdown */}
          <div className="relative">
            <select
              value={filterTimeSlot}
              onChange={(e) => setFilterTimeSlot(e.target.value)}
              className="bg-slate-50 border border-slate-300 text-slate-800 rounded-xl px-3 py-1.5 font-medium cursor-pointer hover:border-blue-400 focus:outline-none focus:bg-white transition-colors"
            >
              <option value="ALL">⏰ Tất Cả Ca Đấu</option>
              {availableTimeSlots.map((time) => (
                <option key={time} value={time}>
                  ⏰ Ca {time}
                </option>
              ))}
            </select>
          </div>

          {/* Date Filter Dropdown */}
          <div className="relative">
            <select
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="bg-slate-50 border border-slate-300 text-slate-800 rounded-xl px-3 py-1.5 font-medium cursor-pointer hover:border-blue-400 focus:outline-none focus:bg-white transition-colors"
            >
              <option value="ALL">📅 Tất Cả Các Ngày</option>
              {availableDates.map((d) => (
                <option key={d} value={d}>
                  📅 {formatDateHeader(d)} ({d})
                </option>
              ))}
            </select>
          </div>

          {/* Team Filter Dropdown */}
          <div className="relative">
            <select
              value={filterTeamId}
              onChange={(e) => setFilterTeamId(e.target.value)}
              className="bg-slate-50 border border-slate-300 text-slate-800 rounded-xl px-3 py-1.5 font-medium cursor-pointer hover:border-blue-400 focus:outline-none focus:bg-white transition-colors"
            >
              <option value="ALL">⚽ Tất Cả Các Đội</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  ⚽ {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Round Filter Dropdown */}
          {!isSingleLeague && (
            <div className="relative">
              <select
                value={filterRound}
                onChange={(e) => setFilterRound(e.target.value)}
                className="bg-slate-50 border border-slate-300 text-slate-800 rounded-xl px-3 py-1.5 font-medium cursor-pointer hover:border-blue-400 focus:outline-none focus:bg-white transition-colors"
              >
                <option value="ALL">🏆 Tất Cả Vòng Đấu</option>
                <option value="GROUP">Vòng Bảng</option>
                <option value="QUARTER_FINAL">Vòng Tứ Kết</option>
                <option value="SEMI_FINAL">Vòng Bán Kết</option>
                <option value="THIRD_PLACE">Tranh Hạng 3</option>
                <option value="FINAL">Chung Kết</option>
              </select>
            </div>
          )}

          {/* Sort Order Selector */}
          <div className="relative flex items-center">
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'TIME_ASC' | 'TIME_DESC' | 'MATCH_NUM')}
              className="bg-slate-50 border border-slate-300 text-blue-700 font-bold rounded-xl px-3 py-1.5 cursor-pointer hover:border-blue-400 focus:outline-none focus:bg-white transition-colors"
            >
              <option value="TIME_ASC">⏱ Sắp Xếp: Giờ Sớm Đến Muộn (Mặc định)</option>
              <option value="TIME_DESC">⏱ Sắp Xếp: Giờ Muộn Đến Sớm</option>
              <option value="MATCH_NUM">🔢 Sắp Xếp: Số Trận Đấu (#1 - #{matches.length || 66})</option>
            </select>
          </div>

          {/* Active Filter Clear if filters applied */}
          {(filterVenue !== 'ALL' || filterRound !== 'ALL' || filterRoundNum !== 'ALL' || filterTeamId !== 'ALL' || filterDate !== 'ALL' || filterTimeSlot !== 'ALL' || sortOrder !== 'TIME_ASC') && (
            <button
              onClick={() => {
                setFilterVenue('ALL');
                setFilterRound('ALL');
                setFilterDate('ALL');
                setFilterTimeSlot('ALL');
                setSortOrder('TIME_ASC');
              }}
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 border border-slate-200 transition-colors"
              title="Đặt lại bộ lọc về mặc định"
            >
              <RefreshCw className="w-3 h-3 text-slate-500" />
              <span>Đặt lại</span>
            </button>
          )}
        </div>
      </div>

      {/* Matches Display: Grouped by Date or Flat Grid */}
      {sortedMatches.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center mx-auto">
            <Calendar className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Không tìm thấy trận đấu nào</h3>
          <p className="text-xs text-slate-600 max-w-sm mx-auto">
            Không có trận đấu nào phù hợp với bộ lọc ngày, vòng đấu hoặc sân đã chọn. Vui lòng thử chọn bộ lọc khác.
          </p>
          <button
            onClick={() => {
              setFilterVenue('ALL');
              setFilterRound('ALL');
              setFilterDate('ALL');
              setSortOrder('TIME_ASC');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold hover:bg-blue-100 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Đặt lại tất cả bộ lọc</span>
          </button>
        </div>
      ) : viewLayout === 'GROUPED_BY_DATE' ? (
        <div className="space-y-8">
          {Array.from(new Set(sortedMatches.map((m) => m.date || 'UNSCHEDULED'))).map((dateStr) => {
            const dayMatches = sortedMatches.filter((m) => (m.date || 'UNSCHEDULED') === dateStr);
            const timesInDay = Array.from(new Set(dayMatches.map((m) => m.time || 'TBD'))).sort();

            return (
              <div key={dateStr} className="space-y-5 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs text-slate-800">
                {/* Matchday Header Banner */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600">
                      <CalendarDays className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                        <span>{formatDateHeader(dateStr)}</span>
                        {dateStr !== 'UNSCHEDULED' && (
                          <span className="text-xs font-mono font-normal text-slate-500">
                            ({dateStr})
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
                        <span>Gồm {timesInDay.length} ca thi đấu:</span>
                        <span className="text-blue-700 font-semibold font-mono">
                          {timesInDay.map((t) => `Ca ${t}`).join(' • ')}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
                    {canGenerate && dateStr !== 'UNSCHEDULED' && (
                      <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 text-[11px]">
                        <span className="text-slate-600 font-semibold">Dời ngày:</span>
                        <input
                          type="date"
                          value={shiftTargets[dateStr] || dateStr}
                          onChange={(e) => setShiftTargets({ ...shiftTargets, [dateStr]: e.target.value })}
                          className="bg-white border border-slate-200 rounded-lg px-1.5 py-0.5 font-mono text-[11px]"
                        />
                        <button
                          type="button"
                          onClick={() => handleShiftDay(dateStr, shiftTargets[dateStr] || '')}
                          className="px-2 py-0.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold"
                        >
                          Dời
                        </button>
                      </div>
                    )}
                    <span className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-xl border border-blue-200">
                      {dayMatches.length} trận đấu trong ngày
                    </span>
                  </div>
                </div>

                {/* Ca Thi Đấu (Time Slots) trong 1 ngày */}
                <div className="space-y-6">
                  {timesInDay.map((slotTime) => {
                    const slotMatches = dayMatches
                      .filter((m) => (m.time || 'TBD') === slotTime)
                      .sort((a, b) => {
                        const pitchA = (a.venueName || '').match(/\d+/)?.[0] || '0';
                        const pitchB = (b.venueName || '').match(/\d+/)?.[0] || '0';
                        if (pitchA !== pitchB) return parseInt(pitchA, 10) - parseInt(pitchB, 10);
                        return (a.matchNumber || 0) - (b.matchNumber || 0);
                      });

                    const hourNum = parseInt(slotTime.split(':')[0] || '0', 10);
                    const isMorning = hourNum < 12;
                    const sessionLabel = isMorning ? 'BUỔI SÁNG' : hourNum < 18 ? 'BUỔI CHIỀU' : 'BUỔI TỐI';
                    const pitchesUsed = Array.from(
                      new Set(slotMatches.map((m) => getVenueDetails(m.venueId, m.venueName).shortPitch))
                    );

                    return (
                      <React.Fragment key={slotTime}>
                        {/* Mốc Nghỉ Trưa & Tổng Hợp BXH Vòng Bảng (Chỉ áp dụng cho thể thức 1 ngày GROUP_KNOCKOUT) */}
                        {!isSingleLeague && slotTime === '15:00' && (
                          <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/70 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs my-2">
                            <div className="flex items-center gap-3">
                              <div className="p-2.5 rounded-xl bg-amber-100 border border-amber-300 text-amber-700">
                                <Coffee className="w-5 h-5" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-black text-amber-900 uppercase tracking-wider">
                                    10:30 – 15:00 • NGHỈ TRƯA &amp; TỔNG HỢP KẾT QUẢ VÒNG BẢNG
                                  </span>
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                                    Khoảng nghỉ 4 giờ 30 phút
                                  </span>
                                </div>
                                <p className="text-xs text-slate-700 mt-0.5">
                                  BTC hoàn tất nhập điểm 24 trận vòng bảng, công bố BXH 4 bảng A-B-C-D, xác định 8 đội vào Tứ kết &amp; các đội phục hồi thể lực chuẩn bị cho loạt knock-out buổi chiều.
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-xs font-mono font-bold text-amber-800 bg-white px-3 py-1.5 rounded-xl border border-amber-200 self-start sm:self-center shrink-0">
                              <Timer className="w-4 h-4 text-amber-600" />
                              <span>Hoàn tất 24/24 trận vòng bảng</span>
                            </div>
                          </div>
                        )}

                        {/* Nghỉ 10 phút trước Bán Kết */}
                        {!isSingleLeague && slotTime === '15:55' && (
                          <div className="p-3.5 sm:p-4 rounded-2xl bg-sky-50/70 border border-sky-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs my-2">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-xl bg-sky-100 border border-sky-300 text-blue-700">
                                <Timer className="w-4 h-4" />
                              </div>
                              <div>
                                <span className="text-xs font-black text-blue-900 uppercase tracking-wider block">
                                  15:45 – 15:55 • NGHỈ 10 PHÚT, CHUẨN BỊ BÁN KẾT (2 SÂN)
                                </span>
                                <p className="text-[11px] text-slate-600 mt-0.5">
                                  Bán kết 1 (Thắng TK1 vs Thắng TK2 - Sân 1) &amp; Bán kết 2 (Thắng TK3 vs Thắng TK4 - Sân 2).
                                </p>
                              </div>
                            </div>
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-white text-blue-700 border border-blue-200 shrink-0 self-start sm:self-center">
                              Nghỉ 10 phút
                            </span>
                          </div>
                        )}

                        {/* Nghỉ 10 phút trước Chung Kết & Tranh 3 */}
                        {!isSingleLeague && slotTime === '16:50' && (
                          <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50/70 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs my-2">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-xl bg-amber-100 border border-amber-300 text-amber-800">
                                <Trophy className="w-4 h-4" />
                              </div>
                              <div>
                                <span className="text-xs font-black text-amber-900 uppercase tracking-wider block">
                                  16:40 – 16:50 • NGHỈ 10 PHÚT, CHUẨN BỊ TRANH HẠNG 3 &amp; CHUNG KẾT
                                </span>
                                <p className="text-[11px] text-slate-700 mt-0.5">
                                  🥉 Sân 1: Tranh Hạng 3 (Thua BK1 vs Thua BK2) • 🏆 Sân 2: CHUNG KẾT VÔ ĐỊCH (Thắng BK1 vs Thắng BK2).
                                </p>
                              </div>
                            </div>
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-white text-amber-800 border border-amber-200 shrink-0 self-start sm:self-center">
                              Trận cuối cùng
                            </span>
                          </div>
                        )}

                        <div className="space-y-3">
                          {/* Ca Thi Đấu Sub-Header Banner */}
                          <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-blue-50/90 via-sky-50/50 to-white border border-blue-200/80 shadow-2xs">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`p-1.5 rounded-lg ${
                                  isMorning
                                    ? 'bg-amber-100 text-amber-700 border border-amber-300'
                                    : 'bg-orange-100 text-orange-700 border border-orange-300'
                                }`}
                              >
                                {isMorning ? <Sun className="w-4 h-4" /> : <Sunset className="w-4 h-4" />}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-black text-slate-900 tracking-wide">
                                  CA {slotTime}
                                </span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white text-blue-700 border border-blue-200 shadow-2xs">
                                  {sessionLabel}
                                </span>
                              </div>
                              <span className="text-slate-400 hidden sm:inline">•</span>
                              <span className="text-[11px] text-slate-600 hidden sm:inline">
                                Thi đấu đồng thời trên:{' '}
                                <strong className="text-blue-700 font-bold">{pitchesUsed.join(', ')}</strong>
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-mono text-blue-800 bg-blue-100/70 px-2.5 py-0.5 rounded-md border border-blue-200 font-bold">
                                {slotMatches.length} trận cùng giờ
                              </span>
                            </div>
                          </div>

                          {/* Grid of Match Cards in this Ca */}
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {slotMatches.map((m) => renderMatchCard(m))}
                          </div>
                        </div>

                        {/* Mốc Lễ Bế Mạc & Trao Cúp Vô Địch (Sau Ca Chung Kết 16:50) */}
                        {!isSingleLeague && slotTime === '16:50' && (
                          <div className="p-4 sm:p-5 rounded-2xl border border-amber-200 bg-amber-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs mt-4">
                            <div className="flex items-center gap-3">
                              <div className="w-14 h-14 rounded-xl overflow-hidden border border-amber-300 shadow-xs shrink-0">
                                <img src="/images/trophy-cup.jpg" alt="Cúp Vô Địch" className="w-full h-full object-cover" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-black text-amber-900 uppercase tracking-wider">
                                    17:35 – 18:15 • LỄ BẾ MẠC &amp; TRAO CÚP VÔ ĐỊCH
                                  </span>
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white text-amber-800 border border-amber-200">
                                    Tổng kết giải
                                  </span>
                                </div>
                                <p className="text-xs text-slate-700 mt-0.5">
                                  Trao Cúp Vô địch, Huy chương Vàng - Bạc - Đồng, Cầu thủ xuất sắc nhất, Vua phá lưới &amp; Thủ môn xuất sắc nhất.
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-xs font-mono font-bold text-emerald-800 bg-white px-3 py-1.5 rounded-xl border border-emerald-200 self-start sm:self-center shrink-0">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              <span>Hoàn thành 32/32 trận trọn gói 1 ngày</span>
                            </div>
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedMatches.map((m) => renderMatchCard(m))}
        </div>
      )}

      {/* Edit Match Schedule Modal */}
      {editingMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200 text-slate-800">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Điều Chỉnh Giờ &amp; Sân Thi Đấu
                  </h3>
                  <p className="text-xs text-slate-500">
                    Trận #{editingMatch.matchNumber} • {editingMatch.roundLabel}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingMatch(null)}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Match Teams Selector (Hỗ trợ BTC tự do điều chỉnh đội đấu Tứ kết & các vòng) */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                  <Trophy className="w-3.5 h-3.5 text-amber-500" />
                  <span>Chọn 2 Đội Thi Đấu ({editingMatch.roundLabel})</span>
                </label>
                {editingMatch.round !== 'GROUP' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-600" />
                    <span>Tự do ghép cặp Knockout</span>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-2.5">
                {/* Home Team Selector */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Đội 1 (Đội Chủ Nhà)
                  </label>
                  <select
                    value={editHomeTeamId}
                    onChange={(e) => {
                      setEditHomeTeamId(e.target.value);
                      setEditIsCustomMatchup(true);
                    }}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-bold focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">-- Chưa xác định / Chờ kết quả --</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.shortName || (t.group ? `Bảng ${t.group}` : '')})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Swap Teams Button */}
                <div className="flex justify-center pt-2 sm:pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      const temp = editHomeTeamId;
                      setEditHomeTeamId(editAwayTeamId);
                      setEditAwayTeamId(temp);
                      setEditIsCustomMatchup(true);
                    }}
                    className="p-2 rounded-xl bg-slate-200 hover:bg-blue-600 text-slate-700 hover:text-white transition-all shadow-xs active:scale-95"
                    title="Đổi vị trí 2 đội bóng"
                  >
                    <ArrowLeftRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Away Team Selector */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Đội 2 (Đội Khách)
                  </label>
                  <select
                    value={editAwayTeamId}
                    onChange={(e) => {
                      setEditAwayTeamId(e.target.value);
                      setEditIsCustomMatchup(true);
                    }}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 font-bold focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">-- Chưa xác định / Chờ kết quả --</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.shortName || (t.group ? `Bảng ${t.group}` : '')})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Trợ giúp & nút khôi phục ghép cặp tự động theo BXH */}
              {editingMatch.round !== 'GROUP' && (
                <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <span className="text-slate-600">
                    💡 <strong className="text-slate-800">Tùy biến:</strong> BTC có thể chọn bất kỳ cặp đấu nào (Ví dụ: bốc thăm phân cặp giữa các đội Nhất và Nhì bảng).
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const autoBracket = KnockoutEngine.generateOrUpdateBracket(teams, [
                        { ...editingMatch, isCustomMatchup: false },
                      ]);
                      const m = autoBracket.find((x) => x.id === editingMatch.id);
                      if (m) {
                        setEditHomeTeamId(m.homeTeamId || '');
                        setEditAwayTeamId(m.awayTeamId || '');
                        setEditIsCustomMatchup(false);
                      }
                    }}
                    className="text-blue-600 hover:text-blue-800 underline font-semibold cursor-pointer"
                  >
                    Khôi phục ghép cặp tự động (theo BXH)
                  </button>
                </div>
              )}
            </div>

            {/* Form Fields */}
            <div className="space-y-3 text-xs">
              {/* Date Input */}
              <div>
                <label className="font-bold text-slate-700 block mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  <span>Ngày Thi Đấu</span>
                </label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-mono focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Time Input & Quick Slots */}
              <div>
                <label className="font-bold text-slate-700 block mb-1.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  <span>Giờ Thi Đấu</span>
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {(isSingleLeague
                    ? Array.from(new Set([...scheduleConfig.timeSlots, '07:00', '08:20', '15:30', '16:50', '17:30', '18:50']))
                    : ['06:30', '07:10', '07:50', '08:30', '09:10', '09:50', '15:00', '15:55', '16:50']
                  ).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setEditTime(preset)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold font-mono transition-all ${
                        editTime === preset
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <input
                  type="time"
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-mono focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Match Duration Setting (Riêng cho từng trận hoặc theo cố định toàn giải) */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <label className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Timer className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Thời Lượng Thi Đấu Của Trận Này</span>
                  </label>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setEditUseCustomDuration(false)}
                      className={`px-2.5 py-1 rounded-lg font-bold border ${
                        !editUseCustomDuration
                          ? 'bg-blue-600 border-blue-700 text-white'
                          : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      Mặc định ({tournament?.matchDurationMinutes || (isSingleLeague ? 60 : 40)}p)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditUseCustomDuration(true)}
                      className={`px-2.5 py-1 rounded-lg font-bold border ${
                        editUseCustomDuration
                          ? 'bg-indigo-600 border-indigo-700 text-white'
                          : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      Tùy chỉnh riêng trận này
                    </button>
                  </div>
                </div>

                {editUseCustomDuration && (
                  <div className="space-y-2 pt-1">
                    <div className="flex flex-wrap gap-1.5">
                      {[40, 50, 60, 70].map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => setEditDurationMinutes(mins)}
                          className={`px-2 py-1 rounded-lg text-[11px] font-bold border ${
                            editDurationMinutes === mins
                              ? 'bg-indigo-600 border-indigo-700 text-white'
                              : 'bg-white border-slate-200 text-slate-700'
                          }`}
                        >
                          {mins}p (2×{Math.floor(mins / 2)}p)
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-600 block mb-1">
                          Tổng phút thi đấu (2 × {Math.floor((editDurationMinutes || 60) / 2)}p)
                        </label>
                        <input
                          type="number"
                          min={10}
                          max={180}
                          value={editDurationMinutes}
                          onChange={(e) => setEditDurationMinutes(Number(e.target.value))}
                          className="w-full bg-white border border-slate-300 rounded-xl p-2 font-mono font-bold text-xs text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-600 block mb-1">
                          Nghỉ giữa hiệp (phút)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={30}
                          value={editBreakDurationMinutes}
                          onChange={(e) => setEditBreakDurationMinutes(Number(e.target.value))}
                          className="w-full bg-white border border-slate-300 rounded-xl p-2 font-mono font-bold text-xs text-slate-900"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Venue Selection */}
              <div>
                <label className="font-bold text-slate-700 block mb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-blue-600" />
                  <span>Sân Thi Đấu</span>
                </label>
                <select
                  value={editVenueId}
                  onChange={(e) => setEditVenueId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 focus:border-blue-500 focus:outline-none"
                >
                  {venues.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.location})
                    </option>
                  ))}
                </select>
              </div>

              {/* Referee Selection */}
              <div>
                <label className="font-bold text-slate-700 block mb-1.5">
                  Trọng Tài Phụ Trách
                </label>
                <select
                  value={editRefereeId}
                  onChange={(e) => setEditRefereeId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 focus:border-blue-500 focus:outline-none"
                >
                  {referees.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Match Status */}
              <div>
                <label className="font-bold text-slate-700 block mb-1.5">
                  Trạng Thái Trận
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as MatchStatus)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 focus:border-blue-500 focus:outline-none"
                >
                  <option value="SCHEDULED">Chưa Bắt Đầu (SCHEDULED)</option>
                  <option value="LIVE">Đang Diễn Ra (LIVE)</option>
                  <option value="FINISHED">Đã Kết Thúc (FINISHED)</option>
                </select>
              </div>

              {/* Lock Match Toggle */}
              <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editIsLocked}
                  onChange={(e) => setEditIsLocked(e.target.checked)}
                  className="text-indigo-600 rounded"
                />
                <span className="font-bold text-indigo-900 text-xs">
                  🔒 Khóa lịch trận này (giữ nguyên khi bấm Tối Ưu Lịch Còn Lại)
                </span>
              </label>
            </div>

            {/* Conflict Warning Alert */}
            {conflictMatch && (
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-bold">Cảnh báo trùng sân &amp; giờ:</div>
                  <div className="text-[11px] text-amber-800">
                    Sân này lúc <strong>{editTime}</strong> ngày <strong>{editDate}</strong> đã được xếp cho <strong>Trận #{conflictMatch.matchNumber} ({conflictMatch.roundLabel})</strong>!
                  </div>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setEditingMatch(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveMatchSchedule}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all active:scale-95"
              >
                Lưu Thay Đổi
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

