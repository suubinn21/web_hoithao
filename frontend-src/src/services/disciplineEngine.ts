// ITFTMS 2026 - Disciplinary & Card Fines Engine
// Hỗ trợ Thể lệ CTUT CNTT (SINGLE_LEAGUE):
// - Thẻ vàng: 20.000đ / thẻ (không cộng dồn treo giò tự động giữa các trận)
// - 02 thẻ vàng trong CÙNG 01 trận (SECOND_YELLOW): Truất quyền thi đấu trong trận đó + phạt 50.000đ
// - Thẻ đỏ trực tiếp (RED): Phạt 100.000đ + truất quyền thi đấu ngay lập tức; BTC quyết định có đình chỉ trận tiếp theo hay không
// Hỗ trợ thể thức cũ GROUP_KNOCKOUT: tích lũy 2 thẻ vàng hoặc thẻ đỏ tự động đề xuất treo giò 1 trận.

import { Team, Match, PaidFineRecord, TournamentFormatType } from '@/types';
import { StorageService } from './storage';

export interface CardFineItem {
  fineId: string;
  matchId: string;
  matchNumber: number;
  roundLabel: string;
  date: string;
  teamId: string;
  teamName: string;
  playerId: string;
  playerName: string;
  jerseyNumber?: number;
  fineType: 'YELLOW' | 'SECOND_YELLOW' | 'RED';
  label: string;
  amount: number;
  paid: boolean;
  paidAt?: string;
}

export interface TeamFineSummary {
  teamId: string;
  teamName: string;
  yellowCount: number;
  secondYellowCount: number;
  redCount: number;
  totalAmount: number;
  paidAmount: number;
  unpaidAmount: number;
}

export interface DisciplinaryReport {
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  yellowCount: number;
  secondYellowCount: number;
  directRedCount: number;
  redCount: number;
  isSuspended: boolean;
  suspensionReason?: string;
  nextMatchId?: string;
  fineTotal: number;
  unpaidFineTotal: number;
  needsBtcDecision: boolean;
  btcDecision?: 'PENDING' | 'SUSPENDED' | 'CLEARED';
  status: 'SAFE' | 'WARNING_1_YELLOW' | 'SUSPENDED_2_YELLOWS' | 'SUSPENDED_RED' | 'PENDING_BTC_RED';
}

export const CARD_FINE_RATES = {
  YELLOW: 20000,
  SECOND_YELLOW: 50000,
  RED: 100000,
} as const;

