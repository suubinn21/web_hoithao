// ITFTMS 2026 - Schedule Generator & Student-Friendly Optimizer Engine
// Hỗ trợ 2 thể thức:
// 1) SINGLE_LEAGUE (CTUT CNTT 2026): 12 đội, vòng tròn 1 lượt (66 trận, 11 vòng x 6 trận).
//    Dự kiến 1 tuần tổ chức 1-2 ngày, thuê 3 sân đá 2 trận/sân/ngày (= 6 trận/ngày = 1 vòng/ngày),
//    mỗi trận 2 hiệp x 30 phút + 5 phút nghỉ giữa hiệp (không bù giờ), tự sắp xếp & tinh chỉnh theo lịch sinh viên.
// 2) GROUP_KNOCKOUT: 16 đội, 4 bảng, 4 sân + Knockout.

import {
  Team,
  Venue,
  Referee,
  Match,
  MatchRound,
  Tournament,
  StudentScheduleConfig,
} from '@/types';

export const DEFAULT_STUDENT_SCHEDULE_CONFIG: StudentScheduleConfig = {
  matchDaysOfWeek: [6, 0], // Thứ 7 & Chủ Nhật (1-2 ngày/tuần)
  pitchesCount: 3,         // Thuê 3 sân
  slotsPerDay: 2,          // Mỗi sân đá 2 trận -> 6 trận/ngày (= 1 vòng 12 đội)
  timeSlots: ['07:00', '08:20'], // 2 hiệp x 30p + 5p nghỉ = 65p + 15p chuẩn bị
  excludedDates: [],
  fixedDates: [],
  teamBusySlots: {},
};

export const addDaysToDate = (startDateStr: string, days: number): string => {
  if (!startDateStr || !startDateStr.includes('-')) return startDateStr || '2026-10-18';
  const parts = startDateStr.split('-').map(Number);
  const year = parts[0];
  const month = parts[1] - 1;
  const day = parts[2];
  const d = new Date(year, month, day + days);
  const yStr = d.getFullYear();
  const mStr = String(d.getMonth() + 1).padStart(2, '0');
  const dStr = String(d.getDate()).padStart(2, '0');
  return `${yStr}-${mStr}-${dStr}`;
};

export const getWeekdayOfDate = (dateStr: string): number => {
  if (!dateStr || !dateStr.includes('-')) return 0;
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getDay(); // 0=CN..6=T7
};

export const migrateMatchTimesTo7AM = (matches: Match[]): { matches: Match[]; migrated: boolean } => {
  return { matches, migrated: false };
};

export interface StudentConflictDetail {
  matchId: string;
  matchNumber: number;
  roundLabel: string;
  date: string;
  time: string;
  teamId: string;
  teamName: string;
  reason: string;
  severity: 'HARD' | 'STUDENT';
}

export interface StudentScheduleAnalysis {
  valid: boolean;
  hardConflicts: string[];
  studentWarnings: StudentConflictDetail[];
  teamStats: {
    teamId: string;
    teamName: string;
    totalMatches: number;
    slotCounts: Record<string, number>;
    pitchCounts: Record<string, number>;
    studentConflictCount: number;
  }[];
  estimatedEndDate: string;
  totalMatchDays: number;
}

export class ScheduleEngine {
  /**
   * Lấy danh sách các ngày thi đấu hợp lệ liên tiếp bắt đầu từ startDate,
   * chỉ chọn các thứ trong matchDaysOfWeek và bỏ qua các ngày nghỉ/thi excludedDates.
   */
  static generateCandidateDates(
    startDate: string,
    neededDays: number,
    config: StudentScheduleConfig
  ): string[] {
    const allowedDays =
      config.matchDaysOfWeek && config.matchDaysOfWeek.length > 0
        ? config.matchDaysOfWeek
        : [0];
    const excludedSet = new Set(config.excludedDates || []);
    const dates: string[] = [];

    // Nếu BTC có cấu hình danh sách ngày thi đấu cố định, ưu tiên dùng trước theo thứ tự thời gian
    const fixedList = Array.from(new Set((config.fixedDates || []).filter((d) => d && !excludedSet.has(d)))).sort();
    fixedList.forEach((d) => {
      if (dates.length < neededDays) {
        dates.push(d);
      }
    });

    const scanStart = dates.length > 0 ? addDaysToDate(dates[dates.length - 1], 1) : startDate;
    let offset = 0;
    // Bảo vệ tối đa 365 ngày để tránh vòng lặp vô hạn
    while (dates.length < neededDays && offset < 365) {
      const candidate = addDaysToDate(scanStart, offset);
      const weekday = getWeekdayOfDate(candidate);
      if (allowedDays.includes(weekday) && !excludedSet.has(candidate) && !dates.includes(candidate)) {
        dates.push(candidate);
      }
      offset++;
    }
    return dates;
  }

  /**
   * Tạo các vòng đấu Vòng Tròn 1 Lượt theo thuật toán Circle Method (Berger).
   * Với 12 đội -> 11 vòng, mỗi vòng đúng 6 trận, tổng 66 trận không trùng cặp,
   * không đội nào phải đá 2 trận trong cùng 1 vòng.
   */
  static generateRoundRobinPairs(teams: Team[]): {
    roundNumber: number;
    home: Team;
    away: Team;
  }[][] {
    const activeTeams = teams.filter((t) => t.status !== 'WITHDRAWN' && t.status !== 'DISQUALIFIED');
    if (activeTeams.length < 2) {
      throw new Error('Cần tối thiểu 02 đội bóng để lập lịch thi đấu vòng tròn.');
    }

    const list: (Team | null)[] = [...activeTeams];
    if (list.length % 2 === 1) {
      list.push(null); // BYE nếu số đội lẻ
    }

    const n = list.length;
    const totalRounds = n - 1;
    const half = n / 2;
    const rotating = list.slice(1);
    const fixed = list[0];

    const rounds: { roundNumber: number; home: Team; away: Team }[][] = [];

    for (let r = 0; r < totalRounds; r++) {
      const currentOrder = [fixed, ...rotating];
      const roundMatches: { roundNumber: number; home: Team; away: Team }[] = [];

      for (let i = 0; i < half; i++) {
        const t1 = currentOrder[i];
        const t2 = currentOrder[n - 1 - i];
        if (!t1 || !t2) continue;

        // Cân bằng sân nhà / sân khách (áo chính/phụ) qua từng vòng
        const flip = i === 0 ? r % 2 === 1 : (r + i) % 2 === 1;
        roundMatches.push({
          roundNumber: r + 1,
          home: flip ? t2 : t1,
          away: flip ? t1 : t2,
        });
      }

      rounds.push(roundMatches);

      // Xoay vòng clockwise cho vòng kế tiếp
      const last = rotating.pop()!;
      rotating.unshift(last);
    }

    return rounds;
  }

