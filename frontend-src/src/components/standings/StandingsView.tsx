'use client';

import React, { useState } from 'react';
import { Team, Match, UserRole, Tournament, getGroupLetters, getSportMeta } from '@/types';
import { RankingEngine } from '@/services/rankingEngine';
import { KnockoutEngine } from '@/services/knockoutEngine';
import { StorageService } from '@/services/storage';
import { AlertTriangle, Dices, ArrowUp, ArrowDown, BookOpen } from 'lucide-react';

interface StandingsViewProps {
  teams: Team[];
  matches: Match[];
  currentRole: UserRole;
  tournament?: Tournament;
  onRefresh: () => void;
}

export const StandingsView: React.FC<StandingsViewProps> = ({
  teams,
  matches,
  currentRole,
  tournament,
  onRefresh,
}) => {
  const isSingleLeague = (tournament?.formatType || 'SINGLE_LEAGUE') === 'SINGLE_LEAGUE';
  const sportType = tournament?.sportType || 'FOOTBALL';
  const sportMeta = getSportMeta(sportType);
  const isSetSport = sportType === 'BADMINTON' || sportType === 'VOLLEYBALL';
  const groups = isSingleLeague ? ['LEAGUE'] : getGroupLetters(tournament?.numberOfGroups || 4);
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');

  // Tie break (Bốc thăm) modal state
  const [tieBreakModalOpen, setTieBreakModalOpen] = useState(false);
  const [tieBreakGroup, setTieBreakGroup] = useState<string>('LEAGUE');
  const [orderedTieBreakIds, setOrderedTieBreakIds] = useState<string[]>([]);
  const [tieBreakReason, setTieBreakReason] = useState<string>('');

  const canResolveTieBreak = currentRole === 'SUPER_ADMIN' || currentRole === 'ORGANIZER';

  const handleOpenTieBreakModal = (group: string, tiedTeamIds: string[]) => {
    setTieBreakGroup(group);
    setOrderedTieBreakIds([...tiedTeamIds]);
    setTieBreakReason(
      isSetSport
        ? 'Các đội bằng điểm và bằng tất cả các chỉ số phụ (Số trận thắng, Hiệu số set, Hiệu số điểm quả/cầu, Đối đầu). Phân định thứ hạng theo kết quả bốc thăm của BTC.'
        : 'Các đội bằng điểm và bằng tất cả các chỉ số phụ (Đối đầu, Hiệu số, Tổng bàn thắng, Thẻ phạt). Phân định thứ hạng theo kết quả bốc thăm của BTC.'
    );
    setTieBreakModalOpen(true);
  };

  const handleRandomDraw = () => {
    const shuffled = [...orderedTieBreakIds];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setOrderedTieBreakIds(shuffled);
    setTieBreakReason(
      `Kết quả bốc thăm ngẫu nhiên trên hệ thống lúc ${new Date().toLocaleTimeString('vi-VN')} bởi BTC.`
    );
  };

  const handleMoveTeam = (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= orderedTieBreakIds.length) return;
    const next = [...orderedTieBreakIds];
    [next[index], next[targetIdx]] = [next[targetIdx], next[index]];
    setOrderedTieBreakIds(next);
  };

  const handleConfirmTieBreak = () => {
    if (orderedTieBreakIds.length < 2 || !tieBreakReason) return;

    RankingEngine.resolveTieBreakOrder(
      tieBreakGroup,
      orderedTieBreakIds,
      tieBreakReason,
      currentRole
    );

    if (!isSingleLeague) {
      const syncedMatches = KnockoutEngine.generateOrUpdateBracket(teams, matches);
      StorageService.saveMatches(syncedMatches);
    }

    setTieBreakModalOpen(false);
    onRefresh();
    alert('Đã lưu kết quả bốc thăm phân định thứ hạng vào hệ thống!');
  };

  const nextStageLabel = isSingleLeague
    ? 'Top 3 nhận Huy chương Nhất – Nhì – Ba'
    : (tournament?.numberOfGroups || 4) === 2
      ? 'Vào Bán kết'
      : 'Vào Tứ kết';

  return (
    <div className="space-y-6">

      {/* Top Header Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 text-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2.5 py-0.5 rounded-full border border-blue-200">
              {sportMeta.icon} RANKING ENGINE ({sportMeta.label.toUpperCase()})
            </span>
            <span className="text-xs text-slate-500">Quy định Cách tính điểm &amp; Xếp hạng</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">
            {isSingleLeague
              ? `Bảng Xếp Hạng Chung Cuộc (Vòng Tròn 1 Lượt • ${teams.length} ${sportMeta.unitShortLabel})`
              : `Bảng Xếp Hạng Vòng Bảng (${groups.length} Bảng: ${groups.join(', ')})`}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {sportType === 'VOLLEYBALL'
              ? 'Chuẩn FIVB: Thắng 2-0/3-0/3-1 = 3đ • Thắng 2-1/3-2 = 2đ • Thua 1-2/2-3 = 1đ • Thua cách biệt = 0đ. Xét: Trận thắng ➔ Hiệu số set ➔ Hiệu số điểm quả ➔ Đối đầu.'
              : sportType === 'BADMINTON'
                ? 'Chuẩn BWF: Thắng = 3đ • Thua = 0đ (không có hòa). Xét: Đối đầu ➔ Hiệu số ván thắng/thua ➔ Hiệu số điểm cầu ➔ Tổng điểm cầu thắng.'
                : 'Thắng 3đ, Hòa 1đ, Thua 0đ. Nếu bằng điểm xét thứ tự: Đối đầu trực tiếp ➔ Hiệu số (+/-) ➔ Tổng bàn thắng ➔ Thẻ phạt (1 thẻ đỏ = 2 thẻ vàng) ➔ Bốc thăm BTC.'}
          </p>
        </div>

        {/* Group Filter Tabs (chỉ hiển thị khi có nhiều bảng) */}
        {!isSingleLeague && (
          <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 self-start md:self-auto flex-wrap">
            <button
              onClick={() => setSelectedGroup('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${selectedGroup === 'ALL'
                ? 'bg-gradient-to-r from-blue-600 to-sky-600 text-white shadow-xs font-black'
                : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              Tất Cả ({groups.length} Bảng)
            </button>
            {groups.map((g) => (
              <button
                key={g}
                onClick={() => setSelectedGroup(g)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${selectedGroup === g
                  ? 'bg-gradient-to-r from-blue-600 to-sky-600 text-white shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                Bảng {g}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tables Grid */}
      <div className={isSingleLeague ? 'grid grid-cols-1 gap-6' : 'grid grid-cols-1 xl:grid-cols-2 gap-6'}>
        {groups
          .filter((g) => isSingleLeague || selectedGroup === 'ALL' || selectedGroup === g)
          .map((grp) => {
            const standings = isSingleLeague
              ? RankingEngine.calculateLeagueStandings(teams, matches, sportType)
              : RankingEngine.calculateGroupStandings(grp, teams, matches, sportType);
            const hasTieBreakIssue = standings.some((s) => s.needsBtcTieBreak);
            const tiedTeamIds = standings.filter((s) => s.needsBtcTieBreak).map((s) => s.teamId);

            return (
              <div
                key={grp}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs text-slate-800"
              >
                {/* Table Header */}
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-blue-100 border border-blue-200 text-blue-700 flex items-center justify-center font-black text-sm">
                      {isSingleLeague ? '🏆' : grp}
                    </span>
                    <div>
                      <h3 className="text-base font-black text-slate-900">
                        {isSingleLeague ? 'BẢNG XẾP HẠNG CHUNG CUỘC GIẢI ĐẤU' : `BẢNG ${grp}`}
                      </h3>
                      <span className="text-[10px] text-slate-500">
                        {isSingleLeague
                          ? 'Hạng 1: Giải Nhất (HCV) • Hạng 2: Giải Nhì (HCB) • Hạng 3: Giải Ba (HCĐ)'
                          : `Top ${tournament?.advancePerGroup || 2} đội giành vé vào Knock-out`}
                      </span>
                    </div>
                  </div>

                  {/* Warning banner for tie-break draw if needed */}
                  {hasTieBreakIssue && (
                    <div className="flex items-center gap-2">
                      <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 animate-pulse">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        <span>CẦN BỐC THĂM</span>
                      </span>

                      {canResolveTieBreak && (
                        <button
                          onClick={() => handleOpenTieBreakModal(grp, tiedTeamIds)}
                          className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1"
                        >
                          <Dices className="w-3.5 h-3.5" />
                          <span>Bốc Thăm</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Table Content */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 text-[11px]">
                      <tr>
                        <th className="py-3 px-3 text-center w-10">STT</th>
                        <th className="py-3 px-3">{sportMeta.unitLabel.toUpperCase()}</th>
                        <th className="py-3 px-2 text-center" title="Số trận đã đấu">ST</th>
                        <th className="py-3 px-2 text-center" title="Số trận thắng">T</th>
                        {!isSetSport && (
                          <th className="py-3 px-2 text-center" title="Hòa (1 điểm)">H</th>
                        )}
                        <th className="py-3 px-2 text-center" title="Số trận thua">B</th>
                        <th className="py-3 px-2 text-center" title={isSetSport ? 'Số set/ván thắng' : 'Tổng bàn thắng'}>
                          {sportType === 'BADMINTON' ? 'VÁN THẮNG' : sportType === 'VOLLEYBALL' ? 'SET THẮNG' : 'BT'}
                        </th>
                        <th className="py-3 px-2 text-center" title={isSetSport ? 'Số set/ván thua' : 'Tổng bàn thua'}>
                          {sportType === 'BADMINTON' ? 'VÁN THUA' : sportType === 'VOLLEYBALL' ? 'SET THUA' : 'BB'}
                        </th>
                        <th className="py-3 px-2 text-center" title={isSetSport ? 'Hiệu số set/ván' : 'Hiệu số (tổng bàn thắng - tổng bàn thua)'}>
                          {sportType === 'BADMINTON' ? 'HS VÁN' : sportType === 'VOLLEYBALL' ? 'HS SET' : '+/-'}
                        </th>
                        {isSetSport ? (
                          <th className="py-3 px-2 text-center" title="Tổng điểm ghi được / thua và hiệu số điểm quả/cầu">
                            {sportType === 'BADMINTON' ? 'ĐIỂM CẦU (+/-)' : 'ĐIỂM QUẢ (+/-)'}
                          </th>
                        ) : (
                          <th className="py-3 px-2 text-center" title="Thẻ phạt vòng bảng (Mỗi thẻ đỏ trực tiếp = 02 thẻ vàng, ít thẻ hơn xếp trên)">THẺ</th>
                        )}
                        <th className="py-3 px-3 text-center font-black text-blue-700" title="Tổng điểm">Đ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {standings.map((team, idx) => {
                        const advanceQuota = isSingleLeague ? 3 : (tournament?.advancePerGroup || 2);
                        const isQualifying = idx < advanceQuota;
                        const isWithdrawn = team.isWithdrawn;
                        const medalBadge =
                          isSingleLeague && idx === 0
                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : isSingleLeague && idx === 1
                              ? 'bg-slate-200 text-slate-800 border-slate-300'
                              : isSingleLeague && idx === 2
                                ? 'bg-orange-100 text-orange-800 border-orange-300'
                                : 'bg-blue-100 text-blue-700 border-blue-200';

                        return (
                          <tr
                            key={team.teamId}
                            className={`transition-colors ${isSingleLeague && idx === 0
                              ? 'bg-amber-50/50 hover:bg-amber-50'
                              : isQualifying
                                ? 'bg-blue-50/30 hover:bg-blue-50/60'
                                : 'hover:bg-slate-50'
                              }`}
                          >
                            <td className="py-3 px-3 text-center">
                              <span
                                className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-bold text-[11px] font-mono border ${isQualifying ? medalBadge : 'text-slate-400 border-transparent'
                                  }`}
                              >
                                {isSingleLeague && idx === 0
                                  ? '🥇'
                                  : isSingleLeague && idx === 1
                                    ? '🥈'
                                    : isSingleLeague && idx === 2
                                      ? '🥉'
                                      : idx + 1}
                              </span>
                            </td>

                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 text-xs">{team.teamName}</span>
                                {isWithdrawn && (
                                  <span className="text-[9px] bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.2 rounded font-bold">
                                    BỎ CUỘC
                                  </span>
                                )}
                                {team.needsBtcTieBreak && (
                                  <span
                                    className="text-amber-500"
                                    title="Bằng điểm, đối đầu, hiệu số, bàn thắng và thẻ phạt — Cần bốc thăm phân hạng"
                                  >
                                    ⚠️
                                  </span>
                                )}
                                {team.btcTieBreakResolved && !team.needsBtcTieBreak && (
                                  <span
                                    className="text-[10px] bg-sky-50 text-sky-700 border border-sky-200 px-1.5 py-0.5 rounded font-bold"
                                    title="Đã phân định thứ hạng bằng bốc thăm"
                                  >
                                    Đã bốc thăm
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="py-3 px-2 text-center font-mono text-slate-600">{team.played}</td>
                            <td className="py-3 px-2 text-center font-mono text-slate-600">{team.won}</td>
                            {!isSetSport && (
                              <td className="py-3 px-2 text-center font-mono text-slate-600">{team.drawn}</td>
                            )}
                            <td className="py-3 px-2 text-center font-mono text-slate-600">{team.lost}</td>
                            <td className="py-3 px-2 text-center font-mono text-slate-600">{team.goalsFor}</td>
                            <td className="py-3 px-2 text-center font-mono text-slate-600">{team.goalsAgainst}</td>
                            <td
                              className={`py-3 px-2 text-center font-mono font-bold ${team.goalDifference > 0
                                ? 'text-blue-600'
                                : team.goalDifference < 0
                                  ? 'text-rose-600'
                                  : 'text-slate-400'
                                }`}
                            >
                              {team.goalDifference > 0 ? `+${team.goalDifference}` : team.goalDifference}
                            </td>
                            {isSetSport ? (
                              <td className="py-3 px-2 text-center font-mono text-[11px] text-slate-700">
                                <span>{team.pointsFor || 0}-{team.pointsAgainst || 0}</span>
                                <span
                                  className={`ml-1 font-bold ${(team.pointsDifference || 0) > 0
                                    ? 'text-blue-600'
                                    : (team.pointsDifference || 0) < 0
                                      ? 'text-rose-600'
                                      : 'text-slate-400'
                                    }`}
                                >
                                  ({(team.pointsDifference || 0) > 0 ? `+${team.pointsDifference}` : (team.pointsDifference || 0)})
                                </span>
                              </td>
                            ) : (
                              <td
                                className="py-3 px-2 text-center font-mono text-[11px]"
                                title={`Điểm thẻ quy đổi: ${team.cardPoints} (${team.yellowCards} thẻ vàng, ${team.redCards} thẻ đỏ trực tiếp × 2)`}
                              >
                                {team.yellowCards === 0 && team.redCards === 0 ? (
                                  <span className="text-slate-300">-</span>
                                ) : (
                                  <span className="inline-flex items-center justify-center gap-1 font-bold">
                                    {team.yellowCards > 0 && (
                                      <span className="text-amber-600">{team.yellowCards}🟨</span>
                                    )}
                                    {team.redCards > 0 && (
                                      <span className="text-rose-600">{team.redCards}🟥</span>
                                    )}
                                  </span>
                                )}
                              </td>
                            )}
                            <td className="py-3 px-3 text-center font-mono font-black text-sm text-blue-700 bg-blue-50/80">
                              {team.points}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Table Footer legend */}
                <div className="p-3 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                    <span>
                      {isSingleLeague
                        ? nextStageLabel
                        : `Top ${tournament?.advancePerGroup || 2}: ${nextStageLabel}`}
                    </span>
                  </div>
                  <span>
                    {sportType === 'VOLLEYBALL'
                      ? 'Trận thắng ➔ Hiệu số set ➔ Hiệu số điểm quả ➔ Đối đầu ➔ Bốc thăm'
                      : sportType === 'BADMINTON'
                        ? 'Đối đầu ➔ Hiệu số ván ➔ Hiệu số điểm cầu ➔ Tổng điểm cầu ➔ Bốc thăm'
                        : 'Đối đầu ➔ Hiệu số ➔ Tổng bàn thắng ➔ Thẻ phạt ➔ Bốc thăm'}
                  </span>
                </div>
              </div>
            );
          })}
      </div>

      {/* Official Regulation Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs text-slate-800">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">
            Quy Định Cách Tính Điểm &amp; Xếp Hạng Chính Thức ({sportMeta.label})
          </h3>
        </div>

        {sportType === 'VOLLEYBALL' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-700">
            <div className="space-y-2">
              <div className="font-bold text-slate-900">Cách tính điểm Bóng Chuyền (Chuẩn FIVB):</div>
              <ul className="space-y-1 pl-4 list-disc">
                <li><strong>Thắng cách biệt (2-0 ở BO3; 3-0 hoặc 3-1 ở BO5):</strong> 3 điểm</li>
                <li><strong>Thắng ở set quyết định (2-1 ở BO3; 3-2 ở BO5):</strong> 2 điểm</li>
                <li><strong>Thua ở set quyết định (1-2 ở BO3; 2-3 ở BO5):</strong> 1 điểm</li>
                <li><strong>Thua cách biệt (0-2; 0-3 hoặc 1-3):</strong> 0 điểm</li>
              </ul>
            </div>
            <div className="space-y-2">
              <div className="font-bold text-slate-900">Thứ tự xét khi hai đội trở lên bằng điểm:</div>
              <ol className="space-y-1 pl-4 list-decimal">
                <li>Tổng số trận thắng.</li>
                <li>Hiệu số set (Set thắng - Set thua).</li>
                <li>Hiệu số điểm quả (Điểm ghi được - Điểm bị ghi).</li>
                <li>Tổng điểm quả ghi được.</li>
                <li>Kết quả đối đầu trực tiếp ➔ Bốc thăm BTC.</li>
              </ol>
            </div>
          </div>
        ) : sportType === 'BADMINTON' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-700">
            <div className="space-y-2">
              <div className="font-bold text-slate-900">Cách tính điểm Cầu Lông (Chuẩn BWF):</div>
              <ul className="space-y-1 pl-4 list-disc">
                <li><strong>Thắng trận:</strong> 3 điểm</li>
                <li><strong>Thua trận:</strong> 0 điểm (không có kết quả hòa)</li>
              </ul>
              <p className="pt-1 text-slate-600">
                Mỗi ván đánh chạm {tournament?.setConfig?.pointsPerSet || 21} điểm (cách biệt 2 điểm, tối đa 30 điểm).
              </p>
            </div>
            <div className="space-y-2">
              <div className="font-bold text-slate-900">Thứ tự xét khi bằng điểm:</div>
              <ol className="space-y-1 pl-4 list-decimal">
                <li>Kết quả đối đầu trực tiếp giữa các đội/cặp bằng điểm.</li>
                <li>Hiệu số ván (Ván thắng - Ván thua).</li>
                <li>Hiệu số điểm cầu (Điểm ghi được - Điểm mất).</li>
                <li>Tổng điểm cầu ghi được ➔ Bốc thăm BTC.</li>
              </ol>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-700">
            <div className="space-y-2">
              <div className="font-bold text-slate-900">Cách tính điểm vòng bảng:</div>
              <ul className="space-y-1 pl-4 list-disc">
                <li><strong>Thắng:</strong> 3 điểm</li>
                <li><strong>Hòa:</strong> 1 điểm</li>
                <li><strong>Thua:</strong> 0 điểm</li>
              </ul>
              <p className="pt-1">
                <strong className="text-slate-900">Xếp hạng:</strong> Tính tổng số điểm của các đội đạt được.
              </p>
              <p className="font-bold text-amber-700 pt-1">
                * Không thi đấu hiệp phụ (hòa ở vòng loại trực tiếp sẽ thi đấu luân lưu 6m).
              </p>
            </div>

            <div className="space-y-2">
              <div className="font-bold text-slate-900">
                * Nếu hai đội trở lên bằng điểm thì trước hết xét chỉ số của các trận đấu giữa các đội đó với nhau theo thứ tự:
              </div>
              <ol className="space-y-1 pl-4 list-decimal">
                <li>Kết quả đối đầu giữa các đội đó với nhau.</li>
                <li>Hiệu số (tổng bàn thắng / tổng bàn thua).</li>
                <li>Tổng bàn thắng.</li>
                <li>
                  Thẻ đỏ, thẻ vàng (mỗi thẻ đỏ trực tiếp tính bằng <strong>02 thẻ vàng</strong>) — đội nào bị ít thẻ hơn sẽ xếp trên.
                </li>
                <li>Bốc thăm.</li>
              </ol>
            </div>
          </div>
        )}
      </div>

      {/* Tie Break Draw Modal */}
      {tieBreakModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl space-y-4 text-slate-800">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Dices className="w-5 h-5 text-amber-500" />
              Bốc Thăm Phân Định Thứ Hạng (Bảng {tieBreakGroup})
            </h3>
            <p className="text-xs text-slate-600">
              Các đội dưới đây có cùng <strong>Điểm số, Đối đầu, Hiệu số, Tổng bàn thắng</strong> và <strong>Thẻ phạt</strong>. Theo điều lệ giải, thứ hạng sẽ được phân định bằng hình thức <strong>Bốc thăm</strong>.
            </p>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Thứ Tự Xếp Hạng (Từ trên xuống dưới)
                </label>
                <button
                  type="button"
                  onClick={handleRandomDraw}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-95"
                >
                  <Dices className="w-3.5 h-3.5" />
                  <span>Bốc Thăm Ngẫu Nhiên</span>
                </button>
              </div>

              <div className="space-y-2">
                {orderedTieBreakIds.map((tId, index) => {
                  const teamObj = teams.find((t) => t.id === tId);
                  return (
                    <div
                      key={tId}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all ${index === 0
                        ? 'bg-blue-50 border-blue-400 text-blue-900 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                        }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-black ${index === 0
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-200 text-slate-700'
                            }`}
                        >
                          {index + 1}
                        </span>
                        <span className="text-sm">{teamObj?.name || tId}</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleMoveTeam(index, -1)}
                          disabled={index === 0}
                          className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-700"
                          title="Xếp lên trên"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveTeam(index, 1)}
                          disabled={index === orderedTieBreakIds.length - 1}
                          className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-700"
                          title="Xếp xuống dưới"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Biên bản / Ghi chú bốc thăm của BTC:
              </label>
              <textarea
                value={tieBreakReason}
                onChange={(e) => setTieBreakReason(e.target.value)}
                rows={3}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl text-xs focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setTieBreakModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700"
              >
                Hủy
              </button>
              <button
                onClick={handleConfirmTieBreak}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-sky-600 text-white text-xs font-bold shadow-xs hover:from-blue-700 hover:to-sky-700"
              >
                Lưu Kết Quả Bốc Thăm
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
