'use client';

import React, { useState, useMemo } from 'react';
import { Team, Match, UserRole, Tournament, PaidFineRecord, FinancialTransaction } from '@/types';
import { DisciplineEngine, CardFineItem } from '@/services/disciplineEngine';
import { StorageService } from '@/services/storage';
import { ShieldAlert, AlertTriangle, Lock, Search, Coins, CheckCircle2, Clock } from 'lucide-react';

interface DisciplineViewProps {
  teams: Team[];
  matches: Match[];
  onTeamsUpdate: (teams: Team[]) => void;
  currentRole: UserRole;
  tournament?: Tournament;
  paidFines?: Record<string, PaidFineRecord>;
  onPaidFinesUpdate?: (paidFines: Record<string, PaidFineRecord>) => void;
  onAddFinanceTx?: (tx: FinancialTransaction) => void;
}

export const DisciplineView: React.FC<DisciplineViewProps> = ({
  teams,
  matches,
  onTeamsUpdate,
  currentRole,
  tournament,
  paidFines: propPaidFines,
  onPaidFinesUpdate,
  onAddFinanceTx,
}) => {
  const isSingleLeague = (tournament?.formatType || 'SINGLE_LEAGUE') === 'SINGLE_LEAGUE';
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'SUSPENDED' | 'PENDING_BTC' | 'WARNING'>('ALL');
  const [activeTab, setActiveTab] = useState<'PLAYERS' | 'FINES'>('PLAYERS');

  // Local fallback state if parent doesn't pass paidFines
  const [localPaidFines, setLocalPaidFines] = useState<Record<string, PaidFineRecord>>(() =>
    StorageService.getPaidFines()
  );
  const currentPaidFines = propPaidFines ?? localPaidFines;

  const persistPaidFines = (nextMap: Record<string, PaidFineRecord>) => {
    setLocalPaidFines(nextMap);
    StorageService.savePaidFines(nextMap);
    if (onPaidFinesUpdate) onPaidFinesUpdate(nextMap);
  };

  // Suspension edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [modalSuspended, setModalSuspended] = useState(true);
  const [modalReason, setModalReason] = useState('');

  const canManage = currentRole === 'SUPER_ADMIN' || currentRole === 'ORGANIZER';

  const reports = useMemo(
    () => DisciplineEngine.evaluateAllPlayers(teams, matches, tournament?.formatType || 'SINGLE_LEAGUE'),
    [teams, matches, tournament?.formatType]
  );

  const fineSummary = useMemo(
    () => DisciplineEngine.calculateCardFines(matches, teams, currentPaidFines),
    [matches, teams, currentPaidFines]
  );

  const filteredReports = reports.filter((r) => {
    if (filterStatus === 'SUSPENDED' && !r.isSuspended) return false;
    if (filterStatus === 'PENDING_BTC' && !r.needsBtcDecision) return false;
    if (filterStatus === 'WARNING' && r.yellowCount === 0 && r.redCount === 0) return false;
    if (
      searchQuery &&
      !r.playerName.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !r.teamName.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const filteredFines = fineSummary.items.filter((it) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return it.playerName.toLowerCase().includes(q) || it.teamName.toLowerCase().includes(q);
  });

  const handleOpenModal = (playerId: string, teamId: string, currentSuspended: boolean, reason?: string) => {
    setSelectedPlayerId(playerId);
    setSelectedTeamId(teamId);
    setModalSuspended(!currentSuspended);
    setModalReason(reason || 'Quyết định kỷ luật của Ban Tổ Chức');
    setModalOpen(true);
  };

  const handleQuickRedDecision = (playerId: string, teamId: string, suspendNext: boolean) => {
    const reason = suspendNext
      ? 'Thẻ đỏ trực tiếp — BTC quyết định đình chỉ trận đấu tiếp theo'
      : 'Thẻ đỏ trực tiếp — BTC quyết định chỉ phạt tiền 100.000đ, cho phép thi đấu trận tiếp theo';
    DisciplineEngine.setManualSuspension(
      playerId,
      teamId,
      suspendNext,
      reason,
      currentRole,
      suspendNext ? 'SUSPENDED' : 'CLEARED'
    );
    const updated = StorageService.getTeams();
    onTeamsUpdate(updated);
  };

  const handleSaveSuspension = () => {
    if (!selectedPlayerId || !selectedTeamId) return;

    DisciplineEngine.setManualSuspension(
      selectedPlayerId,
      selectedTeamId,
      modalSuspended,
      modalReason,
      currentRole,
      modalSuspended ? 'SUSPENDED' : 'CLEARED'
    );

    const updated = StorageService.getTeams();
    onTeamsUpdate(updated);
    setModalOpen(false);
  };

  const handleToggleFinePaid = (item: CardFineItem, recordIntoFinance: boolean = false) => {
    if (!canManage) return;
    const nextPaid = !item.paid;
    const nextMap: Record<string, PaidFineRecord> = {
      ...currentPaidFines,
      [item.fineId]: {
        paid: nextPaid,
        paidAt: nextPaid ? new Date().toISOString() : undefined,
        amount: item.amount,
        teamId: item.teamId,
        playerName: item.playerName,
        note: item.label,
      },
    };
    persistPaidFines(nextMap);

    if (nextPaid && recordIntoFinance) {
      const tx: FinancialTransaction = {
        id: `FIN-CARD-${Date.now()}`,
        type: 'INCOME',
        category: 'OTHER',
        categoryName: `Thu phạt thẻ (${item.label})`,
        amount: item.amount,
        date: new Date().toISOString().split('T')[0],
        description: `Thu tiền phạt ${item.label} của cầu thủ ${item.playerName} (${item.teamName}) - Trận #${item.matchNumber}`,
        recipientOrPayer: `${item.teamName} (${item.playerName})`,
      };
      if (onAddFinanceTx) {
        onAddFinanceTx(tx);
      } else {
        const curFin = StorageService.getFinances();
        StorageService.saveFinances([tx, ...curFin]);
      }
      StorageService.logAction(
        currentRole,
        currentRole,
        'THU TIỀN PHẠT THẺ VÀO QUỸ GIẢI',
        item.teamName,
        `Thu ${item.amount.toLocaleString('vi-VN')}đ phạt ${item.label} - ${item.playerName} (Trận #${item.matchNumber})`
      );
      alert(`Đã đánh dấu ĐÃ NỘP và ghi nhận ${item.amount.toLocaleString('vi-VN')}đ vào Sổ Thu Chi Tài Chính!`);
    }
  };

  const totalSuspended = reports.filter((r) => r.isSuspended).length;
  const totalPendingBtc = reports.filter((r) => r.needsBtcDecision).length;
  const totalWithCards = reports.filter((r) => r.yellowCount > 0 || r.redCount > 0).length;

  return (
    <div className="space-y-6">

      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2.5 py-0.5 rounded-full border border-blue-200">
              {isSingleLeague ? 'KỶ LUẬT & TIỀN PHẠT THẺ CTUT' : 'DISCIPLINE & SUSPENSION ENGINE'}
            </span>
            {isSingleLeague && (
              <span className="text-xs text-slate-500 font-medium">
                Thẻ vàng 20k • 2 vàng/trận 50k • Thẻ đỏ trực tiếp 100k
              </span>
            )}
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">
            {isSingleLeague ? 'Quản Lý Thẻ Phạt, Tiền Phạt & Quyết Định BTC' : 'Quản Lý Thẻ Phạt & Án Treo Giò Tích Lũy'}
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            {isSingleLeague
              ? 'Thẻ vàng: phạt 20.000đ/thẻ. 02 thẻ vàng cùng 01 trận: truất quyền trận đó + phạt 50.000đ. Thẻ đỏ trực tiếp: phạt 100.000đ, truất quyền ngay và BTC quyết định có đình chỉ trận sau hay không.'
              : 'Cầu thủ nhận đủ 02 thẻ vàng trong toàn giải bị treo giò 01 trận tiếp theo.'}
          </p>
        </div>

        {/* Metric Badges */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="px-4 py-2.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center gap-2 shadow-xs">
            <Coins className="w-4 h-4 text-amber-600" />
            <div>
              <span className="text-[10px] text-amber-700 block uppercase font-bold">Tổng Phạt Thẻ</span>
              <span className="text-base font-black font-mono text-amber-900">
                {fineSummary.totalAmount.toLocaleString('vi-VN')}đ
              </span>
            </div>
          </div>

          {totalPendingBtc > 0 && (
            <div className="px-4 py-2.5 rounded-2xl bg-orange-50 border border-orange-300 text-orange-800 flex items-center gap-2 shadow-xs animate-pulse">
              <Clock className="w-4 h-4 text-orange-600" />
              <div>
                <span className="text-[10px] text-orange-700 block uppercase font-bold">Chờ BTC Xét Đỏ</span>
                <span className="text-base font-black font-mono text-orange-900">{totalPendingBtc} Ca</span>
              </div>
            </div>
          )}

          <div className="px-4 py-2.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2 shadow-xs">
            <Lock className="w-4 h-4 text-rose-600" />
            <div>
              <span className="text-[10px] text-rose-700 block uppercase font-bold">Đang Treo Giò</span>
              <span className="text-base font-black font-mono text-rose-900">{totalSuspended} Cầu Thủ</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mode Switcher + Search */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('PLAYERS')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all ${activeTab === 'PLAYERS'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900'
              }`}
          >
            Danh Sách Cầu Thủ &amp; Án Phạt ({totalWithCards})
          </button>
          <button
            onClick={() => setActiveTab('FINES')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${activeTab === 'FINES'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
              }`}
          >
            <Coins className="w-3.5 h-3.5" />
            <span>Theo Dõi Thu Tiền Phạt ({fineSummary.items.length})</span>
            {fineSummary.unpaidAmount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-mono">
                Còn {fineSummary.unpaidAmount.toLocaleString('vi-VN')}đ
              </span>
            )}
          </button>
        </div>

        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên cầu thủ hoặc tên đội..."
            className="w-full bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-xs rounded-xl pl-9 pr-3 py-2.5 focus:border-blue-500 focus:bg-white focus:outline-none"
          />
        </div>

        {activeTab === 'PLAYERS' && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              onClick={() => setFilterStatus('ALL')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all ${filterStatus === 'ALL'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
                }`}
            >
              Tất Cả ({totalWithCards})
            </button>
            {isSingleLeague && (
              <button
                onClick={() => setFilterStatus('PENDING_BTC')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all ${filterStatus === 'PENDING_BTC'
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'bg-orange-50 text-orange-800 border border-orange-200'
                  }`}
              >
                Chờ BTC Xét Đỏ ({totalPendingBtc})
              </button>
            )}
            <button
              onClick={() => setFilterStatus('SUSPENDED')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all ${filterStatus === 'SUSPENDED'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                }`}
            >
              Đang Treo Giò ({totalSuspended})
            </button>
          </div>
        )}
      </div>

      {activeTab === 'PLAYERS' ? (
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[11px]">
                <tr>
                  <th className="py-3 px-4">CẦU THỦ</th>
                  <th className="py-3 px-4">ĐỘI BÓNG</th>
                  <th className="py-3 px-3 text-center">VÀNG 🟨</th>
                  <th className="py-3 px-3 text-center">ĐỎ / 2V 🟥</th>
                  <th className="py-3 px-3 text-right">TIỀN PHẠT</th>
                  <th className="py-3 px-4">TRẠNG THÁI &amp; ÁN PHẠT</th>
                  <th className="py-3 px-4"> QUYẾT ĐỊNH</th>
                  {canManage && <th className="py-3 px-4 text-center">THAO TÁC</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReports
                  .filter((r) => r.yellowCount > 0 || r.redCount > 0 || r.isSuspended)
                  .map((r) => (
                    <tr key={r.playerId} className="hover:bg-blue-50/40 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">{r.playerName}</td>
                      <td className="py-3.5 px-4 text-slate-600">{r.teamName}</td>
                      <td className="py-3.5 px-3 text-center font-mono font-black text-amber-600">{r.yellowCount}</td>
                      <td className="py-3.5 px-3 text-center font-mono font-black text-rose-600">{r.redCount}</td>
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-800">
                        {r.fineTotal > 0 ? `${r.fineTotal.toLocaleString('vi-VN')}đ` : '0đ'}
                      </td>

                      <td className="py-3.5 px-4">
                        {r.isSuspended ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-black text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1 rounded-full">
                            <Lock className="w-3 h-3 text-rose-600" />
                            TREO GIÒ
                          </span>
                        ) : r.needsBtcDecision ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-black text-orange-800 bg-orange-50 border border-orange-300 px-3 py-1 rounded-full">
                            <Clock className="w-3 h-3 text-orange-600" />
                            CHỜ BTC XÉT THẺ ĐỎ
                          </span>
                        ) : r.yellowCount > 0 || r.redCount > 0 ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            ĐƯỢC ĐÁ (ĐÃ GHI THẺ)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                            ✓ ĐỦ ĐIỀU KIỆN
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-500 text-xs max-w-[240px]">
                        {r.suspensionReason ||
                          (r.needsBtcDecision
                            ? 'Thẻ đỏ trực tiếp — cần BTC quyết định đình chỉ trận sau hay không'
                            : r.secondYellowCount > 0
                              ? '2 thẻ vàng cùng 1 trận (truất quyền trong trận đó, không treo giò trận sau)'
                              : 'Bị phạt tiền thẻ theo điều lệ')}
                      </td>

                      {canManage && (
                        <td className="py-3.5 px-4 text-center">
                          {r.needsBtcDecision ? (
                            <div className="flex flex-wrap items-center justify-center gap-1">
                              <button
                                onClick={() => handleQuickRedDecision(r.playerId, r.teamId, true)}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-600 hover:bg-rose-700 text-white"
                              >
                                Treo giò trận sau
                              </button>
                              <button
                                onClick={() => handleQuickRedDecision(r.playerId, r.teamId, false)}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                              >
                                Chỉ phạt tiền
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() =>
                                handleOpenModal(
                                  r.playerId,
                                  r.teamId,
                                  r.isSuspended,
                                  r.suspensionReason
                                )
                              }
                              className="px-3 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
                            >
                              {r.isSuspended ? 'Gỡ Phạt' : 'Điều chỉnh'}
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
              </tbody>
            </table>
            {filteredReports.filter((r) => r.yellowCount > 0 || r.redCount > 0 || r.isSuspended).length === 0 && (
              <div className="p-10 text-center text-xs text-slate-500">
                Chưa có cầu thủ nào nhận thẻ hoặc vi phạm kỷ luật.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Team Summary Cards */}
          {fineSummary.byTeam.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {fineSummary.byTeam.map((tf) => (
                <div key={tf.teamId} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-1.5 text-xs">
                  <div className="font-black text-slate-900 truncate">{tf.teamName}</div>
                  <div className="text-[11px] text-slate-500">
                    {tf.yellowCount} Vàng • {tf.secondYellowCount} (2V/trận) • {tf.redCount} Đỏ trực tiếp
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 font-mono font-bold">
                    <span className="text-slate-700">Tổng: {tf.totalAmount.toLocaleString('vi-VN')}đ</span>
                    <span className={tf.unpaidAmount > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                      {tf.unpaidAmount > 0 ? `Nợ ${tf.unpaidAmount.toLocaleString('vi-VN')}đ` : 'Đã nộp đủ ✓'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Detailed Fines Table */}
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="py-3 px-4">TRẬN ĐẤU</th>
                    <th className="py-3 px-4">ĐỘI BÓNG</th>
                    <th className="py-3 px-4">CẦU THỦ</th>
                    <th className="py-3 px-4">HÌNH THỨC PHẠT</th>
                    <th className="py-3 px-4 text-right">SỐ TIỀN PHẠT</th>
                    <th className="py-3 px-4 text-center">TRẠNG THÁI</th>
                    {canManage && <th className="py-3 px-4 text-center">THAO TÁC THU PHẠT</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredFines.map((it) => (
                    <tr key={it.fineId} className="hover:bg-amber-50/30 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-700">
                        <span className="font-bold">#{it.matchNumber}</span> ({it.roundLabel})
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">{it.teamName}</td>
                      <td className="py-3 px-4 text-slate-800 font-semibold">
                        {it.jerseyNumber ? `#${it.jerseyNumber} ` : ''}{it.playerName}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${it.fineType === 'RED'
                              ? 'bg-rose-50 text-rose-800 border-rose-200'
                              : it.fineType === 'SECOND_YELLOW'
                                ? 'bg-orange-50 text-orange-800 border-orange-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                        >
                          {it.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black text-slate-900">
                        {it.amount.toLocaleString('vi-VN')}đ
                      </td>
                      <td className="py-3 px-4 text-center">
                        {it.paid ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" /> Đã nộp
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full">
                            Chưa nộp
                          </span>
                        )}
                      </td>
                      {canManage && (
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {!it.paid ? (
                              <>
                                <button
                                  onClick={() => handleToggleFinePaid(it, true)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold"
                                  title="Đánh dấu đã nộp và ghi tự động vào Thu Chi Tài Chính"
                                >
                                  Thu vào Tài chính
                                </button>
                                <button
                                  onClick={() => handleToggleFinePaid(it, false)}
                                  className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold"
                                >
                                  Đánh dấu đã thu
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => handleToggleFinePaid(it, false)}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px]"
                              >
                                Hoàn trạng thái
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredFines.length === 0 && (
                <div className="p-10 text-center text-xs text-slate-500">
                  Chưa phát sinh khoản tiền phạt thẻ nào.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Disciplinary Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl space-y-4 text-slate-800">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
              Điều Chỉnh Quyết Định Kỷ Luật BTC
            </h3>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Trạng Thái Thi Đấu
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setModalSuspended(true)}
                  className={`p-2.5 rounded-xl text-xs font-bold border transition-colors ${modalSuspended
                      ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                >
                  🔒 Ban Hành Án Treo Giò
                </button>
                <button
                  type="button"
                  onClick={() => setModalSuspended(false)}
                  className={`p-2.5 rounded-xl text-xs font-bold border transition-colors ${!modalSuspended
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                >
                  ✓ Cho Phép Thi Đấu (Gỡ Án)
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Lý Do / Quyết Định BTC
              </label>
              <textarea
                rows={3}
                value={modalReason}
                onChange={(e) => setModalReason(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl p-2.5 focus:border-blue-500 focus:bg-white focus:outline-none"
              ></textarea>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-semibold border border-slate-200"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveSuspension}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-bold shadow-xs"
              >
                Lưu Quyết Định &amp; Ghi Audit Log
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