export class DisciplineEngine {
  /**
   * Tổng hợp danh sách tiền phạt thẻ chi tiết theo từng trận & từng cầu thủ (CTUT Rules: Vàng 20k, 2 Vàng cùng trận 50k, Đỏ trực tiếp 100k).
   */
  static calculateCardFines(
    matches: Match[],
    teams: Team[],
    paidFines: Record<string, PaidFineRecord> = {}
  ): { items: CardFineItem[]; byTeam: TeamFineSummary[]; totalAmount: number; paidAmount: number; unpaidAmount: number } {
    const items: CardFineItem[] = [];
    const teamLookup = new Map(teams.map((t) => [t.id, t]));

    matches.forEach((m) => {
      if (!m.events || m.events.length === 0) return;

      // Nhóm theo từng cầu thủ trong CÙNG trận để phân biệt 1 thẻ vàng (20k) vs 2 thẻ vàng cùng trận (50k)
      const byPlayerInMatch = new Map<
        string,
        {
          playerId: string;
          playerName: string;
          teamId: string;
          yellowCount: number;
          hasSecondYellow: boolean;
          directRedCount: number;
        }
      >();

      m.events.forEach((ev) => {
        if (ev.type !== 'CARD') return;
        const pid = ev.playerId || `${ev.teamId}-${ev.playerName || 'unknown'}`;
        const existing = byPlayerInMatch.get(pid) || {
          playerId: pid,
          playerName: ev.playerName || 'Cầu thủ',
          teamId: ev.teamId,
          yellowCount: 0,
          hasSecondYellow: false,
          directRedCount: 0,
        };
        if (ev.cardType === 'YELLOW') existing.yellowCount += 1;
        else if (ev.cardType === 'SECOND_YELLOW') existing.hasSecondYellow = true;
        else if (ev.cardType === 'RED') existing.directRedCount += 1;
        byPlayerInMatch.set(pid, existing);
      });

      byPlayerInMatch.forEach((rec) => {
        const team = teamLookup.get(rec.teamId);
        const playerObj = team?.players.find((p) => p.id === rec.playerId);
        const playerName = playerObj?.name || rec.playerName;
        const teamName = team?.name || rec.teamId;

        if (rec.hasSecondYellow) {
          const fineId = `${m.id}::${rec.playerId}::2Y`;
          const paidRec = paidFines[fineId];
          items.push({
            fineId,
            matchId: m.id,
            matchNumber: m.matchNumber,
            roundLabel: m.roundLabel || `Trận #${m.matchNumber}`,
            date: m.date,
            teamId: rec.teamId,
            teamName,
            playerId: rec.playerId,
            playerName,
            jerseyNumber: playerObj?.jerseyNumber,
            fineType: 'SECOND_YELLOW',
            label: '02 Thẻ vàng cùng trận (truất quyền trong trận)',
            amount: CARD_FINE_RATES.SECOND_YELLOW,
            paid: Boolean(paidRec?.paid),
            paidAt: paidRec?.paidAt,
          });
        } else if (rec.yellowCount > 0) {
          const fineId = `${m.id}::${rec.playerId}::Y`;
          const paidRec = paidFines[fineId];
          items.push({
            fineId,
            matchId: m.id,
            matchNumber: m.matchNumber,
            roundLabel: m.roundLabel || `Trận #${m.matchNumber}`,
            date: m.date,
            teamId: rec.teamId,
            teamName,
            playerId: rec.playerId,
            playerName,
            jerseyNumber: playerObj?.jerseyNumber,
            fineType: 'YELLOW',
            label: rec.yellowCount > 1 ? `${rec.yellowCount} Thẻ vàng` : 'Thẻ vàng',
            amount: rec.yellowCount * CARD_FINE_RATES.YELLOW,
            paid: Boolean(paidRec?.paid),
            paidAt: paidRec?.paidAt,
          });
        }

        if (rec.directRedCount > 0) {
          const fineId = `${m.id}::${rec.playerId}::R`;
          const paidRec = paidFines[fineId];
          items.push({
            fineId,
            matchId: m.id,
            matchNumber: m.matchNumber,
            roundLabel: m.roundLabel || `Trận #${m.matchNumber}`,
            date: m.date,
            teamId: rec.teamId,
            teamName,
            playerId: rec.playerId,
            playerName,
            jerseyNumber: playerObj?.jerseyNumber,
            fineType: 'RED',
            label: 'Thẻ đỏ trực tiếp (Chờ/theo QĐ BTC)',
            amount: rec.directRedCount * CARD_FINE_RATES.RED,
            paid: Boolean(paidRec?.paid),
            paidAt: paidRec?.paidAt,
          });
        }
      });
    });

    const teamMap = new Map<string, TeamFineSummary>();
    teams.forEach((t) => {
      teamMap.set(t.id, {
        teamId: t.id,
        teamName: t.name,
        yellowCount: 0,
        secondYellowCount: 0,
        redCount: 0,
        totalAmount: 0,
        paidAmount: 0,
        unpaidAmount: 0,
      });
    });

    items.forEach((it) => {
      const ts = teamMap.get(it.teamId) || {
        teamId: it.teamId,
        teamName: it.teamName,
        yellowCount: 0,
        secondYellowCount: 0,
        redCount: 0,
        totalAmount: 0,
        paidAmount: 0,
        unpaidAmount: 0,
      };
      if (it.fineType === 'YELLOW') ts.yellowCount += 1;
      else if (it.fineType === 'SECOND_YELLOW') ts.secondYellowCount += 1;
      else if (it.fineType === 'RED') ts.redCount += 1;

      ts.totalAmount += it.amount;
      if (it.paid) ts.paidAmount += it.amount;
      else ts.unpaidAmount += it.amount;
      teamMap.set(it.teamId, ts);
    });

    const byTeam = Array.from(teamMap.values()).filter((t) => t.totalAmount > 0);
    const totalAmount = items.reduce((s, it) => s + it.amount, 0);
    const paidAmount = items.filter((it) => it.paid).reduce((s, it) => s + it.amount, 0);

    return {
      items,
      byTeam,
      totalAmount,
      paidAmount,
      unpaidAmount: totalAmount - paidAmount,
    };
  }

