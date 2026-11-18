// ITFTMS 2026 - Ranking Engine (Business Logic Engine)
// Quy định cách tính điểm & xếp hạng chính thức:
// - Thắng: 03 điểm | Hòa: 01 điểm | Thua: 00 điểm
// - Xếp hạng: Tính tổng số điểm của các đội đạt được.
// - Nếu hai đội trở lên bằng điểm thì trước hết xét chỉ số của các trận đấu giữa các đội đó với nhau theo thứ tự:
//   1. Kết quả đối đầu giữa các đội đó với nhau
//   2. Hiệu số (tổng bàn thắng - tổng bàn thua)
//   3. Tổng bàn thắng
//   4. Thẻ đỏ, thẻ vàng (mỗi thẻ đỏ trực tiếp tính bằng 02 thẻ vàng) - đội nào bị ít thẻ hơn sẽ xếp trên
//   5. Bốc thăm (⚠️ CẦN BỐC THĂM / BTC XÁC NHẬN)

import { Team, Match, GroupStanding, SportType } from '@/types';
import { StorageService } from './storage';

function awardMatchPoints(homeScore: number, awayScore: number, sportType: SportType): [number, number] {
  if (sportType === 'VOLLEYBALL') {
    if (homeScore === awayScore) return [0, 0];
    const isDecidingSet = Math.abs(homeScore - awayScore) === 1 && homeScore + awayScore >= 3;
    if (homeScore > awayScore) return isDecidingSet ? [2, 1] : [3, 0];
    return isDecidingSet ? [1, 2] : [0, 3];
  }
  if (sportType === 'BADMINTON') {
    if (homeScore > awayScore) return [3, 0];
    if (awayScore > homeScore) return [0, 3];
    return [0, 0];
  }
  if (homeScore > awayScore) return [3, 0];
  if (awayScore > homeScore) return [0, 3];
  return [1, 1];
}

function partitionByMetric(
  items: GroupStanding[],
  getMetric: (item: GroupStanding) => number,
  ascending: boolean = false
): GroupStanding[][] {
  const sorted = [...items].sort((a, b) => {
    const va = getMetric(a);
    const vb = getMetric(b);
    return ascending ? va - vb : vb - va;
  });

  const buckets: GroupStanding[][] = [];
  sorted.forEach((item) => {
    const val = getMetric(item);
    const lastBucket = buckets[buckets.length - 1];
    if (!lastBucket || getMetric(lastBucket[0]) !== val) {
      buckets.push([item]);
    } else {
      lastBucket.push(item);
    }
  });

  return buckets;
}

export class RankingEngine {
  /**
   * Computes the general standings table across all teams (SINGLE_LEAGUE format).
   */
  static calculateLeagueStandings(teams: Team[], matches: Match[], sportType?: SportType): GroupStanding[] {
    const resolvedSport = sportType || StorageService.getTournament()?.sportType || 'FOOTBALL';
    const leagueMatches = matches.filter(
      (m) => (m.round === 'GROUP' || !m.round) && (m.status === 'FINISHED' || m.status === 'LIVE')
    );
    return this.computeStandingsFromScope('LEAGUE', teams, leagueMatches, resolvedSport);
  }

  /**
   * Computes the standings table for a specific group or delegates to general league table.
   */
  static calculateGroupStandings(
    group: string,
    teams: Team[],
    matches: Match[],
    sportType?: SportType
  ): GroupStanding[] {
    const resolvedSport = sportType || StorageService.getTournament()?.sportType || 'FOOTBALL';
    if (group === 'LEAGUE' || group === 'ALL_LEAGUE') {
      return this.calculateLeagueStandings(teams, matches, resolvedSport);
    }
    const groupTeams = teams.filter((t) => t.group === group);
    const groupMatches = matches.filter(
      (m) => m.group === group && (m.status === 'FINISHED' || m.status === 'LIVE')
    );
    return this.computeStandingsFromScope(group, groupTeams, groupMatches, resolvedSport);
  }