  /**
   * Tính điểm phạt ràng buộc lịch sinh viên cho 1 cặp đấu khi xếp vào (date, timeSlot).
   * Điểm càng thấp = càng phù hợp với lịch học sinh viên & công bằng giờ giấc.
   */
  private static scorePairAtSlot(
    homeId: string,
    awayId: string,
    dateStr: string,
    timeSlot: string,
    config: StudentScheduleConfig,
    teamSlotHistory: Map<string, Record<string, number>>
  ): number {
    let penalty = 0;
    const weekday = getWeekdayOfDate(dateStr);
    const busyMap = config.teamBusySlots || {};

    [homeId, awayId].forEach((tid) => {
      const c = busyMap[tid];
      if (c) {
        if (c.busyDates?.includes(dateStr)) penalty += 500;
        if (c.busyWeekdays?.includes(weekday)) penalty += 250;
        if (c.busyTimeSlots?.includes(timeSlot)) penalty += 180;
        if (c.preferredTimeSlot && c.preferredTimeSlot === timeSlot) penalty -= 25;
      }

      // Cân bằng số lần đá ca sớm / ca muộn cho từng đội
      const hist = teamSlotHistory.get(tid) || {};
      const countAtThisSlot = hist[timeSlot] || 0;
      penalty += countAtThisSlot * 12;
    });

    return penalty;
  }