  /**
   * Recalculates card accumulations, fines and suspensions across all finished and active matches.
   */
  static evaluateAllPlayers(
    teams: Team[],
    matches: Match[],
    formatType: TournamentFormatType = 'SINGLE_LEAGUE'
  ): DisciplinaryReport[] {
    const playerCardMap = new Map<
      string,
      { yellows: number; secondYellows: number; directReds: number; reds: number }
    >();

    // Scan all card events
    matches.forEach((m) => {
      if (m.events) {
        m.events.forEach((ev) => {
          if (ev.type === 'CARD' && ev.playerId) {
            const current = playerCardMap.get(ev.playerId) || {
              yellows: 0,
              secondYellows: 0,
              directReds: 0,
              reds: 0,
            };
            if (ev.cardType === 'YELLOW') {
              current.yellows += 1;
            } else if (ev.cardType === 'SECOND_YELLOW') {
              current.yellows += 1;
              current.secondYellows += 1;
              current.reds += 1;
            } else if (ev.cardType === 'RED') {
              current.directReds += 1;
              current.reds += 1;
            }
            playerCardMap.set(ev.playerId, current);
          }
        });
      }
    });

    const manualOverrides = StorageService.getManualSuspensions();
    const paidFines = StorageService.getPaidFines();
    const fineCalc = this.calculateCardFines(matches, teams, paidFines);
    const finesByPlayer = new Map<string, { total: number; unpaid: number }>();
    fineCalc.items.forEach((it) => {
      const prev = finesByPlayer.get(it.playerId) || { total: 0, unpaid: 0 };
      prev.total += it.amount;
      if (!it.paid) prev.unpaid += it.amount;
      finesByPlayer.set(it.playerId, prev);
    });

    const reports: DisciplinaryReport[] = [];

    teams.forEach((team) => {
      team.players.forEach((player) => {
        const cardInfo = playerCardMap.get(player.id);
        const totalYellows = cardInfo ? cardInfo.yellows : (player.yellowCards || 0);
        const secondYellowCount = cardInfo ? cardInfo.secondYellows : 0;
        const directRedCount = cardInfo ? cardInfo.directReds : 0;
        const totalReds = cardInfo ? cardInfo.reds : (player.redCards || 0);

        let isSuspended = false;
        let suspensionReason: string | undefined = undefined;
        let status: DisciplinaryReport['status'] = 'SAFE';
        let needsBtcDecision = false;
        const override = manualOverrides[player.id];
        let btcDecision: 'PENDING' | 'SUSPENDED' | 'CLEARED' | undefined = override?.decision;

        if (formatType === 'GROUP_KNOCKOUT') {
          if (totalReds > 0) {
            isSuspended = true;
            suspensionReason = 'Thẻ đỏ / 2 thẻ vàng - Treo giò theo quyết định BTC';
            status = 'SUSPENDED_RED';
          } else if (totalYellows >= 2) {
            isSuspended = true;
            suspensionReason = `Tích lũy ${totalYellows} thẻ vàng - Treo giò 01 trận tiếp theo`;
            status = 'SUSPENDED_2_YELLOWS';
          } else if (totalYellows === 1) {
            status = 'WARNING_1_YELLOW';
          }

          if (override && totalYellows <= override.yellows && totalReds <= override.reds) {
            isSuspended = override.isSuspended;
            suspensionReason = override.isSuspended ? override.reason : undefined;
            if (!isSuspended) {
              status = totalYellows === 1 ? 'WARNING_1_YELLOW' : 'SAFE';
            } else if (status === 'SAFE' || status === 'WARNING_1_YELLOW') {
              status = 'SUSPENDED_RED';
            }
          }
        } else {
          // Thể lệ CTUT CNTT (SINGLE_LEAGUE):
          // - Thẻ vàng 20k, 2 vàng cùng trận 50k (nghỉ hết trận đó), Đỏ trực tiếp 100k & BTC quyết định đình chỉ trận sau hay không
          if (directRedCount > 0) {
            const hasFreshOverride =
              override && totalYellows <= override.yellows && totalReds <= override.reds;
            if (hasFreshOverride && override.decision && override.decision !== 'PENDING') {
              isSuspended = override.isSuspended;
              suspensionReason = override.isSuspended ? override.reason : undefined;
              status = override.isSuspended ? 'SUSPENDED_RED' : 'SAFE';
              btcDecision = override.decision;
            } else if (hasFreshOverride && !override.decision) {
              isSuspended = override.isSuspended;
              suspensionReason = override.isSuspended ? override.reason : undefined;
              status = override.isSuspended ? 'SUSPENDED_RED' : 'SAFE';
            } else {
              // Mới nhận thẻ đỏ trực tiếp, chưa có quyết định BTC -> chờ BTC phân định
              needsBtcDecision = true;
              btcDecision = 'PENDING';
              status = 'PENDING_BTC_RED';
            }
          } else if (override && totalYellows <= override.yellows && totalReds <= override.reds) {
            isSuspended = override.isSuspended;
            suspensionReason = override.isSuspended ? override.reason : undefined;
            status = isSuspended ? 'SUSPENDED_RED' : totalYellows >= 1 ? 'WARNING_1_YELLOW' : 'SAFE';
          } else if (totalYellows >= 1 || secondYellowCount >= 1) {
            status = 'WARNING_1_YELLOW';
          }
        }

        // Keep player model in sync
        player.yellowCards = totalYellows;
        player.redCards = totalReds;
        player.isSuspended = isSuspended;
        player.suspensionReason = suspensionReason;

        const pFines = finesByPlayer.get(player.id) || { total: 0, unpaid: 0 };

        reports.push({
          playerId: player.id,
          playerName: player.name,
          teamId: team.id,
          teamName: team.name,
          yellowCount: totalYellows,
          secondYellowCount,
          directRedCount,
          redCount: totalReds,
          isSuspended,
          suspensionReason,
          fineTotal: pFines.total,
          unpaidFineTotal: pFines.unpaid,
          needsBtcDecision,
          btcDecision,
          status,
        });
      });
    });

    return reports;
  }

