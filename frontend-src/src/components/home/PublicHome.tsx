'use client';

import React from 'react';
import { Match, Team, FinancialTransaction, Complaint, UserRole, Tournament, getSportMeta, formatMatchSetsCompact, getEffectiveSetConfig } from '@/types';
import { TabKey } from '../layout/Navigation';
import {
  Trophy,
  Radio,
  Calendar,
  Users,
  Flame,
  Sparkles,
  ShieldAlert,
  Clock,
  BadgeDollarSign,
  ArrowRight,
  TrendingUp,
  Shirt,
  Play,
  MapPin,
  CheckCircle2
} from 'lucide-react';

interface PublicHomeProps {
  teams: Team[];
  matches: Match[];
  finances: FinancialTransaction[];
  complaints: Complaint[];
  onNavigate: (tab: TabKey) => void;
  onSelectMatch: (matchId: string) => void;
  currentRole: UserRole;
  tournament?: Tournament;
}

export const PublicHome: React.FC<PublicHomeProps> = ({
  teams,
  matches,
  finances,
  complaints,
  onNavigate,
  onSelectMatch,
  currentRole,
  tournament,
}) => {
  const sportType = tournament?.sportType || 'FOOTBALL';
  const sportMeta = getSportMeta(sportType);
  const isSetSport = sportMeta.isSetSport;
  const setConfig = getEffectiveSetConfig(tournament);

  const liveMatches = matches.filter((m) => m.status === 'LIVE');
  const finishedMatches = matches.filter((m) => m.status === 'FINISHED');
  const scheduledMatches = matches.filter((m) => m.status === 'SCHEDULED');

  const totalMatchPoints = matches.reduce((sum, m) => {
    if (!Array.isArray(m.sets)) return sum;
    return sum + m.sets.reduce((sSum, s) => sSum + (Number(s.homePoints) || 0) + (Number(s.awayPoints) || 0), 0);
  }, 0);

  // Trận Cầu Nổi Bật & Đang Diễn Ra: Ưu tiên trận LIVE và trận sắp đá (SCHEDULED)
  const featuredMatches = [
    ...liveMatches,
    ...scheduledMatches.sort((a, b) => {
      const dateComp = (a.date || '').localeCompare(b.date || '');
      if (dateComp !== 0) return dateComp;
      return (a.time || '').localeCompare(b.time || '');
    }),
  ];

  const totalGoals = matches.reduce(
    (sum, m) => sum + (m.status === 'FINISHED' || m.status === 'LIVE' ? m.homeScore + m.awayScore : 0),
    0
  );

  const totalYellowCards = matches.reduce((sum, m) => {
    return sum + m.events.filter((e) => e.type === 'CARD' && e.cardType === 'YELLOW').length;
  }, 0);

  const totalRedCards = matches.reduce((sum, m) => {
    return sum + m.events.filter((e) => e.type === 'CARD' && (e.cardType === 'RED' || e.cardType === 'SECOND_YELLOW')).length;
  }, 0);

  const totalIncome = finances
    .filter((f) => f.type === 'INCOME')
    .reduce((sum, f) => sum + f.amount, 0);

  const totalExpense = finances
    .filter((f) => f.type === 'EXPENSE')
    .reduce((sum, f) => sum + f.amount, 0);

  // Top scorers (Golden Boot)
  const allPlayers = teams.flatMap((t) => t.players);
  const topScorers = [...allPlayers]
    .filter((p) => p.goals > 0)
    .sort((a, b) => b.goals - a.goals)
    .slice(0, 5);

  const getTeam = (teamId: string) => teams.find((t) => t.id === teamId);

  return (
    <div className="space-y-8">

      {/* Hero Stadium Banner in Clean Ocean Blue */}
      <div className="relative rounded-3xl overflow-hidden border border-blue-500/30 bg-gradient-to-br from-blue-700 via-sky-600 to-blue-800 text-white p-6 sm:p-12 shadow-xl">
        {/* Action Photo Background */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20 transform scale-105 pointer-events-none"
          style={{ backgroundImage: `url('/images/futsal-action.jpg')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900/90 via-blue-800/80 to-sky-700/60 pointer-events-none" />

        {/* Ambient glow */}
        <div className="absolute -right-20 -bottom-20 w-96 h-96 bg-sky-400/25 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -left-20 -top-20 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl pointer-events-none"></div>

        {/* Tactical pitch watermark */}
        <div className="absolute -right-10 top-0 bottom-0 w-80 opacity-15 pointer-events-none overflow-hidden">
          <svg viewBox="0 0 300 300" className="w-full h-full stroke-sky-200" fill="none">
            <rect x="20" y="20" width="260" height="260" rx="8" strokeWidth="2" />
            <circle cx="150" cy="150" r="70" strokeWidth="2" />
            <circle cx="150" cy="150" r="4" fill="#FFFFFF" />
            <line x1="20" y1="150" x2="280" y2="150" strokeWidth="1.5" strokeDasharray="4 4" />
          </svg>
        </div>

        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-white/20 border border-white/30 text-white text-xs font-black px-3.5 py-1.5 rounded-full uppercase tracking-wider mb-4 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 animate-bounce text-amber-300" />
            <span>{tournament?.shortCode || 'ITFTMS'} • {tournament?.year || 2026} • {tournament?.organizer || 'KHOA CÔNG NGHỆ THÔNG TIN'}</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-none mb-4 uppercase">
            {tournament?.name || 'GIẢI BÓNG ĐÁ SINH VIÊN CNTT 2026'}
          </h1>

          <p className="text-sm sm:text-base text-blue-100 leading-relaxed mb-6 font-normal">
            Chào mừng đến với cổng thông tin điện tử chính thức của <strong className="text-white font-bold">{tournament?.name || `Giải ${sportMeta.label} Khoa Công nghệ Thông tin 2026`}</strong>.
            Nơi hội tụ <strong className="text-sky-200 font-bold">{teams.length > 0 ? `${teams.length} ${sportMeta.unitShortLabel.toLowerCase()}` : `${tournament?.maxTeams || 12} ${sportMeta.unitShortLabel.toLowerCase()}`}</strong> xuất sắc, <strong className="text-cyan-200 font-bold">{allPlayers.length > 0 ? `${allPlayers.length} ${sportMeta.playerLabel.toLowerCase()} sinh viên` : `các ${sportMeta.playerLabel.toLowerCase()} sinh viên`}</strong> tranh tài qua <strong className="text-amber-300 font-bold">{matches.length > 0 ? `${matches.length} trận đấu` : 'các trận đấu'}</strong> trên {tournament?.numberOfVenues || 3} {sportMeta.venueLabel.toLowerCase()}.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => onNavigate('live')}
              className="flex items-center gap-2 min-h-[44px] px-6 py-3 rounded-2xl bg-white text-blue-800 hover:bg-blue-50 font-black text-xs sm:text-sm shadow-lg transition-all transform hover:-translate-y-0.5 active:scale-95"
            >
              <Radio className="w-4 h-4 text-red-600 animate-pulse" />
              <span>Xem Trực Tiếp (Live Match Center)</span>
            </button>

            <button
              onClick={() => onNavigate('standings')}
              className="flex items-center gap-2 min-h-[44px] px-6 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm border border-white/30 transition-all active:scale-95 shadow-sm"
            >
              <Trophy className="w-4 h-4 text-amber-300" />
              <span>
                {(tournament?.formatType || 'SINGLE_LEAGUE') === 'SINGLE_LEAGUE'
                  ? 'Bảng Xếp Hạng Chung Cuộc'
                  : `Bảng Xếp Hạng ${tournament?.numberOfGroups || 4} Bảng`}
              </span>
            </button>

            {(tournament?.formatType || 'SINGLE_LEAGUE') === 'SINGLE_LEAGUE' ? (
              <button
                onClick={() => onNavigate('schedule')}
                className="flex items-center gap-2 min-h-[44px] px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm border border-white/30 transition-all active:scale-95"
              >
                <span>Lịch Thi Đấu Sinh Viên</span>
                <ArrowRight className="w-4 h-4 text-sky-200" />
              </button>
            ) : (
              <button
                onClick={() => onNavigate('bracket')}
                className="flex items-center gap-2 min-h-[44px] px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm border border-white/30 transition-all active:scale-95"
              >
                <span>Nhánh Knockout</span>
                <ArrowRight className="w-4 h-4 text-sky-200" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Specification #31: BTC Dashboard Cards Bar - Crisp Solid White Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-700">
              CHỈ SỐ TỔNG THỂ GIẢI ĐẤU
            </h3>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">Cập nhật tự động thời gian thực</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-slate-900">

          <div className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-blue-300 flex flex-col justify-between shadow-xs transition-all hover:-translate-y-0.5">
            <span className="text-[10px] uppercase font-bold text-slate-500">Số {sportMeta.unitShortLabel}</span>
            <span className="text-2xl font-black font-mono text-slate-900 mt-1">{teams.length} {sportMeta.unitShortLabel.toUpperCase()}</span>
            <span className="text-[10px] text-blue-600 font-bold">{tournament?.numberOfGroups || 1} Bảng Đấu</span>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-blue-300 flex flex-col justify-between shadow-xs transition-all hover:-translate-y-0.5">
            <span className="text-[10px] uppercase font-bold text-slate-500">Tổng {sportMeta.playerLabel}</span>
            <span className="text-2xl font-black font-mono text-cyan-600 mt-1">
              {teams.reduce((sum, t) => sum + t.players.length, 0)}
            </span>
            <span className="text-[10px] text-slate-500">Tối đa {tournament?.maxPlayersPerTeam || 12}/đội</span>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-blue-300 flex flex-col justify-between shadow-xs transition-all hover:-translate-y-0.5">
            <span className="text-[10px] uppercase font-bold text-slate-500">Tổng Số Trận</span>
            <span className="text-2xl font-black font-mono text-amber-600 mt-1">{matches.length} TRẬN</span>
            <span className="text-[10px] text-slate-500">
              {matches.filter((m) => m.round === 'GROUP').length} Vòng bảng + {matches.filter((m) => m.round !== 'GROUP').length} KO
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-blue-300 flex flex-col justify-between shadow-xs transition-all hover:-translate-y-0.5">
            <span className="text-[10px] uppercase font-bold text-slate-500">{isSetSport ? 'Tổng Set Đấu' : 'Bàn Thắng'}</span>
            <span className="text-2xl font-black font-mono text-blue-600 mt-1">
              {totalGoals} {sportMeta.icon}
            </span>
            <span className="text-[10px] text-slate-500">{finishedMatches.length} trận hoàn tất</span>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-blue-300 flex flex-col justify-between shadow-xs transition-all hover:-translate-y-0.5">
            <span className="text-[10px] uppercase font-bold text-slate-500">{isSetSport ? 'Tổng Điểm Set' : 'Thẻ Phạt'}</span>
            {isSetSport ? (
              <>
                <span className="text-2xl font-black font-mono text-emerald-600 mt-1">{totalMatchPoints}</span>
                <span className="text-[10px] text-slate-500">BO{setConfig.bestOf} • {setConfig.pointsPerSet}đ/set</span>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-lg font-black font-mono text-amber-600">{totalYellowCards}🟨</span>
                  <span className="text-lg font-black font-mono text-red-600">{totalRedCards}🟥</span>
                </div>
                <span className="text-[10px] text-slate-500">Tích lũy 2 thẻ = Treo</span>
              </>
            )}
          </div>

          {(currentRole === 'SUPER_ADMIN' || currentRole === 'ORGANIZER') ? (
            <div className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-blue-300 flex flex-col justify-between shadow-xs transition-all hover:-translate-y-0.5">
              <span className="text-[10px] uppercase font-bold text-slate-500">Tài Chính Quỹ (BTC)</span>
              <span className="text-base font-black font-mono text-blue-600 mt-1">
                {(totalIncome - totalExpense).toLocaleString()} đ
              </span>
              <span className="text-[10px] text-slate-500">Thu {(totalIncome / 1000000).toFixed(1)}M / Chi {(totalExpense / 1000000).toFixed(1)}M</span>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-blue-300 flex flex-col justify-between shadow-xs transition-all hover:-translate-y-0.5">
              <span className="text-[10px] uppercase font-bold text-slate-500">{isSetSport ? 'Tiến Độ Thi Đấu' : 'Hiệu Suất Ghi Bàn'}</span>
              <span className="text-xl font-black font-mono text-blue-600 mt-1">
                {isSetSport
                  ? `${finishedMatches.length}/${matches.length} trận`
                  : `${finishedMatches.length > 0 ? (totalGoals / finishedMatches.length).toFixed(1) : '0.0'} ⚽/trận`}
              </span>
              <span className="text-[10px] text-slate-500">{finishedMatches.length}/{matches.length} trận đã diễn ra</span>
            </div>
          )}

        </div>
      </div>

      {/* Two Columns: Live / Featured Matches & Golden Boot Race */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Column: Live / Featured Matches (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-red-600" />
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">
                Trận Đang Diễn Ra
              </h3>
            </div>
            <button
              onClick={() => onNavigate('schedule')}
              className="min-h-[44px] px-3 text-xs text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1 active:scale-95"
            >
              <span>Xem tất cả lịch</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {featuredMatches.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-3xl p-6 text-center space-y-3 shadow-xs">
                <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center mx-auto text-blue-600">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Toàn bộ các trận đấu đã hoàn tất</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Không có trận đấu nào đang đá hoặc sắp diễn ra. Tất cả {finishedMatches.length} trận đấu đã kết thúc và có tỉ số chính thức.
                  </p>
                </div>
                <button
                  onClick={() => onNavigate('schedule')}
                  className="inline-flex items-center gap-1.5 min-h-[44px] px-5 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold transition-all shadow-xs active:scale-95"
                >
                  <span>Xem Toàn Bộ Kết Quả &amp; BXH</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              featuredMatches.slice(0, 4).map((m) => {
                const home = getTeam(m.homeTeamId);
                const away = getTeam(m.awayTeamId);

                return (
                  <div
                    key={m.id}
                    onClick={() => {
                      onSelectMatch(m.id);
                    }}
                    className="bg-white border border-slate-200 hover:border-blue-400 rounded-2xl p-4 sm:p-5 shadow-xs transition-all cursor-pointer hover:shadow-md active:scale-[0.99] group text-slate-900"
                  >
                    <div className="flex items-center justify-between text-[11px] mb-2 text-slate-500 gap-1.5 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[10px] border border-slate-200">
                          #{m.matchNumber || m.id}
                        </span>
                        <span className="font-bold text-blue-700">{m.roundLabel}</span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-black bg-sky-50 text-sky-700 border border-sky-200">
                          <MapPin className="w-3 h-3 text-sky-600 shrink-0" />
                          <span>{(m.venueName ? m.venueName.match(/Sân\s*\d+/i)?.[0] || m.venueName.split(' - ')[0] : 'Sân 1').toUpperCase()}</span>
                        </span>
                      </div>

                      {m.status === 'LIVE' ? (
                        <span className="bg-red-50 text-red-600 border border-red-200 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 animate-pulse text-[10px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>
                          {isSetSport ? `LIVE SET ${m.currentSet || 1}` : `LIVE ${m.currentMinute}'`}
                        </span>
                      ) : (
                        <span className="text-slate-600 font-mono text-[10px] bg-slate-50 px-2 py-0.5 rounded border border-slate-200 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-blue-600" />
                          <span>{m.time} • {m.date}</span>
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-7 items-center py-2">
                      <div className="col-span-3 text-right">
                        <span className="text-xs sm:text-sm font-bold text-slate-900 block truncate group-hover:text-blue-600 transition-colors">
                          {home?.name || 'TBD'}
                        </span>
                        <span className="text-[10px] text-slate-500">Lớp {home?.class}</span>
                      </div>

                      <div className="col-span-1 text-center font-mono font-black text-lg sm:text-xl text-blue-600">
                        <div>
                          {m.status === 'LIVE'
                            ? `${m.homeScore} - ${m.awayScore}`
                            : 'VS'}
                        </div>
                        {isSetSport && formatMatchSetsCompact(m) && (
                          <div className="text-[10px] font-semibold text-emerald-700 whitespace-nowrap">
                            ({formatMatchSetsCompact(m)})
                          </div>
                        )}
                      </div>

                      <div className="col-span-3 text-left">
                        <span className="text-xs sm:text-sm font-bold text-slate-900 block truncate group-hover:text-blue-600 transition-colors">
                          {away?.name || 'TBD'}
                        </span>
                        <span className="text-[10px] text-slate-500">Lớp {away?.class}</span>
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1 font-semibold text-slate-600 truncate max-w-[200px]" title={m.venueName || 'Sân 1'}>
                        <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span className="truncate">{m.venueName || 'Sân 1 - Cỏ Nhân Tạo KTX'}</span>
                      </span>
                      <span className="text-blue-600 font-bold flex items-center gap-1 text-[11px] shrink-0 group-hover:translate-x-0.5 transition-transform">
                        <span>{m.status === 'LIVE' ? 'Xem Trực Tiếp (Live)' : 'Chi Tiết Trận Đấu'}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Golden Boot (Football) or Sport Rules Overview (Badminton/Volleyball) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex flex-col justify-between overflow-hidden text-slate-900">
          <div>
            {isSetSport ? (
              <div className="mb-4 p-4 rounded-2xl bg-gradient-to-br from-blue-700 via-sky-600 to-cyan-600 text-white shadow-sm">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                    <span className="text-lg">{sportMeta.icon}</span>
                    <span>Quy Chế {sportMeta.label}</span>
                  </span>
                  <span className="text-[11px] font-mono font-bold bg-white/20 px-2 py-0.5 rounded-lg">
                    BO{setConfig.bestOf}
                  </span>
                </div>
                <p className="text-xs text-blue-100 leading-relaxed">
                  {sportType === 'VOLLEYBALL'
                    ? `Mỗi trận đấu tối đa ${setConfig.bestOf} set (${setConfig.pointsPerSet} điểm, set quyết định ${setConfig.decidingSetPoints} điểm). Xếp hạng theo điểm trận chuẩn FIVB.`
                    : `Mỗi trận đấu tối đa ${setConfig.bestOf} ván (${setConfig.pointsPerSet} điểm, tối đa 30 điểm). Xếp hạng theo chuẩn BWF (thắng 3đ, thua 0đ).`}
                </p>
              </div>
            ) : (
              <>
                {/* Golden Boot Award Banner Photo */}
                <div className="relative h-28 -mx-5 -mt-5 mb-4 overflow-hidden rounded-t-3xl">
                  <img
                    src="/images/golden-boot.jpg"
                    alt="Golden Boot Award"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />
                  <div className="absolute bottom-2.5 left-4 right-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-amber-400 drop-shadow" />
                      <h3 className="text-sm font-black uppercase tracking-wider text-white drop-shadow">
                        Đua Vua Phá Lưới (Golden Boot)
                      </h3>
                    </div>
                    <span className="text-xs font-mono font-bold text-amber-300 bg-black/60 px-2 py-0.5 rounded border border-amber-500/40">
                      Điều 25
                    </span>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {topScorers.length === 0 ? (
                    <div className="text-xs text-slate-500 text-center py-6">Chưa có cầu thủ ghi bàn</div>
                  ) : (
                    topScorers.map((p, idx) => {
                      const team = getTeam(p.teamId);
                      return (
                        <div
                          key={p.id}
                          className="p-3 min-h-[44px] rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between hover:border-blue-300 transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`w-6 h-6 rounded-full flex items-center justify-center font-mono font-bold text-xs ${idx === 0
                                ? 'bg-amber-500 text-white font-black shadow-xs'
                                : idx === 1
                                  ? 'bg-slate-300 text-slate-800 font-black'
                                  : idx === 2
                                    ? 'bg-amber-700 text-white font-black'
                                    : 'bg-slate-200 text-slate-600'
                                }`}
                            >
                              {idx + 1}
                            </span>

                            <div>
                              <h4 className="text-xs font-bold text-slate-900">{p.name}</h4>
                              <span className="text-[10px] text-slate-500">
                                #{p.jerseyNumber} • {team?.shortName} • Lớp {p.class}
                              </span>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-base font-black font-mono text-blue-600 block">
                              {p.goals} ⚽
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {p.assists || 0} kiến tạo
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>

          {/* Tournament Regulations Summary */}
          <div className="mt-5 pt-4 border-t border-slate-100 text-xs text-slate-600 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span>Thể thức:</span>
              <strong className="text-slate-900 text-right">
                {tournament?.format || `${sportMeta.label} • ${(tournament?.formatType || 'SINGLE_LEAGUE') === 'SINGLE_LEAGUE' ? `Vòng tròn (${tournament?.maxTeams || 12} ${sportMeta.unitShortLabel.toLowerCase()})` : 'Chia bảng + Knockout'}`}
              </strong>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>{isSetSport ? 'Thể lệ Set:' : 'Thời lượng:'}</span>
              <strong className="text-slate-900 text-right">
                {isSetSport
                  ? `BO${setConfig.bestOf} • ${setConfig.pointsPerSet}đ (Set cuối ${setConfig.decidingSetPoints}đ)`
                  : `${tournament?.matchDurationMinutes || 60}p (${Math.floor((tournament?.matchDurationMinutes || 60) / 2)}p × 2, nghỉ ${tournament?.breakDurationMinutes || 5}p)`}
              </strong>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>Tính điểm:</span>
              <strong className="text-blue-700 text-right">
                {sportType === 'VOLLEYBALL'
                  ? 'Thắng 3đ/2đ • Thua 1đ/0đ (Chuẩn FIVB)'
                  : sportType === 'BADMINTON'
                    ? 'Thắng 3đ • Thua 0đ (Không hòa)'
                    : 'Thắng 3đ • Hòa 1đ • Thua 0đ'}
              </strong>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>Bằng điểm:</span>
              <strong className="text-slate-900 text-right">
                {sportType === 'VOLLEYBALL'
                  ? 'Trận thắng ➔ HS Set ➔ HS Điểm ➔ Đối đầu'
                  : sportType === 'BADMINTON'
                    ? 'Đối đầu ➔ HS Ván ➔ HS Điểm ➔ Bốc thăm'
                    : 'Đối đầu ➔ Hiệu số ➔ BT ➔ Thẻ ➔ Bốc thăm'}
              </strong>
            </div>
            {!isSetSport && (tournament?.formatType || 'SINGLE_LEAGUE') !== 'SINGLE_LEAGUE' && (
              <div className="flex items-center justify-between gap-2">
                <span>Hòa Knockout:</span>
                <strong className="text-amber-700">Không đá hiệp phụ ➔ Luân lưu 6m</strong>
              </div>
            )}
            {!isSetSport && (
              <div className="flex items-center justify-between gap-2">
                <span>Phạt thẻ:</span>
                <strong className="text-rose-600 text-right">
                  {(tournament?.formatType || 'SINGLE_LEAGUE') === 'SINGLE_LEAGUE'
                    ? 'Vàng 20k • 2 Vàng/trận 50k • Đỏ trực tiếp 100k'
                    : '01 thẻ đỏ trực tiếp = 02 thẻ vàng'}
                </strong>
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