  /**
   * TỰ ĐỘNG XẾP LỊCH VÒNG TRÒN 1 LƯỢT TỐI ƯU THEO LỊCH SINH VIÊN
   * - Mặc định: 3 sân x 2 trận/ngày = 6 trận/ngày = 1 vòng/ngày.
   * - Tự tránh các ngày nghỉ/thi (excludedDates) & ngày bận học của từng đội (teamBusySlots).
   * - Cân bằng giờ thi đấu (Ca 1 vs Ca 2) và phân bổ sân (Sân 1, 2, 3) đều cho 12 đội.
   */
  static generateStudentLeagueSchedule(
    teams: Team[],
    venues: Venue[],
    referees: Referee[],
    tournament: Partial<Tournament>
  ): Match[] {
    const cfg: StudentScheduleConfig = {
      ...DEFAULT_STUDENT_SCHEDULE_CONFIG,
      ...(tournament.scheduleConfig || {}),
      pitchesCount:
        tournament.scheduleConfig?.pitchesCount ||
        tournament.numberOfVenues ||
        DEFAULT_STUDENT_SCHEDULE_CONFIG.pitchesCount,
    };

    const pitchesCount = Math.max(1, Math.min(6, cfg.pitchesCount || 3));
    const slotsPerDay = Math.max(1, Math.min(6, cfg.slotsPerDay || 2));
    const timeSlots =
      cfg.timeSlots && cfg.timeSlots.length >= slotsPerDay
        ? cfg.timeSlots.slice(0, slotsPerDay)
        : Array.from({ length: slotsPerDay }, (_, idx) => {
            const baseMin = 7 * 60 + idx * ((tournament.matchDurationMinutes || 60) + (tournament.breakDurationMinutes || 5) + 15);
            const h = Math.floor(baseMin / 60);
            const m = baseMin % 60;
            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          });

    const activeVenues = venues.filter((v) => v.status !== 'MAINTENANCE');
    const poolVenues = activeVenues.length > 0 ? activeVenues : venues;
    if (poolVenues.length === 0) {
      throw new Error('Không có sân bóng nào khả dụng để lập lịch thi đấu.');
    }

    const usedVenues: Venue[] = Array.from({ length: pitchesCount }, (_, idx) => {
      return poolVenues[idx % poolVenues.length];
    });

    const availableReferees = referees.filter((r) => r.status !== 'INACTIVE');
    const rounds = this.generateRoundRobinPairs(teams);
    const totalMatches = rounds.reduce((sum, r) => sum + r.length, 0);
    const capacityPerDay = pitchesCount * slotsPerDay;

    // Xây dựng các slot ngày -> ca -> sân
    const neededDays = Math.ceil(totalMatches / capacityPerDay) + 6; // dư ngày dự phòng trường hợp tách vòng
    const startDate = tournament.startDate || '2026-10-18';
    const candidateDates = this.generateCandidateDates(startDate, neededDays, cfg);
    if (candidateDates.length === 0) {
      throw new Error('Không tìm được ngày thi đấu hợp lệ. Hãy kiểm tra lại ngày trong tuần và danh sách ngày né.');
    }

    // Tạo danh sách các ngày với slots (date, time, venue)
    // Nếu capacityPerDay >= matchesPerRound (VD: 3 sân x 2 ca = 6 trận = 1 vòng), ta sắp xếp cả vòng vào cùng 1 ngày tốt nhất!
    const teamSlotHistory = new Map<string, Record<string, number>>();
    const teamPitchHistory = new Map<string, Record<string, number>>();
    const teamUsedDates = new Map<string, Set<string>>();

    const recordUsage = (tid: string, dateStr: string, timeStr: string, venueId: string) => {
      if (!teamSlotHistory.has(tid)) teamSlotHistory.set(tid, {});
      const sMap = teamSlotHistory.get(tid)!;
      sMap[timeStr] = (sMap[timeStr] || 0) + 1;

      if (!teamPitchHistory.has(tid)) teamPitchHistory.set(tid, {});
      const pMap = teamPitchHistory.get(tid)!;
      pMap[venueId] = (pMap[venueId] || 0) + 1;

      if (!teamUsedDates.has(tid)) teamUsedDates.set(tid, new Set());
      teamUsedDates.get(tid)!.add(dateStr);
    };

    // Chấm điểm từng vòng đấu ứng với từng ngày để chọn ngày phù hợp nhất cho vòng đó
    const remainingRounds = [...rounds];
    const generatedMatches: Match[] = [];
    let matchCounter = 1;

    // Duyệt từng ngày thi đấu hợp lệ
    let dateIdx = 0;
    const pendingPool: { roundNumber: number; home: Team; away: Team }[] = [];

    // Nếu 1 ngày đủ chỗ cho 1 vòng (VD 6 trận/ngày cho 12 đội), ưu tiên xếp nguyên 1 vòng vào mỗi ngày,
    // và chọn trong các vòng còn lại vòng nào ít xung đột lịch sinh viên với ngày đó nhất!
    const matchesPerRound = rounds[0]?.length || 6;

    if (capacityPerDay >= matchesPerRound) {
      while (remainingRounds.length > 0 && dateIdx < candidateDates.length) {
        const dayStr = candidateDates[dateIdx++];
        const dayWeekday = getWeekdayOfDate(dayStr);

        // Tìm vòng đấu ít cấn lịch sinh viên nhất cho ngày dayStr
        let bestRoundIdx = 0;
        let bestRoundPenalty = Infinity;

        remainingRounds.forEach((rnd, idx) => {
          let rPenalty = 0;
          rnd.forEach((pair) => {
            const c1 = cfg.teamBusySlots?.[pair.home.id];
            const c2 = cfg.teamBusySlots?.[pair.away.id];
            if (c1?.busyDates?.includes(dayStr)) rPenalty += 500;
            if (c2?.busyDates?.includes(dayStr)) rPenalty += 500;
            if (c1?.busyWeekdays?.includes(dayWeekday)) rPenalty += 200;
            if (c2?.busyWeekdays?.includes(dayWeekday)) rPenalty += 200;
          });
          if (rPenalty < bestRoundPenalty) {
            bestRoundPenalty = rPenalty;
            bestRoundIdx = idx;
          }
        });

        const chosenRound = remainingRounds.splice(bestRoundIdx, 1)[0];

        // Tạo tất cả slot (timeSlot, venue) trong ngày dayStr (VD: 2 ca x 3 sân = 6 slot)
        const daySlots: { time: string; venue: Venue; venueIdx: number }[] = [];
        for (let s = 0; s < slotsPerDay; s++) {
          for (let p = 0; p < pitchesCount; p++) {
            daySlots.push({ time: timeSlots[s], venue: usedVenues[p], venueIdx: p });
          }
        }

        // Ghép tối ưu 6 trận của vòng vào 6 slot (Ca 1/Ca 2, Sân 1/2/3)
        // Bảo đảm mỗi đội chỉ đá tối đa 1 trận trong ngày (tự động đúng vì 1 vòng mỗi đội chỉ xuất hiện 1 lần!)
        const pairsToPlace = [...chosenRound];
        const placedInDay: {
          pair: { roundNumber: number; home: Team; away: Team };
          slot: { time: string; venue: Venue; venueIdx: number };
        }[] = [];

        // Greedy best-slot assignment
        for (const slot of daySlots) {
          if (pairsToPlace.length === 0) break;
          let bestIdx = 0;
          let bestScore = Infinity;

          pairsToPlace.forEach((pair, pIdx) => {
            let sc = this.scorePairAtSlot(
              pair.home.id,
              pair.away.id,
              dayStr,
              slot.time,
              cfg,
              teamSlotHistory
            );
            // Cân bằng sân
            const pHome = teamPitchHistory.get(pair.home.id)?.[slot.venue.id] || 0;
            const pAway = teamPitchHistory.get(pair.away.id)?.[slot.venue.id] || 0;
            sc += (pHome + pAway) * 5;

            if (sc < bestScore) {
              bestScore = sc;
              bestIdx = pIdx;
            }
          });

          const picked = pairsToPlace.splice(bestIdx, 1)[0];
          placedInDay.push({ pair: picked, slot });
          recordUsage(picked.home.id, dayStr, slot.time, slot.venue.id);
          recordUsage(picked.away.id, dayStr, slot.time, slot.venue.id);
        }

        // Chuyển thành Match objects
        placedInDay.forEach(({ pair, slot }) => {
          const ref =
            availableReferees.length > 0
              ? availableReferees[(matchCounter - 1) % availableReferees.length]
              : { id: `REF0${(slot.venueIdx % 3) + 1}`, name: `Trọng tài Sân ${(slot.venueIdx % 3) + 1}` };

          generatedMatches.push({
            id: `M${String(matchCounter).padStart(2, '0')}`,
            matchNumber: matchCounter,
            round: 'GROUP',
            roundNumber: pair.roundNumber,
            group: 'A',
            roundLabel: `Vòng ${pair.roundNumber}`,
            venueId: slot.venue.id,
            venueName: slot.venue.name,
            date: dayStr,
            time: slot.time,
            homeTeamId: pair.home.id,
            awayTeamId: pair.away.id,
            refereeId: ref.id,
            refereeName: ref.name,
            homeScore: 0,
            awayScore: 0,
            status: 'SCHEDULED',
            currentMinute: 0,
            half: 1,
            events: [],
          });
          matchCounter++;
        });
      }
    } else {
      // Trường hợp đặc biệt BTC giảm số sân/số ca (VD < 6 trận/ngày):
      // Vẫn bảo đảm không đội nào đá 2 trận trong 1 ngày!
      rounds.forEach((r) => pendingPool.push(...r));
      while (pendingPool.length > 0 && dateIdx < candidateDates.length) {
        const dayStr = candidateDates[dateIdx++];
        const teamsPlayedToday = new Set<string>();

        for (let s = 0; s < slotsPerDay && pendingPool.length > 0; s++) {
          const slotTime = timeSlots[s];
          for (let p = 0; p < pitchesCount && pendingPool.length > 0; p++) {
            const venue = usedVenues[p];
            // Tìm trận có cả 2 đội chưa đá trong ngày hôm nay và điểm phạt nhỏ nhất
            let bestIdx = -1;
            let bestScore = Infinity;

            pendingPool.forEach((pair, idx) => {
              if (teamsPlayedToday.has(pair.home.id) || teamsPlayedToday.has(pair.away.id)) {
                return;
              }
              const sc = this.scorePairAtSlot(
                pair.home.id,
                pair.away.id,
                dayStr,
                slotTime,
                cfg,
                teamSlotHistory
              );
              if (sc < bestScore) {
                bestScore = sc;
                bestIdx = idx;
              }
            });

            if (bestIdx === -1) break;
            const picked = pendingPool.splice(bestIdx, 1)[0];
            teamsPlayedToday.add(picked.home.id);
            teamsPlayedToday.add(picked.away.id);
            recordUsage(picked.home.id, dayStr, slotTime, venue.id);
            recordUsage(picked.away.id, dayStr, slotTime, venue.id);

            const ref =
              availableReferees.length > 0
                ? availableReferees[(matchCounter - 1) % availableReferees.length]
                : { id: `REF0${(p % 3) + 1}`, name: `Trọng tài Sân ${(p % 3) + 1}` };

            generatedMatches.push({
              id: `M${String(matchCounter).padStart(2, '0')}`,
              matchNumber: matchCounter,
              round: 'GROUP',
              roundNumber: picked.roundNumber,
              group: 'A',
              roundLabel: `Vòng ${picked.roundNumber}`,
              venueId: venue.id,
              venueName: venue.name,
              date: dayStr,
              time: slotTime,
              homeTeamId: picked.home.id,
              awayTeamId: picked.away.id,
              refereeId: ref.id,
              refereeName: ref.name,
              homeScore: 0,
              awayScore: 0,
              status: 'SCHEDULED',
              currentMinute: 0,
              half: 1,
              events: [],
            });
            matchCounter++;
          }
        }
      }
    }

    // Đánh lại số thứ tự trận chuẩn theo thứ tự thời gian
    return this.renumberMatchesChronologically(generatedMatches);
  }