  /**
   * Check if player can participate in a given match.
   */
  static isPlayerEligible(playerId: string, team: Team): { eligible: boolean; reason?: string } {
    const player = team.players.find((p) => p.id === playerId);
    if (!player) return { eligible: false, reason: 'Không tìm thấy cầu thủ trong danh sách đội.' };

    if (player.isSuspended) {
      return {
        eligible: false,
        reason: `🔒 KHÔNG ĐƯỢC THI ĐẤU: ${player.suspensionReason || 'Đang chấp hành án phạt treo giò theo QĐ BTC.'}`,
      };
    }

    return { eligible: true };
  }

  /**
   * Manually update suspension status / direct red decision by Organizer
   */
  static setManualSuspension(
    playerId: string,
    teamId: string,
    isSuspended: boolean,
    reason: string,
    organizerName: string,
    decision?: 'PENDING' | 'SUSPENDED' | 'CLEARED'
  ): void {
    const teams = StorageService.getTeams();
    const team = teams.find((t) => t.id === teamId);
    if (!team) return;

    const player = team.players.find((p) => p.id === playerId);
    if (!player) return;

    player.isSuspended = isSuspended;
    player.suspensionReason = isSuspended ? reason : undefined;

    const overrides = StorageService.getManualSuspensions();
    overrides[playerId] = {
      isSuspended,
      reason: isSuspended ? reason : undefined,
      yellows: player.yellowCards || 0,
      reds: player.redCards || 0,
      decision: decision || (isSuspended ? 'SUSPENDED' : 'CLEARED'),
    };
    StorageService.saveManualSuspensions(overrides);

    StorageService.saveTeams(teams);
    StorageService.logAction(
      organizerName,
      'ORGANIZER',
      isSuspended ? 'BAN HÀNH ÁN TREO GIÒ' : 'GỠ BỎ ÁN TREO GIÒ / CHO ĐÁ TIẾP',
      `Cầu thủ ${player.name} (#${player.jerseyNumber}) - ${team.name}`,
      `Trạng thái: ${isSuspended ? 'Treo giò' : 'Cho phép thi đấu'}. Lý do: ${reason}`
    );
  }
}