  private static computeStandingsFromScope(
    scopeKey: string,
    scopeTeams: Team[],
    scopeMatches: Match[],
    sportType: SportType = 'FOOTBALL'
  ): GroupStanding[] {
    // Initialize standings map
    const map = new Map<string, GroupStanding>();
    scopeTeams.forEach((t) => {
      map.set(t.id, {
        teamId: t.id,
        teamName: t.name,
        shortName: t.shortName,
        logo: t.logo,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
        yellowCards: 0,
        redCards: 0,
        cardPoints: 0,
        setsWon: 0,
        setsLost: 0,
        setDifference: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        pointsDifference: 0,
        rank: 1,
        isWithdrawn: t.status === 'WITHDRAWN' || t.status === 'DISQUALIFIED',
      });
    });

    // Check for withdrawn teams in the scope
    const withdrawnTeams = scopeTeams.filter(
      (t) => t.status === 'WITHDRAWN' || t.status === 'DISQUALIFIED'
    );
    const withdrawnIds = new Set(withdrawnTeams.map((t) => t.id));

    const activeGroupMatches = scopeMatches.filter(
      (m) => !withdrawnIds.has(m.homeTeamId) && !withdrawnIds.has(m.awayTeamId)
    );

    // Apply match results and stats for matches between active (non-withdrawn) teams
    activeGroupMatches.forEach((m) => {
      const home = map.get(m.homeTeamId);
      const away = map.get(m.awayTeamId);
      if (!home || !away) return;

      home.played += 1;
      away.played += 1;

      home.goalsFor += m.homeScore;
      home.goalsAgainst += m.awayScore;
      away.goalsFor += m.awayScore;
      away.goalsAgainst += m.homeScore;

      if (Array.isArray(m.sets)) {
        m.sets.forEach((s) => {
          const hp = Number(s.homePoints) || 0;
          const ap = Number(s.awayPoints) || 0;
          home.pointsFor = (home.pointsFor || 0) + hp;
          home.pointsAgainst = (home.pointsAgainst || 0) + ap;
          away.pointsFor = (away.pointsFor || 0) + ap;
          away.pointsAgainst = (away.pointsAgainst || 0) + hp;
        });
      }

      const [homePts, awayPts] = awardMatchPoints(m.homeScore, m.awayScore, sportType);
      home.points += homePts;
      away.points += awayPts;

      if (m.homeScore > m.awayScore) {
        home.won += 1;
        away.lost += 1;
      } else if (m.homeScore < m.awayScore) {
        away.won += 1;
        home.lost += 1;
      } else if (sportType === 'FOOTBALL') {
        home.drawn += 1;
        away.drawn += 1;
      }

      if (sportType === 'FOOTBALL') {
        // Thống kê thẻ phạt (mỗi thẻ đỏ trực tiếp tính bằng 02 thẻ vàng)
        (m.events || []).forEach((ev) => {
          if (ev.type !== 'CARD') return;
          const target = map.get(ev.teamId);
          if (!target || withdrawnIds.has(ev.teamId)) return;

          if (ev.cardType === 'RED') {
            target.redCards += 1;
            target.cardPoints += 2;
          } else if (ev.cardType === 'YELLOW' || ev.cardType === 'SECOND_YELLOW') {
            target.yellowCards += 1;
            target.cardPoints += 1;
          }
        });
      }
    });

    // Các đội còn lại được cộng 3 điểm (xử thắng) khi có đội bỏ cuộc, không cộng trùng lặp
    if (withdrawnTeams.length > 0) {
      const activeTour = StorageService.getTournament();
      const winSetCount =
        sportType === 'FOOTBALL' ? 3 : activeTour?.setConfig?.bestOf === 5 ? 3 : 2;
      withdrawnTeams.forEach((wTeam) => {
        const wEntry = map.get(wTeam.id);
        scopeTeams.forEach((t) => {
          if (t.id !== wTeam.id && !withdrawnIds.has(t.id)) {
            const entry = map.get(t.id);
            if (entry) {
              entry.played += 1;
              entry.won += 1;
              entry.points += 3;
              entry.goalsFor += winSetCount;
            }
            if (wEntry) {
              wEntry.played += 1;
              wEntry.lost += 1;
              wEntry.goalsAgainst += winSetCount;
            }
          }
        });
      });
    }

    // Calculate set/goal difference and point difference
    map.forEach((item) => {
      item.goalDifference = item.goalsFor - item.goalsAgainst;
      item.setsWon = item.goalsFor;
      item.setsLost = item.goalsAgainst;
      item.setDifference = item.goalDifference;
      item.pointsDifference = (item.pointsFor || 0) - (item.pointsAgainst || 0);
    });

    // Load any manual BTC draw / tie-break decisions
    const manualTieBreaks = StorageService.getBtcTieBreaks();

    const getPairDecision = (idA: string, idB: string): string | undefined => {
      const pairKey1 = `${scopeKey}:${idA}:${idB}`;
      const pairKey2 = `${scopeKey}:${idB}:${idA}`;
      const resolved = manualTieBreaks[pairKey1] || manualTieBreaks[pairKey2];
      return resolved && resolved.length === 2 ? resolved[0] : undefined;
    };

    /**
     * Xử lý phân hạng cho nhóm từ 2 đội trở lên bằng điểm theo đúng môn thể thao:
     * - FOOTBALL: Đối đầu -> Hiệu số -> Tổng bàn thắng -> Thẻ phạt -> Bốc thăm
     * - BADMINTON: Đối đầu (Điểm -> Hiệu số ván -> Hiệu số điểm cầu) -> Hiệu số ván -> Hiệu số điểm cầu -> Tổng điểm cầu -> Bốc thăm
     * - VOLLEYBALL: Số trận thắng -> Hiệu số set -> Hiệu số điểm quả -> Tổng điểm quả -> Đối đầu -> Bốc thăm
     */
    const resolveTiedGroup = (tied: GroupStanding[]): GroupStanding[] => {
      if (tied.length <= 1) return tied;

      const tiedIds = new Set(tied.map((t) => t.teamId));
      const h2hMatches = activeGroupMatches.filter(
        (m) => tiedIds.has(m.homeTeamId) && tiedIds.has(m.awayTeamId)
      );

      const playedPairs = new Set<string>();
      h2hMatches.forEach((m) => {
        const pairKey =
          m.homeTeamId < m.awayTeamId
            ? `${m.homeTeamId}__${m.awayTeamId}`
            : `${m.awayTeamId}__${m.homeTeamId}`;
        playedPairs.add(pairKey);
      });
      const expectedPairs = (tied.length * (tied.length - 1)) / 2;
      const allH2HPlayed = expectedPairs > 0 && playedPairs.size >= expectedPairs;

      const computeH2HStats = () => {
        const h2hStats = new Map<
          string,
          { pts: number; gf: number; ga: number; gd: number; pf: number; pa: number; pd: number }
        >();
        tied.forEach((t) =>
          h2hStats.set(t.teamId, { pts: 0, gf: 0, ga: 0, gd: 0, pf: 0, pa: 0, pd: 0 })
        );

        h2hMatches.forEach((m) => {
          const home = h2hStats.get(m.homeTeamId);
          const away = h2hStats.get(m.awayTeamId);
          if (!home || !away) return;

          home.gf += m.homeScore;
          home.ga += m.awayScore;
          away.gf += m.awayScore;
          away.ga += m.homeScore;

          if (Array.isArray(m.sets)) {
            m.sets.forEach((s) => {
              const hp = Number(s.homePoints) || 0;
              const ap = Number(s.awayPoints) || 0;
              home.pf += hp;
              home.pa += ap;
              away.pf += ap;
              away.pa += hp;
            });
          }

          const [hPts, aPts] = awardMatchPoints(m.homeScore, m.awayScore, sportType);
          home.pts += hPts;
          away.pts += aPts;
        });

        h2hStats.forEach((st) => {
          st.gd = st.gf - st.ga;
          st.pd = st.pf - st.pa;
        });
        return h2hStats;
      };

      if (sportType === 'VOLLEYBALL') {
        const byWon = partitionByMetric(tied, (t) => t.won, false);
        if (byWon.length > 1) return byWon.flatMap((b) => resolveTiedGroup(b));

        const bySetDiff = partitionByMetric(tied, (t) => t.goalDifference, false);
        if (bySetDiff.length > 1) return bySetDiff.flatMap((b) => resolveTiedGroup(b));

        const byPtsDiff = partitionByMetric(tied, (t) => t.pointsDifference || 0, false);
        if (byPtsDiff.length > 1) return byPtsDiff.flatMap((b) => resolveTiedGroup(b));

        const byPtsFor = partitionByMetric(tied, (t) => t.pointsFor || 0, false);
        if (byPtsFor.length > 1) return byPtsFor.flatMap((b) => resolveTiedGroup(b));

        if (allH2HPlayed) {
          const h2hStats = computeH2HStats();
          const byH2HPts = partitionByMetric(tied, (t) => h2hStats.get(t.teamId)?.pts || 0, false);
          if (byH2HPts.length > 1) return byH2HPts.flatMap((b) => resolveTiedGroup(b));

          const byH2HGd = partitionByMetric(tied, (t) => h2hStats.get(t.teamId)?.gd || 0, false);
          if (byH2HGd.length > 1) return byH2HGd.flatMap((b) => resolveTiedGroup(b));

          const byH2HPd = partitionByMetric(tied, (t) => h2hStats.get(t.teamId)?.pd || 0, false);
          if (byH2HPd.length > 1) return byH2HPd.flatMap((b) => resolveTiedGroup(b));
        }
      } else if (sportType === 'BADMINTON') {
        if (allH2HPlayed) {
          const h2hStats = computeH2HStats();
          const byH2HPts = partitionByMetric(tied, (t) => h2hStats.get(t.teamId)?.pts || 0, false);
          if (byH2HPts.length > 1) return byH2HPts.flatMap((b) => resolveTiedGroup(b));

          const byH2HGd = partitionByMetric(tied, (t) => h2hStats.get(t.teamId)?.gd || 0, false);
          if (byH2HGd.length > 1) return byH2HGd.flatMap((b) => resolveTiedGroup(b));

          const byH2HPd = partitionByMetric(tied, (t) => h2hStats.get(t.teamId)?.pd || 0, false);
          if (byH2HPd.length > 1) return byH2HPd.flatMap((b) => resolveTiedGroup(b));
        }

        const bySetDiff = partitionByMetric(tied, (t) => t.goalDifference, false);
        if (bySetDiff.length > 1) return bySetDiff.flatMap((b) => resolveTiedGroup(b));

        const byPtsDiff = partitionByMetric(tied, (t) => t.pointsDifference || 0, false);
        if (byPtsDiff.length > 1) return byPtsDiff.flatMap((b) => resolveTiedGroup(b));

        const byPtsFor = partitionByMetric(tied, (t) => t.pointsFor || 0, false);
        if (byPtsFor.length > 1) return byPtsFor.flatMap((b) => resolveTiedGroup(b));
      } else {
        // FOOTBALL
        if (allH2HPlayed) {
          const h2hStats = computeH2HStats();
          const byH2HPts = partitionByMetric(tied, (t) => h2hStats.get(t.teamId)?.pts || 0, false);
          if (byH2HPts.length > 1) return byH2HPts.flatMap((b) => resolveTiedGroup(b));

          const byH2HGd = partitionByMetric(tied, (t) => h2hStats.get(t.teamId)?.gd || 0, false);
          if (byH2HGd.length > 1) return byH2HGd.flatMap((b) => resolveTiedGroup(b));

          const byH2HGf = partitionByMetric(tied, (t) => h2hStats.get(t.teamId)?.gf || 0, false);
          if (byH2HGf.length > 1) return byH2HGf.flatMap((b) => resolveTiedGroup(b));
        }

        const byOverallGd = partitionByMetric(tied, (t) => t.goalDifference, false);
        if (byOverallGd.length > 1) return byOverallGd.flatMap((b) => resolveTiedGroup(b));

        const byOverallGf = partitionByMetric(tied, (t) => t.goalsFor, false);
        if (byOverallGf.length > 1) return byOverallGf.flatMap((b) => resolveTiedGroup(b));

        const byCards = partitionByMetric(tied, (t) => t.cardPoints, true);
        if (byCards.length > 1) return byCards.flatMap((b) => resolveTiedGroup(b));
      }

      // 5. Bốc thăm (BTC thực hiện bốc thăm khi tất cả chỉ số trên đều bằng nhau)
      const manualWins = new Map<string, number>();
      tied.forEach((t) => manualWins.set(t.teamId, 0));
      for (let i = 0; i < tied.length; i++) {
        for (let j = i + 1; j < tied.length; j++) {
          const winnerId = getPairDecision(tied[i].teamId, tied[j].teamId);
          if (winnerId && manualWins.has(winnerId)) {
            manualWins.set(winnerId, (manualWins.get(winnerId) || 0) + 1);
          }
        }
      }

      const orderedByDraw = [...tied].sort((a, b) => {
        const directWinner = getPairDecision(a.teamId, b.teamId);
        if (directWinner === a.teamId) return -1;
        if (directWinner === b.teamId) return 1;
        return (manualWins.get(b.teamId) || 0) - (manualWins.get(a.teamId) || 0);
      });

      for (let i = 0; i < orderedByDraw.length - 1; i++) {
        const cur = orderedByDraw[i];
        const nxt = orderedByDraw[i + 1];
        if (cur.played > 0 || nxt.played > 0) {
          const directWinner = getPairDecision(cur.teamId, nxt.teamId);
          if (!directWinner) {
            cur.needsBtcTieBreak = true;
            nxt.needsBtcTieBreak = true;
          } else {
            cur.btcTieBreakResolved = true;
            nxt.btcTieBreakResolved = true;
          }
        }
      }

      return orderedByDraw;
    };

    const allEntries = Array.from(map.values());
    const activeEntries = allEntries.filter((item) => !item.isWithdrawn);
    const withdrawnEntries = allEntries.filter((item) => item.isWithdrawn);

    // Group active teams by total points descending, then resolve ties within each points bucket
    const pointsBuckets = partitionByMetric(activeEntries, (item) => item.points, false);
    const rankedActive = pointsBuckets.flatMap((bucket) => resolveTiedGroup(bucket));

    const sorted = [...rankedActive, ...withdrawnEntries];

    // Assign final ranks
    sorted.forEach((item, index) => {
      item.rank = index + 1;
    });

    return sorted;
  }