  /**
   * Tái sắp xếp CHỈ các trận chưa đá & chưa khóa (SCHEDULED & !isLocked),
   * giữ nguyên 100% các trận đã đá (FINISHED), đang đá (LIVE/HALFTIME) hoặc bị BTC khóa (isLocked).
   */
  static reoptimizeRemainingMatches(
    existingMatches: Match[],
    teams: Team[],
    venues: Venue[],
    referees: Referee[],
    tournament: Partial<Tournament>,
    reScheduleStartDate?: string
  ): Match[] {
    const cfg: StudentScheduleConfig = {
      ...DEFAULT_STUDENT_SCHEDULE_CONFIG,
      ...(tournament.scheduleConfig || {}),
      pitchesCount:
        tournament.scheduleConfig?.pitchesCount ||
        tournament.numberOfVenues ||
        DEFAULT_STUDENT_SCHEDULE_CONFIG.pitchesCount,
    };

    const pitchesCount = Math.max(1, Math.min(6, cfg.pitchesCount || 3));
    const slotsPerDay = Math.max(1, Math.min(6, cfg.slotsPerDay || 2));
    const timeSlots =
      cfg.timeSlots && cfg.timeSlots.length >= slotsPerDay
        ? cfg.timeSlots.slice(0, slotsPerDay)
        : DEFAULT_STUDENT_SCHEDULE_CONFIG.timeSlots.slice(0, slotsPerDay);

    const activeVenues = venues.filter((v) => v.status !== 'MAINTENANCE');
    const poolVenues = activeVenues.length > 0 ? activeVenues : venues;
    const usedVenues = Array.from({ length: pitchesCount }, (_, idx) => poolVenues[idx % poolVenues.length]);

    const lockedMatches = existingMatches.filter(
      (m) => m.status !== 'SCHEDULED' || m.isLocked
    );
    const unlockedMatches = existingMatches.filter(
      (m) => m.status === 'SCHEDULED' && !m.isLocked
    );

    if (unlockedMatches.length === 0) return existingMatches;

    // Theo dõi lịch sử slot đã dùng từ các trận khóa/đã đá
    const occupiedVenueSlots = new Set<string>();
    const occupiedTeamDates = new Map<string, Set<string>>();
    const teamSlotHistory = new Map<string, Record<string, number>>();

    let maxLockedDate = tournament.startDate || '2026-10-18';
    lockedMatches.forEach((m) => {
      occupiedVenueSlots.add(`${m.date}|${m.time}|${m.venueId}`);
      if (m.date && m.date > maxLockedDate) maxLockedDate = m.date;
      [m.homeTeamId, m.awayTeamId].forEach((tid) => {
        if (!tid) return;
        if (!occupiedTeamDates.has(tid)) occupiedTeamDates.set(tid, new Set());
        occupiedTeamDates.get(tid)!.add(m.date);
        if (!teamSlotHistory.has(tid)) teamSlotHistory.set(tid, {});
        const sMap = teamSlotHistory.get(tid)!;
        sMap[m.time] = (sMap[m.time] || 0) + 1;
      });
    });

    const effectiveStart = reScheduleStartDate || tournament.startDate || maxLockedDate;
    const neededDays = Math.ceil(unlockedMatches.length / (pitchesCount * slotsPerDay)) + 15;
    const candidateDates = this.generateCandidateDates(effectiveStart, neededDays, cfg);

    // Nhóm các trận chưa đá theo roundNumber để giữ nguyên tính đồng bộ từng vòng đấu
    const remaining = [...unlockedMatches].sort((a, b) => (a.roundNumber || 99) - (b.roundNumber || 99));
    const placedUnlocked: Match[] = [];

    for (const dayStr of candidateDates) {
      if (remaining.length === 0) break;

      for (let s = 0; s < slotsPerDay && remaining.length > 0; s++) {
        const slotTime = timeSlots[s];
        for (let p = 0; p < pitchesCount && remaining.length > 0; p++) {
          const venue = usedVenues[p];
          if (occupiedVenueSlots.has(`${dayStr}|${slotTime}|${venue.id}`)) {
            continue;
          }

          let bestIdx = -1;
          let bestScore = Infinity;

          remaining.forEach((m, idx) => {
            const hDates = occupiedTeamDates.get(m.homeTeamId);
            const aDates = occupiedTeamDates.get(m.awayTeamId);
            if (hDates?.has(dayStr) || aDates?.has(dayStr)) {
              return;
            }
            const sc = this.scorePairAtSlot(
              m.homeTeamId,
              m.awayTeamId,
              dayStr,
              slotTime,
              cfg,
              teamSlotHistory
            );
            // Ưu tiên giữ các trận có roundNumber nhỏ hơn trước
            const roundBias = (m.roundNumber || 1) * 3;
            if (sc + roundBias < bestScore) {
              bestScore = sc + roundBias;
              bestIdx = idx;
            }
          });

          if (bestIdx === -1) continue;
          const chosen = remaining.splice(bestIdx, 1)[0];

          occupiedVenueSlots.add(`${dayStr}|${slotTime}|${venue.id}`);
          [chosen.homeTeamId, chosen.awayTeamId].forEach((tid) => {
            if (!tid) return;
            if (!occupiedTeamDates.has(tid)) occupiedTeamDates.set(tid, new Set());
            occupiedTeamDates.get(tid)!.add(dayStr);
            if (!teamSlotHistory.has(tid)) teamSlotHistory.set(tid, {});
            const sMap = teamSlotHistory.get(tid)!;
            sMap[slotTime] = (sMap[slotTime] || 0) + 1;
          });

          placedUnlocked.push({
            ...chosen,
            date: dayStr,
            time: slotTime,
            venueId: venue.id,
            venueName: venue.name,
          });
        }
      }
    }

    // Nếu vẫn còn sót trận chưa tìm được ngày (hiếm), giữ nguyên vị trí cũ để không mất dữ liệu
    const merged = [...lockedMatches, ...placedUnlocked, ...remaining];
    return this.renumberMatchesChronologically(merged);
  }

