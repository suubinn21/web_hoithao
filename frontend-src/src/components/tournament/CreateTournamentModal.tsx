'use client';

import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Tournament, TournamentStatus, TournamentFormatType, getGroupLetters } from '@/types';
import { DEFAULT_STUDENT_SCHEDULE_CONFIG } from '@/services/scheduleEngine';
import { SoundFX } from '@/utils/soundEffects';
import { 
  Trophy, 
  Sparkles, 
  X,
  Layers
} from 'lucide-react';

interface CreateTournamentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (tournament: Tournament) => void;
  currentTournament: Tournament;
  mode?: 'create' | 'edit';
}

export const CreateTournamentModal: React.FC<CreateTournamentModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  currentTournament,
  mode = 'create',
}) => {
  const resolveInitFormat = (): TournamentFormatType =>
    mode === 'edit' ? (currentTournament.formatType || 'SINGLE_LEAGUE') : 'SINGLE_LEAGUE';

  const [formatType, setFormatType] = useState<TournamentFormatType>(resolveInitFormat);
  const [name, setName] = useState(
    mode === 'edit' && currentTournament.name ? currentTournament.name : 'Giải Bóng Đá Khoa Công Nghệ Thông Tin 2026'
  );
  const [shortCode, setShortCode] = useState(
    mode === 'edit' && currentTournament.shortCode ? currentTournament.shortCode : 'CTUT-CNTT-2026'
  );
  const [year, setYear] = useState<number>(currentTournament.year || 2026);
  const [organizer, setOrganizer] = useState(
    mode === 'edit' && currentTournament.organizer
      ? currentTournament.organizer
      : 'Đoàn Khoa CNTT – ĐH Kỹ thuật – Công nghệ Cần Thơ'
  );
  const [format, setFormat] = useState(
    mode === 'edit' && currentTournament.format
      ? currentTournament.format
      : 'Sân 5 - Vòng tròn 1 lượt (12 đội)'
  );
  const [numberOfGroups, setNumberOfGroups] = useState<number>(
    mode === 'edit' ? (currentTournament.numberOfGroups || 1) : 1
  );
  const [teamsPerGroup, setTeamsPerGroup] = useState<number>(
    mode === 'edit' ? (currentTournament.teamsPerGroup || 12) : 12
  );
  const [numberOfVenues, setNumberOfVenues] = useState<number>(
    mode === 'edit' ? (currentTournament.numberOfVenues || 3) : 3
  );
  const [maxTeams, setMaxTeams] = useState<number>(
    mode === 'edit' ? (currentTournament.maxTeams || 12) : 12
  );
  const [maxPlayersPerTeam, setMaxPlayersPerTeam] = useState<number>(currentTournament.maxPlayersPerTeam || 12);
  const [matchDurationMinutes, setMatchDurationMinutes] = useState<number>(
    mode === 'edit' ? (currentTournament.matchDurationMinutes || 60) : 60
  );
  const [breakDurationMinutes, setBreakDurationMinutes] = useState<number>(currentTournament.breakDurationMinutes || 5);
  const [registrationFee, setRegistrationFee] = useState<number>(
    mode === 'edit' ? (currentTournament.registrationFee ?? 100000) : 100000
  );
  const [depositFee, setDepositFee] = useState<number>(
    mode === 'edit' ? (currentTournament.depositFee ?? 0) : 0
  );
  const [startDate, setStartDate] = useState(currentTournament.startDate || '2026-10-17');
  const [endDate, setEndDate] = useState(currentTournament.endDate || '2026-11-29');
  const [initialStatus, setInitialStatus] = useState<TournamentStatus>(currentTournament.status || 'REGISTRATION');
  const [description, setDescription] = useState(
    mode === 'edit' && currentTournament.description
      ? currentTournament.description
      : 'Giải bóng đá sân 5 Khoa CNTT – CTUT. 12 đội đá vòng tròn 1 lượt tính điểm (66 trận), 2 hiệp x 30 phút.'
  );

  useEffect(() => {
    if (!isOpen) return;
    if (mode === 'edit' && currentTournament) {
      const fType = currentTournament.formatType || 'SINGLE_LEAGUE';
      setFormatType(fType);
      setName(currentTournament.name || 'Giải Bóng Đá Khoa Công Nghệ Thông Tin 2026');
      setShortCode(currentTournament.shortCode || 'CTUT-CNTT-2026');
      setYear(currentTournament.year || 2026);
      setOrganizer(currentTournament.organizer || 'Đoàn Khoa CNTT – ĐH Kỹ thuật – Công nghệ Cần Thơ');
      setFormat(currentTournament.format || 'Sân 5 - Vòng tròn 1 lượt (12 đội)');
      setNumberOfGroups(currentTournament.numberOfGroups || (fType === 'SINGLE_LEAGUE' ? 1 : 4));
      setTeamsPerGroup(currentTournament.teamsPerGroup || (fType === 'SINGLE_LEAGUE' ? 12 : 4));
      setNumberOfVenues(currentTournament.numberOfVenues || (fType === 'SINGLE_LEAGUE' ? 3 : 4));
      setMaxTeams(currentTournament.maxTeams || (fType === 'SINGLE_LEAGUE' ? 12 : 16));
      setMaxPlayersPerTeam(currentTournament.maxPlayersPerTeam || 12);
      setMatchDurationMinutes(currentTournament.matchDurationMinutes || (fType === 'SINGLE_LEAGUE' ? 60 : 40));
      setBreakDurationMinutes(currentTournament.breakDurationMinutes || 5);
      setRegistrationFee(currentTournament.registrationFee ?? (fType === 'SINGLE_LEAGUE' ? 100000 : 500000));
      setDepositFee(currentTournament.depositFee ?? (fType === 'SINGLE_LEAGUE' ? 0 : 50000));
      setStartDate(currentTournament.startDate || '2026-10-17');
      setEndDate(currentTournament.endDate || '2026-11-29');
      setInitialStatus(currentTournament.status || 'REGISTRATION');
      setDescription(currentTournament.description || '');
    } else if (mode === 'create') {
      setFormatType('SINGLE_LEAGUE');
      setName('Giải Bóng Đá Khoa Công Nghệ Thông Tin 2026');
      setShortCode('CTUT-CNTT-2026');
      setYear(2026);
      setOrganizer('Đoàn Khoa CNTT – ĐH Kỹ thuật – Công nghệ Cần Thơ');
      setFormat('Sân 5 - Vòng tròn 1 lượt (12 đội)');
      setNumberOfGroups(1);
      setTeamsPerGroup(12);
      setNumberOfVenues(3);
      setMaxTeams(12);
      setMaxPlayersPerTeam(12);
      setMatchDurationMinutes(60);
      setBreakDurationMinutes(5);
      setRegistrationFee(100000);
      setDepositFee(0);
      setInitialStatus('REGISTRATION');
      setDescription('Giải bóng đá sân 5 Khoa CNTT – CTUT. 12 đội đá vòng tròn 1 lượt tính điểm (66 trận), 2 hiệp x 30 phút.');
    }
  }, [isOpen, currentTournament, mode]);

  if (!isOpen) return null;

  const handleFormatTypeChange = (nextType: TournamentFormatType) => {
    setFormatType(nextType);
    if (nextType === 'SINGLE_LEAGUE') {
      setFormat('Sân 5 - Vòng tròn 1 lượt (12 đội)');
      setNumberOfGroups(1);
      setTeamsPerGroup(12);
      setMaxTeams(12);
      setNumberOfVenues(3);
      setMatchDurationMinutes(60);
      setBreakDurationMinutes(5);
      setRegistrationFee(100000);
      setDepositFee(0);
    } else {
      setFormat('Bóng đá 5 người (Chia bảng + Knockout)');
      setNumberOfGroups(4);
      setTeamsPerGroup(4);
      setMaxTeams(16);
      setNumberOfVenues(4);
      setMatchDurationMinutes(40);
      setBreakDurationMinutes(5);
      setRegistrationFee(500000);
      setDepositFee(50000);
    }
  };

  const handleGroupCountChange = (val: number) => {
    setNumberOfGroups(val);
    setMaxTeams(val * teamsPerGroup);
  };

  const handleTeamsPerGroupChange = (val: number) => {
    setTeamsPerGroup(val);
    setMaxTeams(numberOfGroups * val);
  };

  const totalRoundRobinMatches = formatType === 'SINGLE_LEAGUE' ? Math.floor((maxTeams * (maxTeams - 1)) / 2) : 0;
  const estimatedMatchDays =
    formatType === 'SINGLE_LEAGUE' && numberOfVenues > 0
      ? Math.ceil(totalRoundRobinMatches / (numberOfVenues * 2))
      : 1;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert('Vui lòng nhập tên giải đấu!');
      return;
    }

    const existingConfig = currentTournament?.scheduleConfig || DEFAULT_STUDENT_SCHEDULE_CONFIG;

    const newTournament: Tournament = {
      id: mode === 'edit' ? currentTournament.id : `TOUR-${year}-${Date.now().toString().slice(-4)}`,
      name: name.trim(),
      shortCode: shortCode.trim().toUpperCase() || 'CTUT-CNTT',
      year,
      organizer: organizer.trim(),
      format,
      formatType,
      maxTeams,
      numberOfGroups: formatType === 'SINGLE_LEAGUE' ? 1 : numberOfGroups,
      teamsPerGroup: formatType === 'SINGLE_LEAGUE' ? maxTeams : teamsPerGroup,
      advancePerGroup: formatType === 'SINGLE_LEAGUE' ? 3 : 2,
      numberOfVenues,
      maxPlayersPerTeam,
      matchDurationMinutes,
      breakDurationMinutes,
      registrationFee,
      depositFee,
      startDate,
      endDate,
      status: initialStatus,
      description: description.trim(),
      scheduleConfig: {
        ...existingConfig,
        pitchesCount: numberOfVenues,
      },
    };

    SoundFX.playGoalFanfare();
    confetti({
      particleCount: 150,
      spread: 90,
      origin: { y: 0.5 },
      colors: ['#0284C7', '#2563EB', '#06B6D4', '#F59E0B', '#FFFFFF'],
    });

    onSubmit(newTournament);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 my-8 max-h-[90vh] overflow-y-auto relative text-slate-800">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 via-sky-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-black text-sky-700 uppercase tracking-widest block">
                {mode === 'edit' ? 'CHỈNH SỬA THÔNG SỐ GIẢI' : 'KHỞI TẠO MÙA GIẢI MỚI'}
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                {mode === 'edit' ? 'Cấu Hình Giải Đấu & Số Bảng' : 'Tạo Mới Giải Đấu Bóng Đá'}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Tournament Name */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Tên Giải Đấu Chính Thức <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Giải Bóng Đá Khoa Công Nghệ Thông Tin 2026"
              className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm font-bold rounded-xl p-3 focus:border-blue-500 focus:bg-white focus:outline-none transition-colors"
            />
          </div>

          {/* Code, Year, Organizer */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Mã Viết Tắt (Code)
              </label>
              <input
                type="text"
                required
                value={shortCode}
                onChange={(e) => setShortCode(e.target.value)}
                placeholder="VD: ITFTMS-2026"
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs font-mono font-bold rounded-xl p-2.5 uppercase focus:border-blue-500 focus:bg-white focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Năm Tổ Chức
              </label>
              <input
                type="number"
                required
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs font-mono font-bold rounded-xl p-2.5 focus:border-blue-500 focus:bg-white focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Giai Đoạn Khởi Đầu
              </label>
              <select
                value={initialStatus}
                onChange={(e) => setInitialStatus(e.target.value as TournamentStatus)}
                className="w-full bg-slate-50 border border-slate-200 text-blue-700 text-xs font-bold rounded-xl p-2.5 focus:border-blue-500 focus:bg-white focus:outline-none transition-colors cursor-pointer"
              >
                <option value="REGISTRATION">Mở Đăng Ký Đội (Registration)</option>
                <option value="DRAFT">Bản Nháp (Draft)</option>
                <option value="DRAWING">Sẵn Sàng Bốc Thăm (Drawing)</option>
                <option value="GROUP_STAGE">Vòng Bảng (Group Stage)</option>
              </select>
            </div>
          </div>

          {/* Organizer */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Đơn Vị Tổ Chức / Ban Tổ Chức
            </label>
            <input
              type="text"
              value={organizer}
              onChange={(e) => setOrganizer(e.target.value)}
              placeholder="VD: Khoa Công Nghệ Thông Tin • Ban Thể Thao Đoàn - Hội"
              className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl p-2.5 focus:border-blue-500 focus:bg-white focus:outline-none transition-colors"
            />
          </div>

          {/* Thể thức giải đấu */}
          <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-3">
            <span className="text-xs font-black text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-indigo-600" />
              Chọn Thể Thức Tổ Chức Giải Đấu
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleFormatTypeChange('SINGLE_LEAGUE')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  formatType === 'SINGLE_LEAGUE'
                    ? 'bg-white border-blue-600 shadow-sm ring-2 ring-blue-500/20'
                    : 'bg-white/60 border-slate-200 hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-900">Vòng Tròn 1 Lượt (CTUT CNTT)</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700">12 đội • 66 trận</span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1">
                  1 bảng xếp hạng chung. 11 vòng × 6 trận (3 sân × 2 ca/ngày). Top 1-2-3 nhận Nhất/Nhì/Ba.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleFormatTypeChange('GROUP_KNOCKOUT')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  formatType === 'GROUP_KNOCKOUT'
                    ? 'bg-white border-blue-600 shadow-sm ring-2 ring-blue-500/20'
                    : 'bg-white/60 border-slate-200 hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-900">Chia Bảng + Knockout</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">Mở rộng</span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1">
                  Chia nhiều bảng (A, B, C, D...) rồi đá Tứ kết, Bán kết, Tranh 3-4, Chung kết.
                </p>
              </button>
            </div>
          </div>

          {/* Cấu Hình Bảng Đấu & Số Đội */}
          {formatType === 'SINGLE_LEAGUE' ? (
            <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-black text-blue-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-blue-600" />
                  Cấu Hình Giải Vòng Tròn 1 Lượt
                </span>
                <span className="text-xs font-mono font-black text-blue-700 bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-300">
                  {maxTeams} Đội • {totalRoundRobinMatches} Trận • ~{estimatedMatchDays} Ngày (3 sân × 2 trận)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="text-[11px] text-slate-700 font-semibold block mb-1">
                    Số đội tham gia (tối đa 12)
                  </label>
                  <select
                    value={maxTeams}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setMaxTeams(v);
                      setTeamsPerGroup(v);
                    }}
                    className="w-full bg-white border border-slate-200 text-blue-700 font-bold text-xs rounded-xl p-2.5 focus:outline-none focus:border-blue-500 cursor-pointer shadow-xs"
                  >
                    <option value={6}>6 Đội (15 trận • 5 vòng)</option>
                    <option value={8}>8 Đội (28 trận • 7 vòng)</option>
                    <option value={10}>10 Đội (45 trận • 9 vòng)</option>
                    <option value={12}>12 Đội (66 trận • 11 vòng - Thể lệ CTUT)</option>
                    <option value={14}>14 Đội (91 trận • 13 vòng)</option>
                    <option value={16}>16 Đội (120 trận • 15 vòng)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-slate-700 font-semibold block mb-1">
                    Số sân thuê mỗi ngày
                  </label>
                  <select
                    value={numberOfVenues}
                    onChange={(e) => setNumberOfVenues(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 text-sky-700 font-bold text-xs rounded-xl p-2.5 focus:outline-none focus:border-sky-500 cursor-pointer shadow-xs"
                  >
                    <option value={2}>2 Sân (4 trận/ngày)</option>
                    <option value={3}>3 Sân (6 trận/ngày - Kế hoạch CTUT)</option>
                    <option value={4}>4 Sân (8 trận/ngày)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-slate-700 font-semibold block mb-1">
                    Thời lượng 1 trận (2 hiệp đều)
                  </label>
                  <select
                    value={matchDurationMinutes}
                    onChange={(e) => setMatchDurationMinutes(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 text-emerald-700 font-bold text-xs rounded-xl p-2.5 focus:outline-none focus:border-emerald-500 cursor-pointer shadow-xs"
                  >
                    <option value={60}>60 phút (2 × 30p, nghỉ 5p - Thể lệ CTUT)</option>
                    <option value={50}>50 phút (2 × 25p, nghỉ 5p)</option>
                    <option value={40}>40 phút (2 × 20p, nghỉ 5p)</option>
                  </select>
                </div>
              </div>
              <p className="text-[11px] text-blue-800/80">
                ⏱️ Đồng hồ chạy liên tục không bù giờ. Tối đa 2 đội thuộc cùng 1 Chi Đoàn. Không thi đấu Knockout.
              </p>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-blue-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-blue-600" />
                  Cấu Hình Số Bảng Đấu &amp; Số Đội 1 Bảng
                </span>
                <span className="text-xs font-mono font-black text-blue-700 bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-300">
                  {numberOfGroups} Bảng × {teamsPerGroup} Đội = {maxTeams} Đội • {numberOfVenues} Sân
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="text-[11px] text-slate-700 font-semibold block mb-1">
                    Số lượng bảng đấu
                  </label>
                  <select
                    value={numberOfGroups}
                    onChange={(e) => handleGroupCountChange(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 text-blue-700 font-bold text-xs rounded-xl p-2.5 focus:outline-none focus:border-blue-500 cursor-pointer shadow-xs"
                  >
                    <option value={2}>2 Bảng (Bảng A, B)</option>
                    <option value={3}>3 Bảng (Bảng A, B, C)</option>
                    <option value={4}>4 Bảng (Bảng A, B, C, D)</option>
                    <option value={5}>5 Bảng (Bảng A, B, C, D, E)</option>
                    <option value={6}>6 Bảng (Bảng A, B, C, D, E, F)</option>
                    <option value={8}>8 Bảng (Bảng A ➔ Bảng H)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-slate-700 font-semibold block mb-1">
                    Số đội trong 1 bảng
                  </label>
                  <select
                    value={teamsPerGroup}
                    onChange={(e) => handleTeamsPerGroupChange(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 text-blue-700 font-bold text-xs rounded-xl p-2.5 focus:outline-none focus:border-blue-500 cursor-pointer shadow-xs"
                  >
                    <option value={3}>3 Đội / bảng</option>
                    <option value={4}>4 Đội / bảng</option>
                    <option value={5}>5 Đội / bảng</option>
                    <option value={6}>6 Đội / bảng</option>
                    <option value={8}>8 Đội / bảng</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-slate-700 font-semibold block mb-1">
                    Số sân thi đấu
                  </label>
                  <select
                    value={numberOfVenues}
                    onChange={(e) => setNumberOfVenues(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 text-sky-700 font-bold text-xs rounded-xl p-2.5 focus:outline-none focus:border-sky-500 cursor-pointer shadow-xs"
                  >
                    <option value={2}>2 Sân</option>
                    <option value={3}>3 Sân</option>
                    <option value={4}>4 Sân</option>
                    <option value={5}>5 Sân</option>
                    <option value={6}>6 Sân</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-slate-700 font-semibold block mb-1">
                    Thời lượng trận
                  </label>
                  <select
                    value={matchDurationMinutes}
                    onChange={(e) => setMatchDurationMinutes(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 text-slate-900 font-mono font-bold text-xs rounded-xl p-2.5 focus:outline-none focus:border-blue-500 shadow-xs"
                  >
                    <option value={40}>40 phút (2 × 20p)</option>
                    <option value={50}>50 phút (2 × 25p)</option>
                    <option value={60}>60 phút (2 × 30p)</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] text-slate-600">
                <span className="text-slate-500 font-medium">Bảng đấu sẽ tạo:</span>
                {getGroupLetters(numberOfGroups).map((g) => (
                  <span key={g} className="px-2 py-0.5 rounded bg-white text-blue-700 font-black border border-blue-200 shadow-xs">
                    Bảng {g}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Competition Rules & Format */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <span className="text-xs font-bold text-blue-700 uppercase tracking-wider block">
              Quy Chế Thi Đấu &amp; Nhân Sự
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">Tên thể thức hiển thị</label>
                <input
                  type="text"
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-slate-900 text-xs rounded-lg p-2 font-medium focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-500 block mb-1">Số đội tối đa</label>
                <input
                  type="number"
                  value={maxTeams}
                  onChange={(e) => setMaxTeams(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 text-slate-900 text-xs rounded-lg p-2 font-mono font-bold focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-500 block mb-1">Cầu thủ max/đội</label>
                <input
                  type="number"
                  value={maxPlayersPerTeam}
                  onChange={(e) => setMaxPlayersPerTeam(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 text-slate-900 text-xs rounded-lg p-2 font-mono font-bold focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-500 block mb-1">Nghỉ giữa hiệp (phút)</label>
                <input
                  type="number"
                  value={breakDurationMinutes}
                  onChange={(e) => setBreakDurationMinutes(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 text-slate-900 text-xs rounded-lg p-2 font-mono font-bold focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Financial Regulations */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200">
              <label className="text-xs font-bold text-blue-700 block mb-1">
                Lệ Phí Tham Dự / Đội (Không hoàn lại)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step={50000}
                  value={registrationFee}
                  onChange={(e) => setRegistrationFee(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 text-slate-900 font-mono font-bold text-sm rounded-xl p-2 focus:border-blue-500 focus:outline-none"
                />
                <span className="text-xs text-slate-500 font-mono">VNĐ</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-sky-50/70 border border-sky-200">
              <label className="text-xs font-bold text-sky-700 block mb-1">
                Tiền Ký Quỹ (0đ nếu giải không thu ký quỹ)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step={10000}
                  value={depositFee}
                  onChange={(e) => setDepositFee(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 text-slate-900 font-mono font-bold text-sm rounded-xl p-2 focus:border-sky-500 focus:outline-none"
                />
                <span className="text-xs text-slate-500 font-mono">VNĐ</span>
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Ngày Khai Mạc Dự Kiến
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl p-2.5 font-mono focus:border-blue-500 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Ngày Bế Mạc &amp; Trao Giải
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl p-2.5 font-mono focus:border-blue-500 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
            >
              Hủy Bỏ
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-600 hover:from-blue-700 hover:to-sky-700 text-white text-xs sm:text-sm font-black shadow-md shadow-blue-500/20 transition-all flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>{mode === 'edit' ? 'Lưu Cấu Hình Thay Đổi' : 'Khởi Tạo Giải Đấu Mới!'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