  /**
   * Lưu thứ tự bốc thăm phân hạng cho 2 hoặc nhiều đội bằng mọi chỉ số phụ
   */
  static resolveTieBreakOrder(
    group: string,
    orderedTeamIds: string[],
    reason: string,
    organizerName: string
  ): void {
    if (orderedTeamIds.length < 2) return;
    const teams = StorageService.getTeams();

    const map = StorageService.getBtcTieBreaks();
    for (let i = 0; i < orderedTeamIds.length; i++) {
      for (let j = i + 1; j < orderedTeamIds.length; j++) {
        const upper = orderedTeamIds[i];
        const lower = orderedTeamIds[j];
        map[`${group}:${upper}:${lower}`] = [upper, lower];
        map[`${group}:${lower}:${upper}`] = [upper, lower];
      }
    }
    StorageService.saveBtcTieBreaks(map);

    const orderedNames = orderedTeamIds
      .map((id, idx) => `${idx + 1}. ${teams.find((t) => t.id === id)?.name || id}`)
      .join(' > ');

    StorageService.logAction(
      organizerName,
      'ORGANIZER',
      'BỐC THĂM XẾP HẠNG BẰNG ĐIỂM (TIE-BREAK)',
      `Bảng ${group}`,
      `Kết quả bốc thăm xếp hạng: ${orderedNames}`,
      reason || 'Bốc thăm phân định thứ hạng khi các đội bằng điểm và mọi chỉ số phụ.'
    );
  }