  /**
   * Đánh lại số thứ tự trận đấu theo Ngày -> Giờ -> Sân
   */
  static renumberMatchesChronologically(matches: Match[]): Match[] {
    const sorted = [...matches].sort((a, b) => {
      const d = (a.date || '').localeCompare(b.date || '');
      if (d !== 0) return d;
      const t = (a.time || '').localeCompare(b.time || '');
      if (t !== 0) return t;
      const pA = parseInt((a.venueName || '').match(/\d+/)?.[0] || '0', 10);
      const pB = parseInt((b.venueName || '').match(/\d+/)?.[0] || '0', 10);
      return pA - pB;
    });
    return sorted.map((m, idx) => ({
      ...m,
      matchNumber: idx + 1,
    }));
  }

  /**
   * Hoán đổi ngày, giờ và sân thi đấu giữa 2 trận đấu (dùng khi BTC tinh chỉnh lịch)
   */
  static swapMatchSlots(matches: Match[], matchIdA: string, matchIdB: string): Match[] {
    const mA = matches.find((m) => m.id === matchIdA);
    const mB = matches.find((m) => m.id === matchIdB);
    if (!mA || !mB || matchIdA === matchIdB) return matches;

    const updated = matches.map((m) => {
      if (m.id === matchIdA) {
        return {
          ...m,
          date: mB.date,
          time: mB.time,
          venueId: mB.venueId,
          venueName: mB.venueName,
        };
      }
      if (m.id === matchIdB) {
        return {
          ...m,
          date: mA.date,
          time: mA.time,
          venueId: mA.venueId,
          venueName: mA.venueName,
        };
      }
      return m;
    });

    return this.renumberMatchesChronologically(updated);
  }

  /**
   * Dời toàn bộ các trận của 1 ngày thi đấu sang 1 ngày mới (VD: dời ngày mưa / ngày thi)
   */
  static shiftMatchDay(matches: Match[], fromDate: string, toDate: string): Match[] {
    if (!fromDate || !toDate || fromDate === toDate) return matches;
    const updated = matches.map((m) => {
      if (m.date === fromDate && m.status === 'SCHEDULED' && !m.isLocked) {
        return { ...m, date: toDate };
      }
      return m;
    });
    return this.renumberMatchesChronologically(updated);
  }

  /**
   * Áp dụng khung giờ thi đấu cố định & thời lượng trận cố định đồng loạt cho các trận chưa đá (chừa trận đã khóa nếu không ép ghi đè).
   */
  static applyFixedTimeSchedule(
    matches: Match[],
    timeSlots: string[],
    durationMinutes?: number,
    breakDurationMinutes?: number,
    lockAfterApply: boolean = false
  ): Match[] {
    const cleanSlots = (timeSlots || []).filter(Boolean);
    const byDate = new Map<string, Match[]>();
    matches.forEach((m) => {
      const d = m.date || 'UNSCHEDULED';
      if (!byDate.has(d)) byDate.set(d, []);
      byDate.get(d)!.push(m);
    });

    const updated = matches.map((m) => {
      if (m.status !== 'SCHEDULED') return m;
      let nextTime = m.time;
      if (cleanSlots.length > 0 && !m.isLocked) {
        const sameDayMatches = (byDate.get(m.date || 'UNSCHEDULED') || [])
          .filter((x) => x.venueId === m.venueId)
          .sort((a, b) => (a.time || '').localeCompare(b.time || '') || (a.matchNumber || 0) - (b.matchNumber || 0));
        const slotIdx = sameDayMatches.findIndex((x) => x.id === m.id);
        if (slotIdx >= 0) {
          nextTime = cleanSlots[slotIdx % cleanSlots.length];
        }
      }

      return {
        ...m,
        time: nextTime,
        ...(durationMinutes && !m.isLocked ? { durationMinutes } : {}),
        ...(typeof breakDurationMinutes === 'number' && !m.isLocked ? { breakDurationMinutes } : {}),
        isLocked: lockAfterApply ? true : m.isLocked,
      };
    });

    return this.renumberMatchesChronologically(updated);
  }

