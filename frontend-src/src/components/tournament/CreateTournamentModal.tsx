'use client';

import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  Tournament,
  TournamentStatus,
  TournamentFormatType,
  SportType,
  BadmintonCategory,
  SportSetConfig,
  getGroupLetters,
  getSportMeta,
} from '@/types';
import { DEFAULT_STUDENT_SCHEDULE_CONFIG, buildAutoTimeSlots } from '@/services/scheduleEngine';
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

  const resolveInitSport = (): SportType =>
    mode === 'edit' ? (currentTournament.sportType || 'FOOTBALL') : 'FOOTBALL';

  const [sportType, setSportType] = useState<SportType>(resolveInitSport);
  const [bestOf, setBestOf] = useState<1 | 3 | 5>(
    mode === 'edit' ? (currentTournament.setConfig?.bestOf || 3) : 3
  );
  const [pointsPerSet, setPointsPerSet] = useState<number>(
    mode === 'edit'
      ? (currentTournament.setConfig?.pointsPerSet || (currentTournament.sportType === 'VOLLEYBALL' ? 25 : 21))
      : 21
  );
  const [decidingSetPoints, setDecidingSetPoints] = useState<number>(
    mode === 'edit'
      ? (currentTournament.setConfig?.decidingSetPoints || (currentTournament.sportType === 'VOLLEYBALL' ? 15 : 21))
      : 21
  );
  const [winByTwo, setWinByTwo] = useState<boolean>(
    mode === 'edit' ? (currentTournament.setConfig?.winByTwo ?? true) : true
  );
  const [maxPointCap, setMaxPointCap] = useState<number>(
    mode === 'edit'
      ? (currentTournament.setConfig?.maxPointCap ?? (currentTournament.sportType === 'BADMINTON' ? 30 : 0))
      : 30
  );
  const [badmintonCategory, setBadmintonCategory] = useState<BadmintonCategory>(
    mode === 'edit' ? (currentTournament.setConfig?.badmintonCategory || 'MEN_DOUBLES') : 'MEN_DOUBLES'
  );

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
  const [advancePerGroup, setAdvancePerGroup] = useState<number>(
    mode === 'edit' ? (currentTournament.advancePerGroup || 2) : 2
  );
  const [numberOfVenues, setNumberOfVenues] = useState<number>(
    mode === 'edit' ? (currentTournament.numberOfVenues || 3) : 3
  );
  const [slotsPerDay, setSlotsPerDay] = useState<number>(
    mode === 'edit' ? (currentTournament.scheduleConfig?.slotsPerDay || 2) : 2
  );
  const [hasThirdPlace, setHasThirdPlace] = useState<boolean>(
    mode === 'edit' ? (currentTournament.scheduleConfig?.hasThirdPlace ?? true) : true
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

  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      return;
    }
    if (wasOpenRef.current) return;
    wasOpenRef.current = true;

    if (mode === 'edit' && currentTournament) {
      const fType = currentTournament.formatType || 'SINGLE_LEAGUE';
      const sType = currentTournament.sportType || 'FOOTBALL';
      const sMeta = getSportMeta(sType);
      setSportType(sType);
      setBestOf(currentTournament.setConfig?.bestOf || sMeta.defaultSetConfig.bestOf);
      setPointsPerSet(currentTournament.setConfig?.pointsPerSet || sMeta.defaultSetConfig.pointsPerSet);
      setDecidingSetPoints(currentTournament.setConfig?.decidingSetPoints || sMeta.defaultSetConfig.decidingSetPoints);
      setWinByTwo(currentTournament.setConfig?.winByTwo ?? sMeta.defaultSetConfig.winByTwo);
      setMaxPointCap(
        currentTournament.setConfig?.maxPointCap ??
          (sType === 'BADMINTON' ? 30 : 0)
      );
      setBadmintonCategory(currentTournament.setConfig?.badmintonCategory || 'MEN_DOUBLES');
      setFormatType(fType);
      setName(currentTournament.name || 'Giải Bóng Đá Khoa Công Nghệ Thông Tin 2026');
      setShortCode(currentTournament.shortCode || 'CTUT-CNTT-2026');
      setYear(currentTournament.year || 2026);
      setOrganizer(currentTournament.organizer || 'Đoàn Khoa CNTT – ĐH Kỹ thuật – Công nghệ Cần Thơ');
      setFormat(currentTournament.format || 'Sân 5 - Vòng tròn 1 lượt (12 đội)');
      setNumberOfGroups(currentTournament.numberOfGroups || (fType === 'SINGLE_LEAGUE' ? 1 : 4));
      setTeamsPerGroup(currentTournament.teamsPerGroup || (fType === 'SINGLE_LEAGUE' ? 12 : 4));
      setAdvancePerGroup(currentTournament.advancePerGroup || 2);
      setNumberOfVenues(currentTournament.numberOfVenues || (fType === 'SINGLE_LEAGUE' ? 3 : 4));
      setSlotsPerDay(
        currentTournament.scheduleConfig?.slotsPerDay ||
          (sType === 'BADMINTON' ? 6 : sType === 'VOLLEYBALL' ? 4 : 2)
      );
      setHasThirdPlace(currentTournament.scheduleConfig?.hasThirdPlace ?? (sType !== 'BADMINTON'));
      setMaxTeams(currentTournament.maxTeams || (fType === 'SINGLE_LEAGUE' ? 12 : fType === 'KNOCKOUT' ? 8 : 16));
      setMaxPlayersPerTeam(currentTournament.maxPlayersPerTeam || 12);
      setMatchDurationMinutes(currentTournament.matchDurationMinutes || (fType === 'SINGLE_LEAGUE' ? 60 : 40));
      setBreakDurationMinutes(currentTournament.breakDurationMinutes ?? 5);
      setRegistrationFee(currentTournament.registrationFee ?? (fType === 'SINGLE_LEAGUE' ? 100000 : 500000));
      setDepositFee(currentTournament.depositFee ?? (fType === 'SINGLE_LEAGUE' ? 0 : 50000));
      setStartDate(currentTournament.startDate || '2026-10-17');
      setEndDate(currentTournament.endDate || '2026-11-29');
      setInitialStatus(currentTournament.status || 'REGISTRATION');
      setDescription(currentTournament.description || '');
    } else if (mode === 'create') {
      setSportType('FOOTBALL');
      setBestOf(3);
      setPointsPerSet(21);
      setDecidingSetPoints(21);
      setWinByTwo(true);
      setMaxPointCap(30);
      setBadmintonCategory('MEN_DOUBLES');
      setFormatType('SINGLE_LEAGUE');
      setName('Giải Bóng Đá Khoa Công Nghệ Thông Tin 2026');
      setShortCode('CTUT-CNTT-2026');
      setYear(2026);
      setOrganizer('Đoàn Khoa CNTT – ĐH Kỹ thuật – Công nghệ Cần Thơ');
      setFormat('Sân 5 - Vòng tròn 1 lượt (12 đội)');
      setNumberOfGroups(1);
      setTeamsPerGroup(12);
      setAdvancePerGroup(2);
      setNumberOfVenues(3);
      setSlotsPerDay(2);
      setHasThirdPlace(true);
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

  const sportMeta = getSportMeta(sportType);

  const getFormatLabel = (sType: SportType, fType: TournamentFormatType) => {
    const sportPrefix =
      sType === 'BADMINTON' ? 'Cầu lông' : sType === 'VOLLEYBALL' ? 'Bóng chuyền' : 'Bóng đá 5 người';
    if (fType === 'SINGLE_LEAGUE') {
      return sType === 'FOOTBALL' ? 'Sân 5 - Vòng tròn 1 lượt (12 đội)' : `${sportPrefix} - Vòng tròn tính điểm`;
    }
    if (fType === 'KNOCKOUT') {
      return `${sportPrefix} - Loại trực tiếp (Knockout)`;
    }
    return sType === 'FOOTBALL' ? 'Bóng đá 5 người (Chia bảng + Knockout)' : `${sportPrefix} - Chia bảng + Knockout`;
  };

  const handleSportTypeChange = (nextSport: SportType) => {
    setSportType(nextSport);
    const isLeague = formatType === 'SINGLE_LEAGUE';

    if (nextSport === 'FOOTBALL') {
      if (mode === 'create') {
        setName('Giải Bóng Đá Khoa Công Nghệ Thông Tin 2026');
        setShortCode('CTUT-CNTT-2026');
        setDescription('Giải bóng đá sân 5 Khoa CNTT – CTUT. 12 đội đá vòng tròn 1 lượt tính điểm (66 trận), 2 hiệp x 30 phút.');
      }
      setFormat(getFormatLabel(nextSport, formatType));
      setMaxPlayersPerTeam(12);
      setMatchDurationMinutes(isLeague ? 60 : 40);
      setBreakDurationMinutes(5);
      setSlotsPerDay(isLeague ? 2 : 6);
      setHasThirdPlace(true);
    } else if (nextSport === 'BADMINTON') {
      if (mode === 'create') {
        setName('Giải Cầu Lông Sinh Viên Khoa CNTT 2026');
        setShortCode('CTUT-CL-2026');
        setDescription('Giải cầu lông phong trào Khoa CNTT – CTUT. Hỗ trợ vòng tròn, loại trực tiếp (chẵn/lẻ + BYE) và tùy chỉnh điểm từng ván.');
      }
      setFormat(getFormatLabel(nextSport, formatType));
      setMaxPlayersPerTeam(4);
      setMatchDurationMinutes(30);
      setBreakDurationMinutes(2);
      setSlotsPerDay(6);
      setHasThirdPlace(false);
      setBestOf(3);
      setPointsPerSet(21);
      setDecidingSetPoints(21);
      setWinByTwo(true);
      setMaxPointCap(30);
      setBadmintonCategory('MEN_DOUBLES');
    } else {
      if (mode === 'create') {
        setName('Giải Bóng Chuyền Sinh Viên Khoa CNTT 2026');
        setShortCode('CTUT-BC-2026');
        setDescription('Giải bóng chuyền Khoa CNTT – CTUT. Hỗ trợ vòng tròn, loại trực tiếp (chẵn/lẻ + BYE) và tùy chỉnh set đấu.');
      }
      setFormat(getFormatLabel(nextSport, formatType));
      setMaxPlayersPerTeam(12);
      setMatchDurationMinutes(60);
      setBreakDurationMinutes(5);
      setSlotsPerDay(4);
      setHasThirdPlace(true);
      setBestOf(3);
      setPointsPerSet(25);
      setDecidingSetPoints(15);
      setWinByTwo(true);
      setMaxPointCap(0);
    }
  };

  const handleFormatTypeChange = (nextType: TournamentFormatType) => {
    setFormatType(nextType);
    setFormat(getFormatLabel(sportType, nextType));
    if (nextType === 'SINGLE_LEAGUE') {
      if (sportType === 'FOOTBALL') setMatchDurationMinutes(60);
      setNumberOfGroups(1);
      setTeamsPerGroup(12);
      setMaxTeams(12);
      setNumberOfVenues(sportType === 'VOLLEYBALL' ? 2 : 3);
      setSlotsPerDay(sportType === 'BADMINTON' ? 6 : sportType === 'VOLLEYBALL' ? 4 : 2);
      setBreakDurationMinutes(sportType === 'BADMINTON' ? 2 : 5);
      setRegistrationFee(100000);
      setDepositFee(0);
    } else if (nextType === 'KNOCKOUT') {
      if (sportType === 'FOOTBALL') setMatchDurationMinutes(40);
      setNumberOfGroups(1);
      setTeamsPerGroup(8);
      setMaxTeams(8);
      setNumberOfVenues(sportType === 'VOLLEYBALL' ? 2 : 3);
      setSlotsPerDay(sportType === 'BADMINTON' ? 8 : sportType === 'VOLLEYBALL' ? 4 : 4);
      setBreakDurationMinutes(sportType === 'BADMINTON' ? 2 : 5);
      setRegistrationFee(100000);
      setDepositFee(0);
    } else {
      if (sportType === 'FOOTBALL') setMatchDurationMinutes(40);
      setNumberOfGroups(4);
      setTeamsPerGroup(4);
      setAdvancePerGroup(2);
      setMaxTeams(16);
      setNumberOfVenues(sportType === 'VOLLEYBALL' ? 2 : 4);
      setSlotsPerDay(sportType === 'BADMINTON' ? 6 : sportType === 'VOLLEYBALL' ? 4 : 6);
      setBreakDurationMinutes(sportType === 'BADMINTON' ? 2 : 5);
      setRegistrationFee(500000);
      setDepositFee(50000);
    }
  };

  const handleGroupCountChange = (val: number) => {
    const safeVal = Math.max(1, Math.min(16, val || 1));
    setNumberOfGroups(safeVal);
    setMaxTeams(safeVal * teamsPerGroup);
  };

  const handleTeamsPerGroupChange = (val: number) => {
    const safeVal = Math.max(2, Math.min(16, val || 2));
    setTeamsPerGroup(safeVal);
    setMaxTeams(numberOfGroups * safeVal);
  };

  const safeMaxTeamsPreview = Math.max(2, Number(maxTeams) || 2);
  const safeVenuesPreview = Math.max(1, Number(numberOfVenues) || 1);
  const safeSlotsPreview = Math.max(1, Number(slotsPerDay) || 1);
  const nextPowerOfTwoPreview = (() => {
    let b = 2;
    while (b < safeMaxTeamsPreview) b *= 2;
    return b;
  })();
  const knockoutByeCount = formatType === 'KNOCKOUT' ? nextPowerOfTwoPreview - safeMaxTeamsPreview : 0;
  const totalScheduledPreviewMatches =
    formatType === 'SINGLE_LEAGUE'
      ? Math.floor((safeMaxTeamsPreview * (safeMaxTeamsPreview - 1)) / 2)
      : formatType === 'KNOCKOUT'
        ? Math.max(1, safeMaxTeamsPreview - 1) + (hasThirdPlace && safeMaxTeamsPreview >= 4 ? 1 : 0)
        : 0;
  const estimatedMatchDays =
    formatType === 'SINGLE_LEAGUE' || formatType === 'KNOCKOUT'
      ? Math.max(1, Math.ceil(totalScheduledPreviewMatches / (safeVenuesPreview * safeSlotsPreview)))
      : 1;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert('Vui lòng nhập tên giải đấu!');
      return;
    }

    const isFlatFormat = formatType === 'SINGLE_LEAGUE' || formatType === 'KNOCKOUT';
    const safeGroups = isFlatFormat ? 1 : Math.max(1, Math.min(16, Number(numberOfGroups) || 4));
    const safeTeamsPerGroup = isFlatFormat
      ? Math.max(2, Math.min(64, Number(maxTeams) || 12))
      : Math.max(2, Math.min(16, Number(teamsPerGroup) || 4));
    const safeMaxTeams = isFlatFormat
      ? safeTeamsPerGroup
      : Math.max(safeGroups * 2, Math.min(128, Number(maxTeams) || safeGroups * safeTeamsPerGroup));
    const safeVenues = Math.max(1, Math.min(16, Number(numberOfVenues) || 3));
    const safeSlotsPerDay = Math.max(1, Math.min(24, Number(slotsPerDay) || 2));
    const safeDuration = Math.max(10, Math.min(180, Number(matchDurationMinutes) || 45));
    const safeBreak = Math.max(0, Math.min(30, Number(breakDurationMinutes) || 0));
    const safeAdvance =
      formatType === 'SINGLE_LEAGUE'
        ? 3
        : formatType === 'KNOCKOUT'
          ? 1
          : Math.max(1, Math.min(safeTeamsPerGroup, Number(advancePerGroup) || 2));

    const safePoints = Math.max(1, Math.min(99, Number(pointsPerSet) || 21));
    const safeDeciding = bestOf === 1 ? safePoints : Math.max(1, Math.min(99, Number(decidingSetPoints) || safePoints));
    const safeCap = Math.max(0, Math.min(99, Number(maxPointCap) || 0));

    const existingConfig = currentTournament?.scheduleConfig || DEFAULT_STUDENT_SCHEDULE_CONFIG;
    const nextTimeSlots = buildAutoTimeSlots(
      safeSlotsPerDay,
      safeDuration,
      safeBreak,
      mode === 'edit' ? existingConfig.timeSlots : undefined
    );

    const setConfig: SportSetConfig | undefined =
      sportType === 'FOOTBALL'
        ? undefined
        : {
            bestOf,
            pointsPerSet: safePoints,
            decidingSetPoints: safeDeciding,
            winByTwo,
            ...(safeCap > 0 ? { maxPointCap: safeCap } : {}),
            ...(sportType === 'BADMINTON' ? { badmintonCategory } : {}),
          };

    const newTournament: Tournament = {
      id: mode === 'edit' ? currentTournament.id : `TOUR-${year}-${Date.now().toString().slice(-4)}`,
      name: name.trim(),
      shortCode: shortCode.trim().toUpperCase() || 'CTUT-CNTT',
      year,
      organizer: organizer.trim(),
      sportType,
      ...(setConfig ? { setConfig } : {}),
      format,
      formatType,
      maxTeams: safeMaxTeams,
      numberOfGroups: safeGroups,
      teamsPerGroup: safeTeamsPerGroup,
      advancePerGroup: safeAdvance,
      numberOfVenues: safeVenues,
      maxPlayersPerTeam: Math.max(1, Number(maxPlayersPerTeam) || 1),
      matchDurationMinutes: safeDuration,
      breakDurationMinutes: safeBreak,
      registrationFee,
      depositFee,
      startDate,
      endDate,
      status: initialStatus,
      description: description.trim(),
      scheduleConfig: {
        ...existingConfig,
        pitchesCount: safeVenues,
        slotsPerDay: safeSlotsPerDay,
        timeSlots: nextTimeSlots,
        hasThirdPlace,
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
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 via-sky-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 text-2xl">
              <span>{sportMeta.icon}</span>
            </div>
            <div>
              <span className="text-xs font-black text-sky-700 uppercase tracking-widest block">
                {mode === 'edit' ? 'CHỈNH SỬA THÔNG SỐ GIẢI' : 'KHỞI TẠO MÙA GIẢI MỚI'}
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                {mode === 'edit' ? `Cấu Hình Giải ${sportMeta.label}` : `Tạo Mới Giải ${sportMeta.label}`}
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

          {/* Sport Selector */}
          <div className="p-4 rounded-2xl bg-sky-50/80 border border-sky-200 space-y-2.5">
            <span className="text-xs font-black text-sky-900 uppercase tracking-wider flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-sky-600" />
              Chọn Môn Thể Thao Thi Đấu
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {(
                [
                  { key: 'FOOTBALL' as SportType, icon: '⚽', title: 'Bóng Đá', desc: 'Sân 5 / Futsal • 2 hiệp' },
                  { key: 'BADMINTON' as SportType, icon: '🏸', title: 'Cầu Lông', desc: 'Đơn / Đôi • Tính ván (21đ)' },
                  { key: 'VOLLEYBALL' as SportType, icon: '🏐', title: 'Bóng Chuyền', desc: '6 người • Tính set (25đ/15đ)' },
                ]
              ).map((sp) => (
                <button
                  key={sp.key}
                  type="button"
                  onClick={() => handleSportTypeChange(sp.key)}
                  className={`p-3 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                    sportType === sp.key
                      ? 'bg-white border-blue-600 shadow-sm ring-2 ring-blue-500/20'
                      : 'bg-white/70 border-slate-200 hover:bg-white'
                  }`}
                >
                  <span className="text-2xl shrink-0">{sp.icon}</span>
                  <div className="min-w-0">
                    <div className="text-xs font-black text-slate-900">{sp.title}</div>
                    <div className="text-[11px] text-slate-600 truncate">{sp.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
          
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => handleFormatTypeChange('SINGLE_LEAGUE')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  formatType === 'SINGLE_LEAGUE'
                    ? 'bg-white border-blue-600 shadow-sm ring-2 ring-blue-500/20'
                    : 'bg-white/60 border-slate-200 hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-black text-slate-900">Vòng Tròn 1 Lượt</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 shrink-0">Chẵn &amp; Lẻ</span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1">
                  1 BXH chung (2–64 đội/VĐV). Top 1-2-3 nhận Nhất/Nhì/Ba.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleFormatTypeChange('KNOCKOUT')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  formatType === 'KNOCKOUT'
                    ? 'bg-white border-purple-600 shadow-sm ring-2 ring-purple-500/20'
                    : 'bg-white/60 border-slate-200 hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-black text-slate-900">Loại Trực Tiếp</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 shrink-0">BYE tự động</span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1">
                  Thua là bị loại ngay (2–64 đội/VĐV). Tự miễn vòng 1 khi đội lẻ.
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
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-black text-slate-900">Chia Bảng + Knockout</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 shrink-0">Mở rộng</span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1">
                  Chia nhiều bảng (A, B, C...) rồi Tứ kết, Bán kết, Chung kết.
                </p>
              </button>
            </div>
          </div>

          {/* Cấu hình luật thi đấu theo Set (Cầu lông & Bóng chuyền) */}
          {sportType !== 'FOOTBALL' && (
            <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-black text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                  <span>{sportMeta.icon}</span>
                  Cấu Hình Luật Thi Đấu Theo Set ({sportMeta.label})
                </span>
                <span className="text-[11px] font-bold text-emerald-800 bg-white px-2.5 py-0.5 rounded-lg border border-emerald-200">
                  {bestOf === 1
                    ? `1 Set (${pointsPerSet}đ)`
                    : `BO${bestOf} • ${pointsPerSet}đ (Set cuối ${decidingSetPoints}đ)`}
                </span>
              </div>

              <div className={`grid grid-cols-1 ${sportType === 'BADMINTON' ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-3 text-xs`}>
                <div>
                  <label className="text-[11px] text-slate-700 font-semibold block mb-1">
                    Số ván / set tối đa
                  </label>
                  <select
                    value={bestOf}
                    onChange={(e) => setBestOf(Number(e.target.value) as 1 | 3 | 5)}
                    className="w-full bg-white border border-slate-200 text-emerald-800 font-bold text-xs rounded-xl p-2.5 focus:outline-none focus:border-emerald-500 cursor-pointer shadow-xs"
                  >
                    <option value={1}>1 Set (Thắng luôn)</option>
                    <option value={3}>BO3 (Thắng 2 / 3 set)</option>
                    <option value={5}>BO5 (Thắng 3 / 5 set)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-slate-700 font-semibold block mb-1">
                    Điểm mỗi set thường
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={pointsPerSet}
                    onChange={(e) => setPointsPerSet(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 text-emerald-800 font-mono font-bold text-xs rounded-xl p-2.5 focus:outline-none focus:border-emerald-500 shadow-xs"
                  />
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {(sportType === 'BADMINTON' ? [11, 15, 21, 31] : [15, 21, 25]).map((pts) => (
                      <button
                        key={pts}
                        type="button"
                        onClick={() => setPointsPerSet(pts)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors ${
                          pointsPerSet === pts
                            ? 'bg-emerald-600 text-white border-emerald-700'
                            : 'bg-white text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                        }`}
                      >
                        {pts}đ
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-slate-700 font-semibold block mb-1">
                    {bestOf === 1 ? 'Điểm set quyết định (không áp dụng)' : `Điểm set quyết định (Set ${bestOf})`}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    disabled={bestOf === 1}
                    value={bestOf === 1 ? pointsPerSet : decidingSetPoints}
                    onChange={(e) => setDecidingSetPoints(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 text-emerald-800 font-mono font-bold text-xs rounded-xl p-2.5 focus:outline-none focus:border-emerald-500 shadow-xs"
                  />
                  {bestOf > 1 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {(sportType === 'BADMINTON' ? [15, 21] : [15, 21, 25]).map((pts) => (
                        <button
                          key={pts}
                          type="button"
                          onClick={() => setDecidingSetPoints(pts)}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors ${
                            decidingSetPoints === pts
                              ? 'bg-emerald-600 text-white border-emerald-700'
                              : 'bg-white text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                          }`}
                        >
                          {pts}đ
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {sportType === 'BADMINTON' && (
                  <div>
                    <label className="text-[11px] text-slate-700 font-semibold block mb-1">
                      Nội dung thi đấu
                    </label>
                    <select
                      value={badmintonCategory}
                      onChange={(e) => setBadmintonCategory(e.target.value as BadmintonCategory)}
                      className="w-full bg-white border border-slate-200 text-blue-700 font-bold text-xs rounded-xl p-2.5 focus:outline-none focus:border-blue-500 cursor-pointer shadow-xs"
                    >
                      <option value="MEN_SINGLES">Đơn Nam</option>
                      <option value="WOMEN_SINGLES">Đơn Nữ</option>
                      <option value="MEN_DOUBLES">Đôi Nam</option>
                      <option value="WOMEN_DOUBLES">Đôi Nữ</option>
                      <option value="MIXED_DOUBLES">Đôi Nam Nữ</option>
                      <option value="TEAM_TIE">Đồng Đội (Nhiều nội dung)</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-emerald-200/70 text-xs">
                <label className="flex items-center gap-2 font-semibold text-emerald-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={winByTwo}
                    onChange={(e) => setWinByTwo(e.target.checked)}
                    className="rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Thắng cách 2 điểm (Deuce)</span>
                </label>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-emerald-900">
                    Điểm trần tối đa (0 = không giới hạn):
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={maxPointCap}
                    onChange={(e) => setMaxPointCap(Number(e.target.value))}
                    className="w-20 bg-white border border-emerald-300 text-emerald-900 font-mono font-bold text-xs rounded-lg px-2 py-1 text-center focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <p className="text-[11px] text-emerald-900/80">
                {sportType === 'VOLLEYBALL'
                  ? '🏐 Xếp hạng chuẩn FIVB: Thắng 2-0/3-0/3-1 được 3đ; thắng 2-1/3-2 được 2đ (đội thua 1đ). Xét hiệu số set & điểm quả.'
                  : '🏸 Quy tắc BWF: Thắng nhận 3đ, thua 0đ (không có hòa). Xét đối đầu → hiệu số ván → hiệu số điểm cầu.'}
              </p>
            </div>
          )}

          {/* Cấu Hình Bảng Đấu & Số Đội */}
          {formatType === 'SINGLE_LEAGUE' || formatType === 'KNOCKOUT' ? (
            <div className={`p-4 rounded-2xl border space-y-3 ${formatType === 'KNOCKOUT' ? 'bg-purple-50/70 border-purple-200' : 'bg-blue-50/70 border-blue-200'}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${formatType === 'KNOCKOUT' ? 'text-purple-900' : 'text-blue-800'}`}>
                  <Layers className={`w-4 h-4 ${formatType === 'KNOCKOUT' ? 'text-purple-600' : 'text-blue-600'}`} />
                  {formatType === 'KNOCKOUT'
                    ? 'Cấu Hình Giải Loại Trực Tiếp (Chẵn & Lẻ)'
                    : 'Cấu Hình Giải Vòng Tròn 1 Lượt'}
                </span>
                <span className={`text-xs font-mono font-black px-2.5 py-1 rounded-lg border ${formatType === 'KNOCKOUT' ? 'text-purple-800 bg-purple-100 border-purple-300' : 'text-blue-700 bg-blue-100 border-blue-300'}`}>
                  {formatType === 'KNOCKOUT'
                    ? `${safeMaxTeamsPreview} ${sportMeta.unitShortLabel} • ${totalScheduledPreviewMatches} Trận • ${knockoutByeCount > 0 ? `${knockoutByeCount} BYE vòng 1` : `Nhánh ${nextPowerOfTwoPreview}`} • ~${estimatedMatchDays} Ngày`
                    : `${safeMaxTeamsPreview} ${sportMeta.unitShortLabel} • ${totalScheduledPreviewMatches} Trận • ~${estimatedMatchDays} Ngày (${safeVenuesPreview} sân × ${safeSlotsPreview} trận/ngày)`}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="text-[11px] text-slate-700 font-semibold block mb-1">
                    Số {sportMeta.unitShortLabel.toLowerCase()} (chẵn/lẻ 2–64)
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={64}
                    value={maxTeams}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setMaxTeams(v);
                      setTeamsPerGroup(v);
                    }}
                    className="w-full bg-white border border-slate-200 text-blue-700 font-mono font-bold text-xs rounded-xl p-2.5 focus:outline-none focus:border-blue-500 shadow-xs"
                  />
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {(sportType === 'BADMINTON' || sportType === 'VOLLEYBALL'
                      ? [3, 5, 6, 7, 8, 9, 11, 12, 16]
                      : [4, 5, 6, 7, 8, 12, 16]
                    ).map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => {
                          setMaxTeams(cnt);
                          setTeamsPerGroup(cnt);
                        }}
                        className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold border transition-colors ${
                          maxTeams === cnt
                            ? 'bg-blue-600 text-white border-blue-700'
                            : cnt % 2 === 1
                              ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                              : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-100'
                        }`}
                        title={cnt % 2 === 1 ? `${cnt} (số lẻ)` : `${cnt}`}
                      >
                        {cnt}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-slate-700 font-semibold block mb-1">
                    Số sân thuê mỗi ngày (1–16)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={16}
                    value={numberOfVenues}
                    onChange={(e) => setNumberOfVenues(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 text-sky-700 font-mono font-bold text-xs rounded-xl p-2.5 focus:outline-none focus:border-sky-500 shadow-xs"
                  />
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {[1, 2, 3, 4, 6, 8].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setNumberOfVenues(v)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors ${
                          numberOfVenues === v
                            ? 'bg-sky-600 text-white border-sky-700'
                            : 'bg-white text-sky-700 border-sky-200 hover:bg-sky-100'
                        }`}
                      >
                        {v} sân
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-slate-700 font-semibold block mb-1">
                    Số trận / sân / ngày (1–24)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={24}
                    value={slotsPerDay}
                    onChange={(e) => setSlotsPerDay(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 text-indigo-700 font-mono font-bold text-xs rounded-xl p-2.5 focus:outline-none focus:border-indigo-500 shadow-xs"
                  />
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {(sportType === 'BADMINTON' ? [4, 6, 8, 12] : sportType === 'VOLLEYBALL' ? [2, 4, 6] : [2, 3, 4]).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSlotsPerDay(s)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors ${
                          slotsPerDay === s
                            ? 'bg-indigo-600 text-white border-indigo-700'
                            : 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                        }`}
                      >
                        {s} ca
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-slate-700 font-semibold block mb-1">
                    {sportType === 'FOOTBALL' ? 'Thời lượng 1 trận (phút)' : 'Thời lượng dự kiến 1 trận (phút)'}
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={180}
                    value={matchDurationMinutes}
                    onChange={(e) => setMatchDurationMinutes(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 text-emerald-700 font-mono font-bold text-xs rounded-xl p-2.5 focus:outline-none focus:border-emerald-500 shadow-xs"
                  />
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {(sportType === 'BADMINTON' ? [20, 30, 45, 60] : sportType === 'VOLLEYBALL' ? [45, 60, 75, 90] : [40, 50, 60]).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMatchDurationMinutes(m)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors ${
                          matchDurationMinutes === m
                            ? 'bg-emerald-600 text-white border-emerald-700'
                            : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                        }`}
                      >
                        {m}p
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {formatType === 'KNOCKOUT' && safeMaxTeamsPreview >= 4 && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-purple-200/70 text-xs">
                  <label className="flex items-center gap-2 font-semibold text-purple-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasThirdPlace}
                      onChange={(e) => setHasThirdPlace(e.target.checked)}
                      className="rounded border-purple-400 text-purple-600 focus:ring-purple-500"
                    />
                    <span>Có trận Tranh Hạng 3 (bỏ chọn = 2 đội thua Bán kết Đồng Hạng Ba)</span>
                  </label>
                </div>
              )}

              <p className={`text-[11px] ${formatType === 'KNOCKOUT' ? 'text-purple-900/80' : 'text-blue-800/80'}`}>
                {formatType === 'KNOCKOUT'
                  ? `${sportMeta.icon} Nhánh loại trực tiếp ${nextPowerOfTwoPreview} suất: ${knockoutByeCount > 0 ? `với ${safeMaxTeamsPreview} ${sportMeta.unitShortLabel.toLowerCase()}, hệ thống tự phân ${knockoutByeCount} suất miễn vòng 1 (BYE) đối xứng để không đội nào phải đấu thừa.` : `đủ ${safeMaxTeamsPreview} ${sportMeta.unitShortLabel.toLowerCase()} đấu trực tiếp từ vòng 1.`}`
                  : sportType === 'FOOTBALL'
                    ? '⏱️ Đồng hồ chạy liên tục không bù giờ. Hỗ trợ tùy chỉnh số đội (chẵn/lẻ), số sân, số ca/ngày và thời lượng trận.'
                    : `${sportMeta.icon} Thể thức vòng tròn 1 lượt (${safeMaxTeamsPreview} ${sportMeta.unitShortLabel.toLowerCase()}, ${totalScheduledPreviewMatches} trận, công suất ${safeVenuesPreview * safeSlotsPreview} trận/ngày), tự động hỗ trợ cả số lượng lẻ (BYE).`}
              </p>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-black text-blue-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-blue-600" />
                  Cấu Hình Số Bảng Đấu &amp; Số Đội 1 Bảng
                </span>
                <span className="text-xs font-mono font-black text-blue-700 bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-300">
                  {numberOfGroups} Bảng (Tối đa {maxTeams} {sportMeta.unitShortLabel}) • {safeVenuesPreview} Sân × {safeSlotsPreview} Ca
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="text-[11px] text-slate-700 font-semibold block mb-1">
                    Số lượng bảng đấu (1–16)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={16}
                    value={numberOfGroups}
                    onChange={(e) => handleGroupCountChange(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 text-blue-700 font-mono font-bold text-xs rounded-xl p-2.5 focus:outline-none focus:border-blue-500 shadow-xs"
                  />
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {[2, 3, 4, 6, 8].map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => handleGroupCountChange(g)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors ${
                          numberOfGroups === g
                            ? 'bg-blue-600 text-white border-blue-700'
                            : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-100'
                        }`}
                      >
                        {g}B
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-slate-700 font-semibold block mb-1">
                    Số {sportMeta.unitShortLabel.toLowerCase()} / bảng (2–16)
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={16}
                    value={teamsPerGroup}
                    onChange={(e) => handleTeamsPerGroupChange(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 text-blue-700 font-mono font-bold text-xs rounded-xl p-2.5 focus:outline-none focus:border-blue-500 shadow-xs"
                  />
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {[3, 4, 5, 6].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => handleTeamsPerGroupChange(t)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors ${
                          teamsPerGroup === t
                            ? 'bg-blue-600 text-white border-blue-700'
                            : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-100'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-slate-700 font-semibold block mb-1">
                    Số {sportMeta.unitShortLabel.toLowerCase()} vào Knockout / bảng
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={Math.max(1, teamsPerGroup)}
                    value={advancePerGroup}
                    onChange={(e) => setAdvancePerGroup(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 text-indigo-700 font-mono font-bold text-xs rounded-xl p-2.5 focus:outline-none focus:border-indigo-500 shadow-xs"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-700 font-semibold block mb-1">
                    Số sân thi đấu (1–16)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={16}
                    value={numberOfVenues}
                    onChange={(e) => setNumberOfVenues(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 text-sky-700 font-mono font-bold text-xs rounded-xl p-2.5 focus:outline-none focus:border-sky-500 shadow-xs"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-700 font-semibold block mb-1">
                    Số trận / sân / ngày (1–24)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={24}
                    value={slotsPerDay}
                    onChange={(e) => setSlotsPerDay(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 text-indigo-700 font-mono font-bold text-xs rounded-xl p-2.5 focus:outline-none focus:border-indigo-500 shadow-xs"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-700 font-semibold block mb-1">
                    Thời lượng trận (phút)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={180}
                    value={matchDurationMinutes}
                    onChange={(e) => setMatchDurationMinutes(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 text-emerald-700 font-mono font-bold text-xs rounded-xl p-2.5 focus:outline-none focus:border-emerald-500 shadow-xs"
                  />
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
                <label className="text-[11px] text-slate-500 block mb-1">{sportMeta.playerLabel} max/đội</label>
                <input
                  type="number"
                  min={1}
                  value={maxPlayersPerTeam}
                  onChange={(e) => setMaxPlayersPerTeam(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 text-slate-900 text-xs rounded-lg p-2 font-mono font-bold focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-500 block mb-1">
                  {sportType === 'FOOTBALL' ? 'Nghỉ giữa hiệp (phút)' : 'Nghỉ giữa set (phút)'}
                </label>
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