  /**
   * Resolves manual tie break between 2 teams by BTC and writes to Audit Log
   */
  static resolveTieBreak(
    group: string,
    winnerTeamId: string,
    loserTeamId: string,
    reason: string,
    organizerName: string
  ): void {
    this.resolveTieBreakOrder(group, [winnerTeamId, loserTeamId], reason, organizerName);
  }

  /**
   * Tính toán và tìm danh sách cầu thủ xuất sắc nhất dựa trên điểm số bàn thắng vòng Knock-out
   * (Tứ kết, Bán kết, Tranh hạng 3, Chung kết)
   */
  static getKnockoutBestPlayers(matches: Match[], teams: Team[]): KnockoutPlayerScorer[] {
    const knockoutRounds = new Set(['QUARTER_FINAL', 'SEMI_FINAL', 'THIRD_PLACE', 'FINAL']);
    const knockoutMatchIds = new Set(['M25', 'M26', 'M27', 'M28', 'M29', 'M30', 'M31', 'M32']);

    // 1. Lọc tất cả các trận đấu thuộc vòng Knock-out
    const knockoutMatches = (matches || []).filter((m) => {
      if (knockoutRounds.has(m.round)) return true;
      if (knockoutMatchIds.has(m.id)) return true;
      const lbl = (m.roundLabel || '').toLowerCase();
      return (
        lbl.includes('tứ kết') ||
        lbl.includes('bán kết') ||
        lbl.includes('chung kết') ||
        lbl.includes('tranh hạng 3')
      );
    });

    const playerMap = new Map<string, KnockoutPlayerScorer>();

    // 2. Thu thập bàn thắng và kiến tạo từ các sự kiện trận đấu vòng Knockout
    knockoutMatches.forEach((m) => {
      const homeTeam = teams.find((t) => t.id === m.homeTeamId);
      const awayTeam = teams.find((t) => t.id === m.awayTeamId);

      const roundLower = (m.roundLabel || m.round || '').toLowerCase();
      const isQuarter = m.round === 'QUARTER_FINAL' || roundLower.includes('tứ kết') || ['M25', 'M26', 'M27', 'M28'].includes(m.id);
      const isSemi = m.round === 'SEMI_FINAL' || roundLower.includes('bán kết') || ['M29', 'M30'].includes(m.id);
      const isFinal = m.round === 'FINAL' || roundLower.includes('chung kết') || m.id === 'M32';
      const isThirdPlace = m.round === 'THIRD_PLACE' || roundLower.includes('hạng 3') || m.id === 'M31';

      (m.events || []).forEach((ev) => {
        // Ghi nhận bàn thắng hợp lệ (không tính phản lưới nhà)
        if (ev.type === 'GOAL' && !ev.isOwnGoal && ev.playerId) {
          const pId = ev.playerId;
          const scoringTeam = ev.teamId === m.homeTeamId ? homeTeam : awayTeam;
          const defendingTeam = ev.teamId === m.homeTeamId ? awayTeam : homeTeam;
          const playerObj = scoringTeam?.players.find((p) => p.id === pId);

          if (!playerMap.has(pId)) {
            playerMap.set(pId, {
              playerId: pId,
              playerName: ev.playerName || playerObj?.name || 'Cầu thủ',
              jerseyNumber: playerObj?.jerseyNumber,
              teamId: ev.teamId,
              teamName: scoringTeam?.name || 'Đội bóng',
              avatarUrl: playerObj?.avatarUrl,
              cohort: playerObj?.cohort,
              class: playerObj?.class,
              knockoutGoals: 0,
              quarterGoals: 0,
              semiGoals: 0,
              finalGoals: 0,
              thirdPlaceGoals: 0,
              knockoutAssists: 0,
              totalGoalsAllStages: playerObj?.goals || 0,
              matchesPlayed: 1,
              points: 0,
              rank: 1,
              goalsBreakdown: [],
            });
          }

          const entry = playerMap.get(pId)!;
          entry.knockoutGoals += 1;

          if (isQuarter) entry.quarterGoals += 1;
          else if (isSemi) entry.semiGoals += 1;
          else if (isFinal) entry.finalGoals += 1;
          else if (isThirdPlace) entry.thirdPlaceGoals += 1;

          entry.goalsBreakdown.push({
            matchId: m.id,
            roundLabel: m.roundLabel || (isFinal ? 'Chung Kết' : isSemi ? 'Bán Kết' : isQuarter ? 'Tứ Kết' : 'Tranh Hạng 3'),
            minute: ev.minute,
            againstTeamName: defendingTeam?.name,
          });
        }

        // Ghi nhận kiến tạo vòng Knockout
        if (ev.type === 'GOAL' && ev.assistPlayerId) {
          const aId = ev.assistPlayerId;
          const assistTeam = ev.teamId === m.homeTeamId ? homeTeam : awayTeam;
          const assistPlayer = assistTeam?.players.find((p) => p.id === aId);

          if (!playerMap.has(aId)) {
            playerMap.set(aId, {
              playerId: aId,
              playerName: ev.assistPlayerName || assistPlayer?.name || 'Cầu thủ',
              jerseyNumber: assistPlayer?.jerseyNumber,
              teamId: ev.teamId,
              teamName: assistTeam?.name || 'Đội bóng',
              avatarUrl: assistPlayer?.avatarUrl,
              cohort: assistPlayer?.cohort,
              class: assistPlayer?.class,
              knockoutGoals: 0,
              quarterGoals: 0,
              semiGoals: 0,
              finalGoals: 0,
              thirdPlaceGoals: 0,
              knockoutAssists: 0,
              totalGoalsAllStages: assistPlayer?.goals || 0,
              matchesPlayed: 1,
              points: 0,
              rank: 1,
              goalsBreakdown: [],
            });
          }

          const entry = playerMap.get(aId)!;
          entry.knockoutAssists += 1;
        }
      });
    });

    // 3. Quy đổi điểm số phong độ và xếp hạng:
    // - Mỗi bàn thắng vòng Knockout = 10 điểm
    // - Bàn thắng trận Chung kết: +5 điểm thưởng (Bonus)
    // - Bàn thắng trận Bán kết: +3 điểm thưởng (Bonus)
    // - Mỗi đường kiến tạo vòng Knockout: +4 điểm
    const scoredList = Array.from(playerMap.values()).map((p) => {
      const points =
        p.knockoutGoals * 10 +
        p.finalGoals * 5 +
        p.semiGoals * 3 +
        p.knockoutAssists * 4;
      return { ...p, points };
    });

    // 4. Sắp xếp thứ hạng:
    // Tiêu chí 1: Số bàn thắng vòng Knockout nhiều nhất
    // Tiêu chí 2: Điểm số phong độ cao nhất
    // Tiêu chí 3: Số bàn thắng ở Chung kết > Bán kết > Tứ kết
    // Tiêu chí 4: Số đường kiến tạo
    // Tiêu chí 5: Tổng số bàn thắng toàn giải
    scoredList.sort((a, b) => {
      if (b.knockoutGoals !== a.knockoutGoals) return b.knockoutGoals - a.knockoutGoals;
      if (b.points !== a.points) return b.points - a.points;
      if (b.finalGoals !== a.finalGoals) return b.finalGoals - a.finalGoals;
      if (b.semiGoals !== a.semiGoals) return b.semiGoals - a.semiGoals;
      if (b.knockoutAssists !== a.knockoutAssists) return b.knockoutAssists - a.knockoutAssists;
      return b.totalGoalsAllStages - a.totalGoalsAllStages;
    });

    scoredList.forEach((p, idx) => {
      p.rank = idx + 1;
    });

    return scoredList;
  }