  /**
   * Phân tích toàn diện xung đột sân/giờ & mức độ phù hợp lịch sinh viên
   */
  static analyzeScheduleForStudents(
    matches: Match[],
    teams: Team[],
    config?: StudentScheduleConfig
  ): StudentScheduleAnalysis {
    const hardConflicts: string[] = [];
    const studentWarnings: StudentConflictDetail[] = [];
    const excludedSet = new Set(config?.excludedDates || []);
    const busyMap = config?.teamBusySlots || {};
    const teamById = new Map(teams.map((t) => [t.id, t]));

    // 1. Kiểm tra trùng sân/giờ & trùng đội cùng giờ hoặc cùng ngày
    for (let i = 0; i < matches.length; i++) {
      const m1 = matches[i];
      for (let j = i + 1; j < matches.length; j++) {
        const m2 = matches[j];
        if (m1.date === m2.date && m1.time === m2.time) {
          if (m1.venueId === m2.venueId) {
            hardConflicts.push(
              `Trùng sân ${m1.venueName || m1.venueId} lúc ${m1.time} ngày ${m1.date}: Trận #${m1.matchNumber} & #${m2.matchNumber}`
            );
          }
          const shared = [m1.homeTeamId, m1.awayTeamId].filter(
            (id) => id && (id === m2.homeTeamId || id === m2.awayTeamId)
          );
          if (shared.length > 0) {
            const tName = teamById.get(shared[0])?.name || shared[0];
            hardConflicts.push(
              `Đội ${tName} đá trùng giờ ${m1.time} ngày ${m1.date} (Trận #${m1.matchNumber} & #${m2.matchNumber})`
            );
          }
        } else if (m1.date === m2.date) {
          const sharedSameDay = [m1.homeTeamId, m1.awayTeamId].filter(
            (id) => id && (id === m2.homeTeamId || id === m2.awayTeamId)
          );
          if (sharedSameDay.length > 0) {
            const tName = teamById.get(sharedSameDay[0])?.name || sharedSameDay[0];
            studentWarnings.push({
              matchId: m2.id,
              matchNumber: m2.matchNumber,
              roundLabel: m2.roundLabel,
              date: m2.date,
              time: m2.time,
              teamId: sharedSameDay[0],
              teamName: tName,
              reason: `Đội ${tName} đá 2 trận trong cùng ngày ${m2.date} (Trận #${m1.matchNumber} & #${m2.matchNumber})`,
              severity: 'STUDENT',
            });
          }
        }
      }

      // 2. Kiểm tra ngày nghỉ toàn trường & lịch bận từng đội sinh viên
      if (excludedSet.has(m1.date)) {
        studentWarnings.push({
          matchId: m1.id,
          matchNumber: m1.matchNumber,
          roundLabel: m1.roundLabel,
          date: m1.date,
          time: m1.time,
          teamId: m1.homeTeamId,
          teamName: 'Toàn giải',
          reason: `Trận #${m1.matchNumber} đang nằm vào ngày nghỉ / thi cần né (${m1.date})`,
          severity: 'STUDENT',
        });
      }

      const wd = getWeekdayOfDate(m1.date);
      [m1.homeTeamId, m1.awayTeamId].forEach((tid) => {
        if (!tid) return;
        const c = busyMap[tid];
        if (!c) return;
        const tName = teamById.get(tid)?.name || tid;
        const reasons: string[] = [];
        if (c.busyDates?.includes(m1.date)) reasons.push(`bận ngày ${m1.date}`);
        if (c.busyWeekdays?.includes(wd)) reasons.push(`trùng lịch học thứ bận`);
        if (c.busyTimeSlots?.includes(m1.time)) reasons.push(`trùng ca bận ${m1.time}`);

        if (reasons.length > 0) {
          studentWarnings.push({
            matchId: m1.id,
            matchNumber: m1.matchNumber,
            roundLabel: m1.roundLabel,
            date: m1.date,
            time: m1.time,
            teamId: tid,
            teamName: tName,
            reason: `Đội ${tName}: ${reasons.join(', ')}${c.note ? ` (${c.note})` : ''}`,
            severity: 'STUDENT',
          });
        }
      });
    }

    // 3. Thống kê độ công bằng ca giờ & sân cho từng đội
    const teamStats = teams.map((t) => {
      const slotCounts: Record<string, number> = {};
      const pitchCounts: Record<string, number> = {};
      const myMatches = matches.filter((m) => m.homeTeamId === t.id || m.awayTeamId === t.id);
      myMatches.forEach((m) => {
        slotCounts[m.time] = (slotCounts[m.time] || 0) + 1;
        const pLabel = m.venueName?.match(/Sân\s*\d+/i)?.[0] || m.venueId;
        pitchCounts[pLabel] = (pitchCounts[pLabel] || 0) + 1;
      });
      const conflictCount = studentWarnings.filter((w) => w.teamId === t.id).length;
      return {
        teamId: t.id,
        teamName: t.name,
        totalMatches: myMatches.length,
        slotCounts,
        pitchCounts,
        studentConflictCount: conflictCount,
      };
    });

    const uniqueDates = Array.from(new Set(matches.map((m) => m.date).filter(Boolean))).sort();
    return {
      valid: hardConflicts.length === 0,
      hardConflicts,
      studentWarnings,
      teamStats,
      estimatedEndDate: uniqueDates[uniqueDates.length - 1] || '',
      totalMatchDays: uniqueDates.length,
    };
  }

  // ===========================================================================
  // CÁC HÀM CHO THỂ THỨC CŨ (GROUP_KNOCKOUT - 16 ĐỘI / 4 BẢNG / 4 SÂN)
  // ===========================================================================
  static generateGroupSchedule(
    teams: Team[],
    venues: Venue[],
    referees: Referee[],
    startDate: string = '2026-10-15'
  ): Match[] {
    const activeVenues = venues.filter((v) => v.status !== 'MAINTENANCE');
    const availableReferees = referees.filter((r) => r.status !== 'INACTIVE');
    if (activeVenues.length === 0) {
      throw new Error('Không có sân bóng khả dụng để lập lịch thi đấu.');
    }

    const v1 = activeVenues[0] || venues[0];
    const v2 = activeVenues[1] || activeVenues[0] || venues[1];
    const v3 = activeVenues[2] || activeVenues[0] || venues[2];
    const v4 = activeVenues[3] || activeVenues[0] || venues[3] || venues[0];
    const pitchVenues = [v1, v2, v3, v4];

    const groupTeamsA = teams.filter((t) => t.group === 'A');
    const groupTeamsB = teams.filter((t) => t.group === 'B');
    const groupTeamsC = teams.filter((t) => t.group === 'C');
    const groupTeamsD = teams.filter((t) => t.group === 'D');

    const getGroupTeam = (group: 'A' | 'B' | 'C' | 'D', idx: number): Team | undefined => {
      if (group === 'A') return groupTeamsA[idx];
      if (group === 'B') return groupTeamsB[idx];
      if (group === 'C') return groupTeamsC[idx];
      return groupTeamsD[idx];
    };

    const scheduleSlots: {
      time: string;
      venueIdx: number;
      group: 'A' | 'B' | 'C' | 'D';
      homeIdx: number;
      awayIdx: number;
      label: string;
    }[] = [
      { time: '06:30', venueIdx: 0, group: 'A', homeIdx: 0, awayIdx: 1, label: 'Bảng A - Lượt 1 (A1 - A2)' },
      { time: '06:30', venueIdx: 1, group: 'A', homeIdx: 2, awayIdx: 3, label: 'Bảng A - Lượt 1 (A3 - A4)' },
      { time: '06:30', venueIdx: 2, group: 'B', homeIdx: 0, awayIdx: 1, label: 'Bảng B - Lượt 1 (B1 - B2)' },
      { time: '06:30', venueIdx: 3, group: 'B', homeIdx: 2, awayIdx: 3, label: 'Bảng B - Lượt 1 (B3 - B4)' },
      { time: '07:10', venueIdx: 0, group: 'C', homeIdx: 0, awayIdx: 1, label: 'Bảng C - Lượt 1 (C1 - C2)' },
      { time: '07:10', venueIdx: 1, group: 'D', homeIdx: 0, awayIdx: 1, label: 'Bảng D - Lượt 1 (D1 - D2)' },
      { time: '07:10', venueIdx: 2, group: 'C', homeIdx: 2, awayIdx: 3, label: 'Bảng C - Lượt 1 (C3 - C4)' },
      { time: '07:10', venueIdx: 3, group: 'D', homeIdx: 2, awayIdx: 3, label: 'Bảng D - Lượt 1 (D3 - D4)' },
      { time: '07:50', venueIdx: 0, group: 'B', homeIdx: 0, awayIdx: 2, label: 'Bảng B - Lượt 2 (B1 - B3)' },
      { time: '07:50', venueIdx: 1, group: 'A', homeIdx: 0, awayIdx: 2, label: 'Bảng A - Lượt 2 (A1 - A3)' },
      { time: '07:50', venueIdx: 2, group: 'A', homeIdx: 1, awayIdx: 3, label: 'Bảng A - Lượt 2 (A2 - A4)' },
      { time: '07:50', venueIdx: 3, group: 'B', homeIdx: 1, awayIdx: 3, label: 'Bảng B - Lượt 2 (B2 - B4)' },
      { time: '08:30', venueIdx: 0, group: 'C', homeIdx: 0, awayIdx: 2, label: 'Bảng C - Lượt 2 (C1 - C3)' },
      { time: '08:30', venueIdx: 1, group: 'D', homeIdx: 0, awayIdx: 2, label: 'Bảng D - Lượt 2 (D1 - D3)' },
      { time: '08:30', venueIdx: 2, group: 'C', homeIdx: 1, awayIdx: 3, label: 'Bảng C - Lượt 2 (C2 - C4)' },
      { time: '08:30', venueIdx: 3, group: 'D', homeIdx: 1, awayIdx: 3, label: 'Bảng D - Lượt 2 (D2 - D4)' },
      { time: '09:10', venueIdx: 0, group: 'A', homeIdx: 0, awayIdx: 3, label: 'Bảng A - Lượt 3 (A1 - A4)' },
      { time: '09:10', venueIdx: 1, group: 'B', homeIdx: 1, awayIdx: 2, label: 'Bảng B - Lượt 3 (B2 - B3)' },
      { time: '09:10', venueIdx: 2, group: 'A', homeIdx: 1, awayIdx: 2, label: 'Bảng A - Lượt 3 (A2 - A3)' },
      { time: '09:10', venueIdx: 3, group: 'B', homeIdx: 0, awayIdx: 3, label: 'Bảng B - Lượt 3 (B1 - B4)' },
      { time: '09:50', venueIdx: 0, group: 'C', homeIdx: 0, awayIdx: 3, label: 'Bảng C - Lượt 3 (C1 - C4)' },
      { time: '09:50', venueIdx: 1, group: 'C', homeIdx: 1, awayIdx: 2, label: 'Bảng C - Lượt 3 (C2 - C3)' },
      { time: '09:50', venueIdx: 2, group: 'D', homeIdx: 0, awayIdx: 3, label: 'Bảng D - Lượt 3 (D1 - D4)' },
      { time: '09:50', venueIdx: 3, group: 'D', homeIdx: 1, awayIdx: 2, label: 'Bảng D - Lượt 3 (D2 - D3)' },
    ];

    return scheduleSlots.map((slot, index) => {
      const matchNumber = index + 1;
      const home = getGroupTeam(slot.group, slot.homeIdx);
      const away = getGroupTeam(slot.group, slot.awayIdx);
      const venue = pitchVenues[slot.venueIdx % pitchVenues.length];
      const referee = availableReferees.length > 0
        ? availableReferees[slot.venueIdx % availableReferees.length]
        : { id: `REF0${(slot.venueIdx % 4) + 1}`, name: `Trọng tài Sân ${(slot.venueIdx % 4) + 1}` };

      return {
        id: `M${String(matchNumber).padStart(2, '0')}`,
        matchNumber,
        round: 'GROUP',
        group: slot.group,
        roundLabel: slot.label,
        venueId: venue.id,
        venueName: venue.name,
        date: startDate,
        time: slot.time,
        homeTeamId: home?.id || '',
        awayTeamId: away?.id || '',
        refereeId: referee.id,
        refereeName: referee.name,
        homeScore: 0,
        awayScore: 0,
        status: 'SCHEDULED',
        currentMinute: 0,
        half: 1,
        events: [],
      };
    });
  }