  /**
   * Lấy ngay Cầu thủ xuất sắc nhất (MVP) vòng Knock-out
   */
  static getKnockoutMvp(matches: Match[], teams: Team[]): KnockoutPlayerScorer | null {
    const list = this.getKnockoutBestPlayers(matches, teams);
    return list.length > 0 && list[0].knockoutGoals > 0 ? list[0] : null;
  }

  /**
   * Thống kê danh sách cầu thủ ghi bàn hàng đầu toàn giải (dùng cho Vua phá lưới vòng tròn / chung cuộc).
   */
  static getLeagueTopScorers(matches: Match[], teams: Team[]): Array<{
    playerId: string;
    playerName: string;
    jerseyNumber?: number;
    teamId: string;
    teamName: string;
    teamShortName: string;
    goals: number;
    assists: number;
  }> {
    const map = new Map<string, {
      playerId: string;
      playerName: string;
      jerseyNumber?: number;
      teamId: string;
      teamName: string;
      teamShortName: string;
      goals: number;
      assists: number;
    }>();

    const teamMap = new Map(teams.map((t) => [t.id, t]));

    (matches || []).forEach((m) => {
      (m.events || []).forEach((ev) => {
        if (ev.type === 'GOAL' && !ev.isOwnGoal && ev.playerId) {
          const team = teamMap.get(ev.teamId);
          const pl = team?.players.find((p) => p.id === ev.playerId);
          const cur = map.get(ev.playerId) || {
            playerId: ev.playerId,
            playerName: ev.playerName || pl?.name || 'Cầu thủ',
            jerseyNumber: pl?.jerseyNumber,
            teamId: ev.teamId,
            teamName: team?.name || 'Đội bóng',
            teamShortName: team?.shortName || ev.teamId,
            goals: 0,
            assists: 0,
          };
          cur.goals += 1;
          map.set(ev.playerId, cur);
        }
        if (ev.type === 'GOAL' && ev.assistPlayerId) {
          const team = teamMap.get(ev.teamId);
          const pl = team?.players.find((p) => p.id === ev.assistPlayerId);
          const cur = map.get(ev.assistPlayerId) || {
            playerId: ev.assistPlayerId,
            playerName: ev.assistPlayerName || pl?.name || 'Cầu thủ',
            jerseyNumber: pl?.jerseyNumber,
            teamId: ev.teamId,
            teamName: team?.name || 'Đội bóng',
            teamShortName: team?.shortName || ev.teamId,
            goals: 0,
            assists: 0,
          };
          cur.assists += 1;
          map.set(ev.assistPlayerId, cur);
        }
      });
    });

    return Array.from(map.values())
      .filter((x) => x.goals > 0)
      .sort((a, b) => (b.goals !== a.goals ? b.goals - a.goals : b.assists - a.assists));
  }
}

export interface KnockoutPlayerScorer {
  playerId: string;
  playerName: string;
  jerseyNumber?: number;
  teamId: string;
  teamName: string;
  avatarUrl?: string;
  cohort?: string;
  class?: string;
  knockoutGoals: number;      // Bàn thắng vòng Knock-out
  quarterGoals: number;       // Bàn Tứ kết
  semiGoals: number;          // Bàn Bán kết
  finalGoals: number;         // Bàn Chung kết
  thirdPlaceGoals: number;    // Bàn Tranh hạng 3
  knockoutAssists: number;    // Kiến tạo vòng Knock-out
  totalGoalsAllStages: number;// Tổng bàn toàn giải
  matchesPlayed: number;
  points: number;             // Điểm số quy đổi
  rank: number;
  goalsBreakdown: Array<{
    matchId: string;
    roundLabel: string;
    minute: number;
    againstTeamName?: string;
  }>;
}