  static generateKnockoutSchedule(
    venues: Venue[],
    referees: Referee[],
    startDate: string = '2026-10-15'
  ): Match[] {
    const v1 = venues[0] || { id: 'V01', name: 'Sân 1' };
    const v2 = venues[1] || v1;
    const v3 = venues[2] || v1;
    const v4 = venues[3] || v2;
    const availableReferees = referees.filter((r) => r.status !== 'INACTIVE');
    const ref1 = availableReferees[0] || { id: 'REF01', name: 'Trần Văn Hùng' };
    const ref2 = availableReferees[1] || ref1;
    const ref3 = availableReferees[2] || ref1;
    const ref4 = availableReferees[3] || ref2;

    const knockoutSlots: {
      id: string;
      matchNumber: number;
      round: MatchRound;
      label: string;
      time: string;
      venueId: string;
      venueName: string;
      referee: { id: string; name: string };
    }[] = [
      { id: 'M25', matchNumber: 25, round: 'QUARTER_FINAL', label: 'Tứ kết 1 (Nhất A vs Nhì B)', time: '15:00', venueId: v1.id, venueName: v1.name, referee: ref1 },
      { id: 'M26', matchNumber: 26, round: 'QUARTER_FINAL', label: 'Tứ kết 2 (Nhất B vs Nhì A)', time: '15:00', venueId: v2.id, venueName: v2.name, referee: ref2 },
      { id: 'M27', matchNumber: 27, round: 'QUARTER_FINAL', label: 'Tứ kết 3 (Nhất C vs Nhì D)', time: '15:00', venueId: v3.id, venueName: v3.name, referee: ref3 },
      { id: 'M28', matchNumber: 28, round: 'QUARTER_FINAL', label: 'Tứ kết 4 (Nhất D vs Nhì C)', time: '15:00', venueId: v4.id, venueName: v4.name, referee: ref4 },
      { id: 'M29', matchNumber: 29, round: 'SEMI_FINAL', label: 'Bán kết 1 (Thắng TK1 vs Thắng TK2)', time: '15:55', venueId: v1.id, venueName: v1.name, referee: ref1 },
      { id: 'M30', matchNumber: 30, round: 'SEMI_FINAL', label: 'Bán kết 2 (Thắng TK3 vs Thắng TK4)', time: '15:55', venueId: v2.id, venueName: v2.name, referee: ref2 },
      { id: 'M31', matchNumber: 31, round: 'THIRD_PLACE', label: 'Tranh Hạng 3 (Thua BK1 vs Thua BK2)', time: '16:50', venueId: v1.id, venueName: v1.name, referee: ref1 },
      { id: 'M32', matchNumber: 32, round: 'FINAL', label: 'CHUNG KẾT VÔ ĐỊCH (Thắng BK1 vs Thắng BK2)', time: '16:50', venueId: v2.id, venueName: v2.name, referee: ref2 },
    ];

    return knockoutSlots.map((k) => ({
      id: k.id,
      matchNumber: k.matchNumber,
      round: k.round,
      roundLabel: k.label,
      venueId: k.venueId,
      venueName: k.venueName,
      date: startDate,
      time: k.time,
      homeTeamId: '',
      awayTeamId: '',
      refereeId: k.referee.id,
      refereeName: k.referee.name,
      homeScore: 0,
      awayScore: 0,
      status: 'SCHEDULED' as const,
      currentMinute: 0,
      half: 1 as const,
      events: [],
    }));
  }

  static generateFullTournamentSchedule(
    teams: Team[],
    venues: Venue[],
    referees: Referee[],
    startDate: string = '2026-10-15'
  ): Match[] {
    const groups = this.generateGroupSchedule(teams, venues, referees, startDate);
    const knockouts = this.generateKnockoutSchedule(venues, referees, startDate);
    return [...groups, ...knockouts];
  }

  static synchronizeMatchTimes(
    existingMatches: Match[],
    teams: Team[],
    venues: Venue[],
    referees: Referee[],
    targetStartDate: string = '2026-10-15'
  ): Match[] {
    const templateMatches = this.generateFullTournamentSchedule(teams, venues, referees, targetStartDate);
    const templateMap = new Map(templateMatches.map((m) => [m.id, m]));

    return existingMatches.map((m) => {
      const template = templateMap.get(m.id);
      if (!template) return m;
      const isGroup = m.round === 'GROUP';
      return {
        ...m,
        date: template.date,
        time: template.time,
        venueId: template.venueId,
        venueName: template.venueName,
        roundLabel: template.roundLabel || m.roundLabel,
        group: template.group || m.group,
        homeTeamId: m.isCustomMatchup ? m.homeTeamId : (isGroup ? (template.homeTeamId || m.homeTeamId) : m.homeTeamId),
        awayTeamId: m.isCustomMatchup ? m.awayTeamId : (isGroup ? (template.awayTeamId || m.awayTeamId) : m.awayTeamId),
        refereeId: m.refereeId || template.refereeId,
        refereeName: m.refereeName || template.refereeName,
      };
    });
  }

  static migrateMatchesToSingleDay4Pitches(
    existingMatches: Match[],
    _teams: Team[],
    _venues: Venue[],
    _referees: Referee[],
    _targetStartDate: string = '2026-10-15'
  ): { matches: Match[]; migrated: boolean } {
    // Giữ nguyên lịch người dùng / lịch vòng tròn sinh viên, không tự ghi đè
    return { matches: existingMatches || [], migrated: false };
  }

  static validateSchedule(matches: Match[]): { valid: boolean; conflicts: string[] } {
    const analysis = this.analyzeScheduleForStudents(matches, []);
    return {
      valid: analysis.hardConflicts.length === 0,
      conflicts: analysis.hardConflicts,
    };
  }
}
