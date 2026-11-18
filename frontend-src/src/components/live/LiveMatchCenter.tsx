'use client';

import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  Match,
  Team,
  MatchEvent,
  MatchSetScore,
  CardType,
  UserRole,
  Tournament,
  getSportMeta,
  getEffectiveSetConfig,
  determineSetWinner,
  computeSetsSummary,
  formatMatchSetsCompact,
} from '@/types';
import { StorageService } from '@/services/storage';
import { SoundFX } from '@/utils/soundEffects';
import { DisciplineEngine } from '@/services/disciplineEngine';
import { KnockoutEngine } from '@/services/knockoutEngine';
import {
  Play,
  Pause,
  Coffee,
  CheckCircle2,
  Clock,
  PlusCircle,
  RotateCcw,
  Shield,
  AlertTriangle,
  Flame,
  FileEdit,
  ArrowRightLeft,
  Award,
  MapPin,
  Ban,
} from 'lucide-react';

interface LiveMatchCenterProps {
  matches: Match[];
  teams: Team[];
  onMatchesUpdate: (matches: Match[]) => void;
  currentRole: UserRole;
  selectedMatchId?: string;
  tournament?: Tournament;
}

export const LiveMatchCenter: React.FC<LiveMatchCenterProps> = ({
  matches,
  teams,
  onMatchesUpdate,
  currentRole,
  selectedMatchId,
  tournament,
}) => {
  const isSingleLeague = (tournament?.formatType || 'SINGLE_LEAGUE') === 'SINGLE_LEAGUE';
  const sportType = tournament?.sportType || 'FOOTBALL';
  const sportMeta = getSportMeta(sportType);
  const isSetSport = sportMeta.isSetSport;
  const setConfig = getEffectiveSetConfig(tournament);
  const setsToWin = Math.ceil(setConfig.bestOf / 2);

  // Find current match or default to first LIVE match or first match
  const defaultMatchId =
    selectedMatchId ||
    matches.find((m) => m.status === 'LIVE')?.id ||
    matches[0]?.id ||
    '';

  const [activeMatchId, setActiveMatchId] = useState<string>(defaultMatchId);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);
  const [seconds, setSeconds] = useState<number>(0);

  // Modals state
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [subModalOpen, setSubModalOpen] = useState(false);
  const [penaltyModalOpen, setPenaltyModalOpen] = useState(false);
  const [postEditModalOpen, setPostEditModalOpen] = useState(false);
  const [forfeitModalOpen, setForfeitModalOpen] = useState(false);
  const [timeConfigModalOpen, setTimeConfigModalOpen] = useState(false);
  const [quickSetsModalOpen, setQuickSetsModalOpen] = useState(false);
  const [activeSetNum, setActiveSetNum] = useState<number>(1);
  const [quickSetsDraft, setQuickSetsDraft] = useState<MatchSetScore[]>([]);
  const [quickSetsFinishMatch, setQuickSetsFinishMatch] = useState<boolean>(true);
  const [editMatchDurationInput, setEditMatchDurationInput] = useState<number>(60);
  const [editMatchBreakInput, setEditMatchBreakInput] = useState<number>(5);
  const [editMatchCurrentMinInput, setEditMatchCurrentMinInput] = useState<number>(0);
  const [forfeitTeamId, setForfeitTeamId] = useState<string>('');
  const [forfeitReason, setForfeitReason] = useState<string>('Đến trễ quá 10 phút so với giờ thi đấu');
  const [postEditReason, setPostEditReason] = useState('');

  // Selected team for event creation
  const [eventTeamId, setEventTeamId] = useState<string>('');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');
  const [selectedAssistId, setSelectedAssistId] = useState<string>('');
  const [selectedPlayerOutId, setSelectedPlayerOutId] = useState<string>('');
  const [selectedPlayerInId, setSelectedPlayerInId] = useState<string>('');
  const [cardType, setCardType] = useState<CardType>('YELLOW');
  const [cardReason, setCardReason] = useState<string>('Phạm lỗi tranh chấp');
  const [isOwnGoal, setIsOwnGoal] = useState<boolean>(false);
  const [eventMinute, setEventMinute] = useState<number>(1);

  // Penalty shootout state
  const [penHome, setPenHome] = useState<number>(4);
  const [penAway, setPenAway] = useState<number>(3);

  useEffect(() => {
    if (selectedMatchId) {
      setActiveMatchId(selectedMatchId);
    }
  }, [selectedMatchId]);

  const activeMatch = matches.find((m) => m.id === activeMatchId);
  const matchDurationMinutes = activeMatch?.durationMinutes || tournament?.matchDurationMinutes || (isSingleLeague ? 60 : 40);
  const halfDurationMinutes = Math.floor(matchDurationMinutes / 2);
  const breakDurationMinutes = activeMatch?.breakDurationMinutes ?? tournament?.breakDurationMinutes ?? 5;
  const homeTeam = teams.find((t) => t.id === activeMatch?.homeTeamId);
  const awayTeam = teams.find((t) => t.id === activeMatch?.awayTeamId);

  // Sắp xếp danh sách trận đấu trên thanh chọn: LIVE trước -> sắp đá theo thời gian sớm nhất -> đã kết thúc
  const sortedStripMatches = [...matches].sort((a, b) => {
    if (a.status === 'LIVE' && b.status !== 'LIVE') return -1;
    if (b.status === 'LIVE' && a.status !== 'LIVE') return 1;
    if (a.status === 'SCHEDULED' && b.status !== 'FINISHED') return -1;
    if (b.status === 'SCHEDULED' && a.status === 'FINISHED') return 1;
    const dateComp = (a.date || '').localeCompare(b.date || '');
    if (dateComp !== 0) return dateComp;
    const timeComp = (a.time || '').localeCompare(b.time || '');
    if (timeComp !== 0) return timeComp;
    return (a.matchNumber || 0) - (b.matchNumber || 0);
  });

  // Synchronize timer & active set with match state
  useEffect(() => {
    if (activeMatch) {
      setSeconds(activeMatch.currentMinute * 60);
      setTimerRunning(activeMatch.status === 'LIVE');
      setEventMinute(Math.max(1, activeMatch.currentMinute));
      setActiveSetNum(Math.min(setConfig.bestOf, Math.max(1, activeMatch.currentSet || 1)));
    }
  }, [activeMatchId, activeMatch?.currentMinute, activeMatch?.status, activeMatch?.currentSet, setConfig.bestOf]);

  // Live timer interval (continuous clock without stoppage time for Football; stopwatch only for Set sports)
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (timerRunning && activeMatch && activeMatch.status === 'LIVE') {
      interval = setInterval(() => {
        setSeconds((prev) => {
          const next = prev + 1;
          if (!isSetSport) {
            const min = Math.floor(next / 60);
            if (min === halfDurationMinutes && activeMatch.half === 1) {
              handleSetHalftime();
            } else if (min >= matchDurationMinutes) {
              handleFinishMatch();
            }
          }
          return next;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerRunning, activeMatch?.half, activeMatch?.status, halfDurationMinutes, matchDurationMinutes, isSetSport]);

  const canEdit =
    currentRole === 'SUPER_ADMIN' ||
    currentRole === 'ORGANIZER' ||
    currentRole === 'REFEREE';

  // Trigger goal confetti and fanfare
  const triggerCelebration = () => {
    SoundFX.playGoalFanfare();
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#10B981', '#00F5D4', '#F59E0B', '#EF4444', '#FFFFFF'],
    });
  };

  // Match control actions
  const handleStartResume = () => {
    if (!activeMatch) return;
    SoundFX.playWhistle();
    const updated = matches.map((m) =>
      m.id === activeMatch.id ? { ...m, status: 'LIVE' as const } : m
    );
    onMatchesUpdate(updated);
    StorageService.saveMatches(updated);
    setTimerRunning(true);
    StorageService.logAction(
      currentRole,
      currentRole,
      'BẮT ĐẦU / TIẾP TỤC TRẬN ĐẤU',
      activeMatch.roundLabel,
      `Bắt đầu hiệp ${activeMatch.half} lúc phút ${Math.floor(seconds / 60)}`
    );
  };

  const handlePause = () => {
    if (!activeMatch) return;
    setTimerRunning(false);
    StorageService.logAction(
      currentRole,
      currentRole,
      'TẠM DỪNG TRẬN ĐẤU',
      activeMatch.roundLabel,
      `Tạm dừng trận đấu ở phút ${Math.floor(seconds / 60)}`
    );
  };

  const handleSetHalftime = () => {
    if (!activeMatch) return;
    SoundFX.playWhistle();
    const updated = matches.map((m) =>
      m.id === activeMatch.id
        ? {
          ...m,
          status: 'HALFTIME' as const,
          half: 2 as const,
          currentMinute: halfDurationMinutes,
        }
        : m
    );
    onMatchesUpdate(updated);
    StorageService.saveMatches(updated);
    setTimerRunning(false);
  };

  const handleFinishMatch = () => {
    if (!activeMatch) return;
    SoundFX.playWhistle();
    setTimerRunning(false);

    // If knockout (only in GROUP_KNOCKOUT) and tied -> require penalty shootout modal (Football only)
    const isKnockout = !isSingleLeague && activeMatch.round !== 'GROUP';
    const isTied = activeMatch.homeScore === activeMatch.awayScore;

    if (!isSetSport && isKnockout && isTied && !activeMatch.penaltyShootout) {
      setPenaltyModalOpen(true);
      return;
    }

    const computedWinnerId =
      activeMatch.homeScore > activeMatch.awayScore
        ? activeMatch.homeTeamId
        : activeMatch.awayScore > activeMatch.homeScore
          ? activeMatch.awayTeamId
          : activeMatch.winnerTeamId;

    const updated = matches.map((m) =>
      m.id === activeMatch.id
        ? {
          ...m,
          status: 'FINISHED' as const,
          currentMinute: isSetSport ? Math.floor(seconds / 60) : matchDurationMinutes,
          ...(computedWinnerId ? { winnerTeamId: computedWinnerId } : {}),
          completedAt: new Date().toISOString(),
        }
        : m
    );

    const finalMatches = isSingleLeague
      ? updated
      : KnockoutEngine.generateOrUpdateBracket(teams, updated);
    onMatchesUpdate(finalMatches);
    StorageService.saveMatches(finalMatches);

    if (!isSetSport) {
      DisciplineEngine.evaluateAllPlayers(
        teams,
        finalMatches,
        tournament?.formatType || 'SINGLE_LEAGUE'
      );
      StorageService.saveTeams(teams);
    }

    const setsCompact = formatMatchSetsCompact(activeMatch);
    StorageService.logAction(
      currentRole,
      currentRole,
      'KẾT THÚC TRẬN ĐẤU',
      activeMatch.roundLabel,
      `Tỷ số chung cuộc: ${homeTeam?.name} ${activeMatch.homeScore} - ${activeMatch.awayScore} ${awayTeam?.name}${setsCompact ? ` (${setsCompact})` : ''}.`
    );
  };

  const getMatchSets = (match: Match): MatchSetScore[] => {
    const existing = Array.isArray(match.sets) ? match.sets : [];
    const len = Math.max(existing.length, activeSetNum, 1);
    return Array.from({ length: Math.min(setConfig.bestOf, len) }, (_, idx) => {
      const setNumber = idx + 1;
      const found = existing.find((s) => s.setNumber === setNumber);
      return found ? { ...found } : { setNumber, homePoints: 0, awayPoints: 0 };
    });
  };

  const handleUpdateSetPoints = (setNum: number, nextHomePts: number, nextAwayPts: number) => {
    if (!activeMatch) return;
    const clampedHome = Math.max(0, Math.min(99, Number(nextHomePts) || 0));
    const clampedAway = Math.max(0, Math.min(99, Number(nextAwayPts) || 0));

    const currentSets = getMatchSets(activeMatch);
    const mergedSets: MatchSetScore[] = Array.from(
      { length: Math.max(currentSets.length, setNum) },
      (_, idx) => {
        const sNum = idx + 1;
        const base = currentSets.find((s) => s.setNumber === sNum) || {
          setNumber: sNum,
          homePoints: 0,
          awayPoints: 0,
        };
        if (sNum === setNum) {
          const w = determineSetWinner(clampedHome, clampedAway, sNum, setConfig);
          return { setNumber: sNum, homePoints: clampedHome, awayPoints: clampedAway, ...(w ? { winner: w } : {}) };
        }
        return base;
      }
    );

    const summary = computeSetsSummary(mergedSets, setConfig);
    const nextWinnerId =
      summary.homeSetsWon >= setsToWin
        ? activeMatch.homeTeamId
        : summary.awaySetsWon >= setsToWin
          ? activeMatch.awayTeamId
          : undefined;

    const updated = matches.map((m) =>
      m.id === activeMatch.id
        ? {
          ...m,
          status: m.status === 'SCHEDULED' ? ('LIVE' as const) : m.status,
          homeScore: summary.homeSetsWon,
          awayScore: summary.awaySetsWon,
          sets: summary.normalizedSets,
          currentSet: setNum,
          winnerTeamId: nextWinnerId,
        }
        : m
    );
    onMatchesUpdate(updated);
    StorageService.saveMatches(updated);
  };

  const handleConfirmSetAndAdvance = () => {
    if (!activeMatch) return;
    const currentSets = getMatchSets(activeMatch);
    const curSet = currentSets.find((s) => s.setNumber === activeSetNum) || {
      setNumber: activeSetNum,
      homePoints: 0,
      awayPoints: 0,
    };
    if (curSet.homePoints === curSet.awayPoints) {
      alert(`Set ${activeSetNum} đang hòa điểm (${curSet.homePoints}-${curSet.awayPoints}), chưa xác định đội thắng set!`);
      return;
    }
    const setWinnerSide: 'HOME' | 'AWAY' = curSet.homePoints > curSet.awayPoints ? 'HOME' : 'AWAY';
    const winningTeam = setWinnerSide === 'HOME' ? homeTeam : awayTeam;

    const updatedSets = currentSets.map((s) =>
      s.setNumber === activeSetNum ? { ...s, winner: setWinnerSide } : s
    );
    const summary = computeSetsSummary(updatedSets, setConfig);
    const nextSet = Math.min(setConfig.bestOf, activeSetNum + 1);
    const hasMatchWinner = summary.homeSetsWon >= setsToWin || summary.awaySetsWon >= setsToWin;

    const setEvent: MatchEvent = {
      id: `EV-SET-${Date.now()}`,
      matchId: activeMatch.id,
      type: 'SET_WIN',
      minute: Math.floor(seconds / 60),
      teamId: winningTeam?.id || activeMatch.homeTeamId,
      setNumber: activeSetNum,
      setScoreLabel: `${curSet.homePoints}-${curSet.awayPoints}`,
      reason: `${winningTeam?.name || 'Đội thắng'} thắng Set ${activeSetNum} với tỷ số ${curSet.homePoints} - ${curSet.awayPoints}`,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    const updated = matches.map((m) =>
      m.id === activeMatch.id
        ? {
          ...m,
          status: 'LIVE' as const,
          homeScore: summary.homeSetsWon,
          awayScore: summary.awaySetsWon,
          sets: summary.normalizedSets,
          currentSet: hasMatchWinner ? activeSetNum : nextSet,
          winnerTeamId:
            summary.homeSetsWon >= setsToWin
              ? activeMatch.homeTeamId
              : summary.awaySetsWon >= setsToWin
                ? activeMatch.awayTeamId
                : undefined,
          events: [...m.events, setEvent],
        }
        : m
    );
    onMatchesUpdate(updated);
    StorageService.saveMatches(updated);
    if (!hasMatchWinner && activeSetNum < setConfig.bestOf) {
      setActiveSetNum(nextSet);
    }
    triggerCelebration();

    StorageService.logAction(
      currentRole,
      currentRole,
      `CHỐT SET ${activeSetNum} (${sportMeta.label.toUpperCase()})`,
      activeMatch.roundLabel,
      `Set ${activeSetNum}: ${homeTeam?.shortName} ${curSet.homePoints} - ${curSet.awayPoints} ${awayTeam?.shortName}. Tỷ số set: ${summary.homeSetsWon} - ${summary.awaySetsWon}`
    );
  };

  const handleOpenQuickSets = () => {
    if (!activeMatch) return;
    const existing = Array.isArray(activeMatch.sets) ? activeMatch.sets : [];
    const draft = Array.from({ length: setConfig.bestOf }, (_, idx) => {
      const sNum = idx + 1;
      const found = existing.find((s) => s.setNumber === sNum);
      return found ? { ...found } : { setNumber: sNum, homePoints: 0, awayPoints: 0 };
    });
    setQuickSetsDraft(draft);
    setQuickSetsFinishMatch(true);
    setQuickSetsModalOpen(true);
  };

  const handleSaveQuickSets = () => {
    if (!activeMatch) return;
    const nonZeroSets = quickSetsDraft.filter((s) => s.homePoints > 0 || s.awayPoints > 0);
    const setsWithWinner: MatchSetScore[] = nonZeroSets.map((s) => {
      const explicitWinner: 'HOME' | 'AWAY' | undefined =
        determineSetWinner(s.homePoints, s.awayPoints, s.setNumber, setConfig) ||
        (s.homePoints > s.awayPoints ? 'HOME' : s.awayPoints > s.homePoints ? 'AWAY' : undefined);
      return {
        setNumber: s.setNumber,
        homePoints: Math.max(0, Number(s.homePoints) || 0),
        awayPoints: Math.max(0, Number(s.awayPoints) || 0),
        ...(explicitWinner ? { winner: explicitWinner } : {}),
      };
    });

    const summary = computeSetsSummary(setsWithWinner, setConfig);
    const winnerId =
      summary.homeSetsWon > summary.awaySetsWon
        ? activeMatch.homeTeamId
        : summary.awaySetsWon > summary.homeSetsWon
          ? activeMatch.awayTeamId
          : undefined;
    const shouldFinish =
      quickSetsFinishMatch &&
      (summary.homeSetsWon >= setsToWin || summary.awaySetsWon >= setsToWin);

    const updated = matches.map((m) =>
      m.id === activeMatch.id
        ? {
          ...m,
          homeScore: summary.homeSetsWon,
          awayScore: summary.awaySetsWon,
          sets: summary.normalizedSets,
          currentSet: Math.min(setConfig.bestOf, Math.max(1, summary.normalizedSets.length)),
          winnerTeamId: winnerId,
          status: shouldFinish ? ('FINISHED' as const) : m.status === 'SCHEDULED' ? ('LIVE' as const) : m.status,
          ...(shouldFinish ? { completedAt: new Date().toISOString() } : {}),
        }
        : m
    );

    const finalMatches = isSingleLeague
      ? updated
      : KnockoutEngine.generateOrUpdateBracket(teams, updated);
    onMatchesUpdate(finalMatches);
    StorageService.saveMatches(finalMatches);
    setQuickSetsModalOpen(false);
    if (shouldFinish) {
      setTimerRunning(false);
      triggerCelebration();
    }

    const setsStr = summary.normalizedSets.map((s) => `${s.homePoints}-${s.awayPoints}`).join(', ');
    StorageService.logAction(
      currentRole,
      currentRole,
      `NHẬP TỶ SỐ SET (${sportMeta.label.toUpperCase()})`,
      activeMatch.roundLabel,
      `${homeTeam?.shortName} ${summary.homeSetsWon} - ${summary.awaySetsWon} ${awayTeam?.shortName} (${setsStr || '0-0'})`
    );
  };

  // Chỉnh sửa thời lượng & phút hiện tại của riêng trận đấu đang chọn
  const handleSaveMatchTimeConfig = () => {
    if (!activeMatch) return;
    const validDuration = Math.max(10, Math.min(180, Number(editMatchDurationInput) || 60));
    const validBreak = Math.max(0, Math.min(30, Number(editMatchBreakInput) || 5));
    const validMinute = Math.max(0, Math.min(validDuration, Number(editMatchCurrentMinInput) || 0));

    const updated = matches.map((m) =>
      m.id === activeMatch.id
        ? {
          ...m,
          durationMinutes: validDuration,
          breakDurationMinutes: validBreak,
          currentMinute: validMinute,
          half: (validMinute > Math.floor(validDuration / 2) ? 2 : 1) as 1 | 2,
        }
        : m
    );
    onMatchesUpdate(updated);
    StorageService.saveMatches(updated);
    setSeconds(validMinute * 60);
    setEventMinute(Math.max(1, validMinute));
    setTimeConfigModalOpen(false);

    StorageService.logAction(
      currentRole,
      currentRole,
      'ĐIỀU CHỈNH THỜI GIAN THI ĐẤU TRẬN',
      activeMatch.roundLabel,
      `Trận #${activeMatch.matchNumber}: Thời lượng ${validDuration}p (2×${Math.floor(validDuration / 2)}p, nghỉ ${validBreak}p), phút đồng hồ ${validMinute}'.`
    );
  };

  // Xử thua (Đội đến trễ quá 10 phút / không đủ người / bỏ trận)
  const handleConfirmForfeit = () => {
    if (!activeMatch || !forfeitTeamId) return;
    const isHomeForfeit = forfeitTeamId === activeMatch.homeTeamId;
    const forfeitedTeam = isHomeForfeit ? homeTeam : awayTeam;
    const winningTeam = isHomeForfeit ? awayTeam : homeTeam;
    const forfeitWinScore = isSetSport ? setsToWin : 3;
    const forfeitSets: MatchSetScore[] | undefined = isSetSport
      ? Array.from({ length: setsToWin }, (_, i) => ({
        setNumber: i + 1,
        homePoints: isHomeForfeit ? 0 : setConfig.pointsPerSet,
        awayPoints: isHomeForfeit ? setConfig.pointsPerSet : 0,
        winner: (isHomeForfeit ? 'AWAY' : 'HOME') as 'HOME' | 'AWAY',
      }))
      : undefined;

    const noteEvent: MatchEvent = {
      id: `EV-FORFEIT-${Date.now()}`,
      matchId: activeMatch.id,
      type: 'NOTE',
      minute: activeMatch.currentMinute || 0,
      teamId: forfeitTeamId,
      reason: `Xử thua 0–${forfeitWinScore} đội ${forfeitedTeam?.name || forfeitTeamId}: ${forfeitReason}`,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    const updated = matches.map((m) =>
      m.id === activeMatch.id
        ? {
          ...m,
          status: 'FINISHED' as const,
          homeScore: isHomeForfeit ? 0 : forfeitWinScore,
          awayScore: isHomeForfeit ? forfeitWinScore : 0,
          ...(forfeitSets ? { sets: forfeitSets } : {}),
          currentMinute: isSetSport ? Math.floor(seconds / 60) : matchDurationMinutes,
          winnerTeamId: winningTeam?.id,
          isForfeit: true,
          forfeitedTeamId: forfeitTeamId,
          forfeitReason: forfeitReason.trim() || 'Vi phạm quy chế thời gian / bỏ cuộc',
          completedAt: new Date().toISOString(),
          events: [...m.events, noteEvent],
        }
        : m
    );

    const finalMatches = isSingleLeague
      ? updated
      : KnockoutEngine.generateOrUpdateBracket(teams, updated);
    onMatchesUpdate(finalMatches);
    StorageService.saveMatches(finalMatches);
    setForfeitModalOpen(false);
    setTimerRunning(false);

    StorageService.logAction(
      currentRole,
      currentRole,
      `XỬ THUA 0–${forfeitWinScore} (TRỄ QUÁ 10 PHÚT / BỎ CUỘC)`,
      activeMatch.roundLabel,
      `Xử thua 0–${forfeitWinScore} đối với ${forfeitedTeam?.name}. ${winningTeam?.name} thắng ${forfeitWinScore}–0. Lý do: ${forfeitReason}`
    );
  };

  // Add Goal Handler
  const handleSaveGoal = () => {
    if (!activeMatch || !eventTeamId || !selectedPlayerId) return;

    const scoringTeam = eventTeamId === homeTeam?.id ? homeTeam : awayTeam;
    const player = scoringTeam?.players.find((p) => p.id === selectedPlayerId);
    const assist = scoringTeam?.players.find((p) => p.id === selectedAssistId);

    const isHome = eventTeamId === homeTeam?.id;
    const newHomeScore = isHome ? activeMatch.homeScore + 1 : activeMatch.homeScore;
    const newAwayScore = !isHome ? activeMatch.awayScore + 1 : activeMatch.awayScore;

    const newEvent: MatchEvent = {
      id: `EV-${Date.now()}`,
      matchId: activeMatch.id,
      type: 'GOAL',
      minute: eventMinute,
      teamId: eventTeamId,
      playerId: player?.id,
      playerName: player?.name || 'Cầu thủ',
      assistPlayerId: assist?.id,
      assistPlayerName: assist?.name,
      isOwnGoal,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    const updated = matches.map((m) =>
      m.id === activeMatch.id
        ? {
          ...m,
          homeScore: newHomeScore,
          awayScore: newAwayScore,
          events: [...m.events, newEvent],
        }
        : m
    );

    // Update player goals
    if (player && !isOwnGoal) {
      player.goals = (player.goals || 0) + 1;
      if (assist) assist.assists = (assist.assists || 0) + 1;
      StorageService.saveTeams(teams);
    }

    onMatchesUpdate(updated);
    StorageService.saveMatches(updated);
    setGoalModalOpen(false);
    triggerCelebration();

    StorageService.logAction(
      currentRole,
      currentRole,
      'GHI BÀN THẮNG',
      activeMatch.roundLabel,
      `Bàn thắng phút ${eventMinute}: ${player?.name} (${scoringTeam?.name}). Tỷ số: ${newHomeScore} - ${newAwayScore}`
    );
  };

  // Add Card Handler (Phạt thẻ & tiền phạt CTUT / kỷ luật)
  const handleSaveCard = () => {
    if (!activeMatch || !eventTeamId || !selectedPlayerId) return;

    const cardedTeam = eventTeamId === homeTeam?.id ? homeTeam : awayTeam;
    const player = cardedTeam?.players.find((p) => p.id === selectedPlayerId);
    if (!player) return;

    let finalCardType = cardType;
    let actionNote = '';

    const hasYellowInSameMatch = activeMatch.events.some(
      (ev) => ev.type === 'CARD' && ev.playerId === player.id && ev.cardType === 'YELLOW'
    );

    if (cardType === 'YELLOW') {
      if (isSingleLeague) {
        if (hasYellowInSameMatch) {
          // 02 thẻ vàng trong CÙNG 01 trận: truất quyền thi đấu trận đó + phạt 50.000đ (không tự treo giò trận sau)
          finalCardType = 'SECOND_YELLOW';
          player.yellowCards += 1;
          player.redCards += 1;
          actionNote = '🟥🟥 02 THẺ VÀNG CÙNG TRẬN: Truất quyền trận này + Phạt 50.000đ!';
        } else {
          player.yellowCards += 1;
          actionNote = '🟨 Thẻ vàng: Phạt 20.000đ (không cộng dồn treo giò).';
        }
      } else {
        if (player.yellowCards >= 1) {
          finalCardType = 'SECOND_YELLOW';
          player.yellowCards += 1;
          player.redCards += 1;
          player.isSuspended = true;
          player.suspensionReason = 'Tích lũy 2 thẻ vàng - Treo giò 01 trận tiếp theo';
          actionNote = '⚠️ KÍCH HOẠT ÁN TREO GIÒ 01 TRẬN!';
        } else {
          player.yellowCards += 1;
        }
      }
    } else if (cardType === 'RED') {
      player.redCards += 1;
      if (isSingleLeague) {
        actionNote = '🟥 THẺ ĐỎ TRỰC TIẾP: Truất quyền ngay + Phạt 100.000đ (Chờ BTC quyết định đình chỉ trận sau).';
      } else {
        player.isSuspended = true;
        player.suspensionReason = 'Thẻ đỏ trực tiếp - Treo giò theo quyết định BTC';
        actionNote = '⚠️ KÍCH HOẠT ÁN TREO GIÒ!';
      }
    }

    const newEvent: MatchEvent = {
      id: `EV-${Date.now()}`,
      matchId: activeMatch.id,
      type: 'CARD',
      minute: eventMinute,
      teamId: eventTeamId,
      playerId: player.id,
      playerName: player.name,
      cardType: finalCardType,
      reason: cardReason,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    const updated = matches.map((m) =>
      m.id === activeMatch.id ? { ...m, events: [...m.events, newEvent] } : m
    );

    DisciplineEngine.evaluateAllPlayers(
      teams,
      updated,
      tournament?.formatType || 'SINGLE_LEAGUE'
    );
    StorageService.saveTeams(teams);
    const syncedMatches = isSingleLeague
      ? updated
      : KnockoutEngine.generateOrUpdateBracket(teams, updated);
    onMatchesUpdate(syncedMatches);
    StorageService.saveMatches(syncedMatches);
    setCardModalOpen(false);

    SoundFX.playCardAlert();

    StorageService.logAction(
      currentRole,
      currentRole,
      'PHẠT THẺ',
      activeMatch.roundLabel,
      `Phút ${eventMinute}: ${finalCardType} cho ${player.name} (#${player.jerseyNumber} - ${cardedTeam?.name}). ${actionNote}`
    );
  };

  // Add Substitution Handler (Rule #6.2: Unlimited Substitutions)
  const handleSaveSubstitution = () => {
    if (!activeMatch || !eventTeamId || !selectedPlayerOutId || !selectedPlayerInId) return;

    const subTeam = eventTeamId === homeTeam?.id ? homeTeam : awayTeam;
    const playerOut = subTeam?.players.find((p) => p.id === selectedPlayerOutId);
    const playerIn = subTeam?.players.find((p) => p.id === selectedPlayerInId);

    if (playerIn?.isSuspended) {
      alert(`Không thể thay người! Cầu thủ ${playerIn.name} đang bị TREO GIÒ (🔒 ${playerIn.suspensionReason})`);
      return;
    }

    const newEvent: MatchEvent = {
      id: `EV-${Date.now()}`,
      matchId: activeMatch.id,
      type: 'SUBSTITUTION',
      minute: eventMinute,
      teamId: eventTeamId,
      playerOutId: playerOut?.id,
      playerOutName: playerOut?.name,
      playerInId: playerIn?.id,
      playerInName: playerIn?.name,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    const updated = matches.map((m) =>
      m.id === activeMatch.id ? { ...m, events: [...m.events, newEvent] } : m
    );

    onMatchesUpdate(updated);
    StorageService.saveMatches(updated);
    setSubModalOpen(false);

    StorageService.logAction(
      currentRole,
      currentRole,
      'THAY NGƯỜI (SUBSTITUTION)',
      activeMatch.roundLabel,
      `Phút ${eventMinute} (${subTeam?.name}): Ra sân: #${playerOut?.jerseyNumber} ${playerOut?.name} ➔ Vào sân: #${playerIn?.jerseyNumber} ${playerIn?.name}`
    );
  };

  // Penalty shootout submit (Rule #8)
  const handleSavePenalty = () => {
    if (!activeMatch) return;
    KnockoutEngine.recordPenaltyShootout(activeMatch.id, penHome, penAway, currentRole);
    const updated = StorageService.getMatches();
    onMatchesUpdate(updated);
    setPenaltyModalOpen(false);
    triggerCelebration();
  };

  // Post-match Edit with Audit Log (Rule #26)
  const handleSavePostEdit = () => {
    if (!activeMatch || !postEditReason) {
      alert('Vui lòng nhập lý do chỉnh sửa biên bản theo Điều 26!');
      return;
    }

    const synced = KnockoutEngine.generateOrUpdateBracket(teams, matches);
    onMatchesUpdate(synced);
    StorageService.saveMatches(synced);

    StorageService.logAction(
      currentRole,
      currentRole,
      'CHỈNH SỬA BIÊN BẢN TRẬN ĐÃ KẾT THÚC (POST-EDIT)',
      activeMatch.roundLabel,
      `Tỷ số mới: ${activeMatch.homeScore} - ${activeMatch.awayScore}`,
      postEditReason
    );

    setPostEditModalOpen(false);
    setPostEditReason('');
    alert('Biên bản đã được cập nhật và ghi nhận vào Audit Log hệ thống.');
  };

  const formatMinSec = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  if (!activeMatch) {
    return (
      <div className="bg-[#0B132B]/90 border border-slate-800 rounded-3xl p-12 text-center shadow-xl space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-700 text-slate-400 flex items-center justify-center mx-auto text-3xl">
          ⚡
        </div>
        <h3 className="text-xl font-bold text-white">Chưa Có Trận Đấu Nào Được Thiết Lập</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Cơ sở dữ liệu hiện đang sạch. Bạn có thể vào tab <strong>&quot;Đội Bóng &amp; Cầu Thủ&quot;</strong> để đăng ký các đội bóng, sau đó vào tab <strong>&quot;Lịch &amp; Kết Quả&quot;</strong> để tạo lịch thi đấu chính thức cho giải.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Match Selector Strip */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
        {sortedStripMatches.map((m) => {
          const h = teams.find((t) => t.id === m.homeTeamId);
          const a = teams.find((t) => t.id === m.awayTeamId);
          const isSelected = m.id === activeMatch.id;
          return (
            <button
              key={m.id}
              onClick={() => setActiveMatchId(m.id)}
              className={`flex-shrink-0 px-3.5 py-2.5 rounded-xl border text-xs text-left transition-all cursor-pointer ${isSelected
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-700 border-2 border-emerald-300 shadow-lg shadow-emerald-500/30 text-white font-black scale-[1.02]'
                  : 'bg-slate-900/90 border border-slate-700/80 text-slate-200 hover:bg-slate-800 hover:text-white hover:border-emerald-500/50 shadow-sm'
                }`}
            >
              <div className="flex items-center justify-between gap-2 text-[10px] text-slate-300 mb-1">
                <div className="flex items-center gap-1">
                  <span className="font-bold text-slate-200">{m.roundLabel}</span>
                  <span className="font-extrabold text-cyan-200 bg-cyan-950 px-1.5 py-0.5 rounded text-[9px] border border-cyan-400/60 shadow-xs">
                    {(m.venueName ? m.venueName.match(/Sân\s*\d+/i)?.[0] || m.venueName.split(' - ')[0] : 'Sân 1').toUpperCase()}
                  </span>
                </div>
                {m.status === 'LIVE' && (
                  <span className="flex items-center gap-1 text-red-400 font-black animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                    LIVE
                  </span>
                )}
                {m.status === 'FINISHED' && (
                  <span className="text-emerald-400 font-extrabold">FT</span>
                )}
                {m.status === 'SCHEDULED' && (
                  <span className="text-sky-300 font-mono font-bold text-[9px]">{m.time}</span>
                )}
              </div>
              <div className="font-bold flex items-center justify-between gap-4">
                <span className="text-white font-bold">{h?.shortName || 'TBD'} vs {a?.shortName || 'TBD'}</span>
                <span className="text-emerald-400 font-mono font-black">
                  {m.homeScore} - {m.awayScore}
                </span>
              </div>
              {isSetSport && formatMatchSetsCompact(m) && (
                <div className="text-[10px] font-mono text-cyan-300 mt-0.5 truncate">
                  {formatMatchSetsCompact(m)}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Stadium Live Scoreboard Card */}
      <div className="relative rounded-3xl overflow-hidden border border-blue-500/40 shadow-xl bg-[#0B1A30]">
        {/* Stadium Action Photo Overlay with balanced floodlights */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20 transform scale-105 pointer-events-none mix-blend-luminosity"
          style={{ backgroundImage: `url('/images/tournament-hero.jpg')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#071526]/95 via-[#06101c]/92 to-[#030810]/98 pointer-events-none" />

        {/* Stadium lighting glow overlays */}
        <div className="absolute top-0 left-1/4 right-1/4 h-32 bg-sky-500/25 blur-3xl pointer-events-none"></div>
        <div className="absolute -top-10 left-10 w-48 h-48 bg-cyan-500/15 blur-3xl pointer-events-none"></div>
        <div className="absolute -top-10 right-10 w-48 h-48 bg-blue-500/15 blur-3xl pointer-events-none"></div>

        {/* Top Info Bar */}
        <div className="relative z-10 px-6 py-3.5 border-b border-slate-700/80 flex flex-wrap items-center justify-between gap-3 text-xs bg-[#081528]/95 backdrop-blur-md">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-extrabold text-emerald-200 bg-emerald-900/80 border border-emerald-400/60 px-3 py-1 rounded-lg uppercase tracking-wider text-xs shadow-sm">
              {activeMatch.roundLabel}
            </span>
            <span className="inline-flex items-center gap-1.5 font-bold text-cyan-100 bg-cyan-950/80 border border-cyan-400/60 px-3 py-1 rounded-lg text-xs shadow-sm">
              <MapPin className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
              <span>Sân: <strong className="font-extrabold text-cyan-200">{activeMatch.venueName || 'Sân 1 - Cỏ Nhân Tạo KTX'}</strong></span>
            </span>
            <span className="inline-flex items-center gap-1.5 font-bold text-slate-200 bg-slate-800/90 border border-slate-600/80 px-3 py-1 rounded-lg text-xs shadow-sm">
              <span>Trọng tài: <strong className="font-extrabold text-amber-300">{activeMatch.refereeName || 'BTC'}</strong></span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {activeMatch.status === 'LIVE' && (
              <span className="inline-flex items-center gap-1.5 bg-red-600 text-white border-2 border-red-300 px-3.5 py-1 rounded-full font-black animate-pulse text-xs shadow-lg shadow-red-600/40">
                <span className="w-2.5 h-2.5 rounded-full bg-white"></span>
                {isSetSport ? `ĐANG DIỄN RA (SET ${activeSetNum})` : `ĐANG DIỄN RA (HIỆP ${activeMatch.half})`}
              </span>
            )}
            {activeMatch.status === 'HALFTIME' && (
              <span className="inline-flex items-center gap-1.5 bg-amber-400 text-slate-950 border-2 border-amber-200 px-3.5 py-1 rounded-full font-black text-xs shadow-lg shadow-amber-500/40">
                <Coffee className="w-4 h-4 text-slate-950" />
                NGHỈ GIỮA HIỆP (5 PHÚT)
              </span>
            )}
            {activeMatch.status === 'FINISHED' && (
              <span className="inline-flex items-center gap-1.5 bg-emerald-600 text-white border-2 border-emerald-300 px-3.5 py-1 rounded-full font-black text-xs shadow-lg shadow-emerald-600/40">
                <CheckCircle2 className="w-4 h-4 text-white" />
                KẾT THÚC TRẬN ĐẤU (FULL TIME)
              </span>
            )}
            {activeMatch.status === 'SCHEDULED' && (
              <span className="inline-flex items-center gap-1.5 bg-blue-600 text-white border-2 border-blue-300 px-3.5 py-1 rounded-full font-black text-xs shadow-lg shadow-blue-600/40">
                <Clock className="w-4 h-4 text-white" />
                CHƯA BẮT ĐẦU ({activeMatch.time})
              </span>
            )}
            {activeMatch.status === 'CHECKING' && (
              <span className="inline-flex items-center gap-1.5 bg-purple-600 text-white border-2 border-purple-300 px-3.5 py-1 rounded-full font-black text-xs shadow-lg shadow-purple-600/40">
                <Clock className="w-4 h-4 text-white" />
                ĐANG ĐIỂM DANH ({activeMatch.time})
              </span>
            )}
            {(activeMatch.status === 'POSTPONED' || activeMatch.status === 'CANCELLED') && (
              <span className="inline-flex items-center gap-1.5 bg-rose-700 text-white border-2 border-rose-300 px-3.5 py-1 rounded-full font-black text-xs shadow-lg shadow-rose-700/40">
                <Clock className="w-4 h-4 text-white" />
                {activeMatch.status === 'POSTPONED' ? 'HOÃN TRẬN' : 'HỦY TRẬN'}
              </span>
            )}

            {/* Post match edit button for Organizer (Rule 26) */}
            {activeMatch.status === 'FINISHED' && canEdit && (
              <button
                onClick={() => setPostEditModalOpen(true)}
                className="ml-2 flex items-center gap-1.5 text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 px-3 py-1 rounded-lg border border-amber-400/50 transition-colors shadow-sm cursor-pointer"
                title="Sửa biên bản sau trận theo Điều 26"
              >
                <FileEdit className="w-3.5 h-3.5" />
                <span>Sửa Biên Bản (Audit)</span>
              </button>
            )}
          </div>
        </div>

        {/* Score & Teams Display - Balanced 12-Column Full Width Broadcast Layout */}
        <div className="px-4 py-8 sm:px-10 sm:py-12 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-12 items-center gap-6 lg:gap-8">

            {/* Home Team (5 columns on desktop, text-right) */}
            <div className="col-span-1 md:col-span-5 flex flex-col items-center md:items-end text-center md:text-right">
              {/* Crest with glowing ring */}
              <div className="relative group mb-3">
                <div
                  className="absolute -inset-1 rounded-3xl blur-lg opacity-80 group-hover:opacity-100 transition duration-300"
                  style={{ backgroundColor: homeTeam?.primaryColor || '#1e3a8a' }}
                />
                <div
                  className="relative w-20 h-20 sm:w-28 sm:h-28 rounded-2xl sm:rounded-3xl flex items-center justify-center text-3xl sm:text-5xl font-extrabold shadow-2xl border-2 border-white/50"
                  style={{
                    background: `linear-gradient(135deg, ${homeTeam?.primaryColor || '#1e3a8a'} 0%, #08111e 100%)`,
                    borderColor: homeTeam?.secondaryColor || '#34d399'
                  }}
                >
                  <span className="drop-shadow-lg transform group-hover:scale-110 transition-transform">{sportMeta.icon}</span>
                  <div className="absolute -bottom-2.5 px-3 py-0.5 rounded-full bg-[#081525] border-2 border-emerald-400 text-[10px] sm:text-xs font-black text-emerald-300 uppercase tracking-widest shadow-md">
                    Chủ Nhà
                  </div>
                </div>
              </div>

              {/* Team Name */}
              <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-wide uppercase drop-shadow-[0_4px_16px_rgba(0,0,0,0.9)]">
                {homeTeam?.name || 'Đội Nhà'}
              </h2>

              {/* Badges: Class & Captain */}
              <div className="mt-2.5 flex flex-wrap items-center justify-center md:justify-end gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#071c2f]/90 border border-emerald-500/50 text-emerald-300 text-xs font-bold shadow-md">
                  <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Lớp {homeTeam?.class || 'N/A'} • {homeTeam?.department || 'Khoa CNTT'}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900/95 border border-amber-400/60 text-amber-300 text-xs font-bold shadow-md">
                  <Award className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Đội trưởng: #{homeTeam?.captainName || 'Cầu thủ'}</span>
                </span>
              </div>
            </div>

            {/* Score & Live Clock Center (2 columns on desktop, perfectly centered) */}
            <div className="col-span-1 md:col-span-2 flex flex-col items-center justify-center my-4 md:my-0">

              {/* Live Digital Clock Badge */}
              <div className="relative mb-2 group">
                <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 opacity-70 blur-md group-hover:opacity-100 transition duration-300"></div>
                <div className="relative bg-[#030c18] px-5 sm:px-6 py-1.5 rounded-full border-2 border-emerald-400 flex items-center gap-2 shadow-2xl">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                  <span className="text-emerald-300 font-mono text-sm sm:text-xl font-black tracking-widest drop-shadow-[0_0_12px_rgba(52,211,153,0.9)]">
                    {formatMinSec(seconds)}
                  </span>
                </div>
              </div>
              <div className="mb-2 text-[10px] font-bold text-cyan-200/90 bg-cyan-950/70 border border-cyan-500/40 px-2.5 py-0.5 rounded-full text-center">
                {isSetSport
                  ? `TỶ SỐ VÁN / SET (BO${setConfig.bestOf} • ${setConfig.pointsPerSet}đ${setConfig.decidingSetPoints !== setConfig.pointsPerSet ? `, Set cuối ${setConfig.decidingSetPoints}đ` : ''})`
                  : `2 × ${halfDurationMinutes}p • Nghỉ ${breakDurationMinutes}p • Không bù giờ`}
              </div>
              {activeMatch.isForfeit && (
                <div className="mb-2 text-[10px] font-black text-rose-200 bg-rose-900/80 border border-rose-400 px-3 py-0.5 rounded-full text-center">
                  ⚖️ ĐÃ XỬ THUA 0–{isSetSport ? setsToWin : 3}: {activeMatch.forfeitReason}
                </div>
              )}

              {/* Big Stadium LED Scoreboard Display */}
              <div className="flex items-center gap-2.5 sm:gap-4 my-1">
                {/* Home Score Box */}
                <div className="w-20 h-24 sm:w-26 sm:h-32 rounded-2xl bg-gradient-to-b from-[#0e2744] via-[#061424] to-[#02070f] border-2 border-emerald-400/80 shadow-[0_0_35px_rgba(16,185,129,0.35)] flex items-center justify-center">
                  <span className="text-5xl sm:text-7xl font-mono font-black text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.8)]">
                    {activeMatch.homeScore}
                  </span>
                </div>

                {/* Center Colon / VS Separator */}
                <div className="flex flex-col items-center justify-center px-1">
                  <span className="text-2xl sm:text-4xl font-mono font-black text-emerald-400 animate-pulse">:</span>
                  <span className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest">
                    {isSetSport ? 'SET' : 'VS'}
                  </span>
                </div>

                {/* Away Score Box */}
                <div className="w-20 h-24 sm:w-26 sm:h-32 rounded-2xl bg-gradient-to-b from-[#0e2744] via-[#061424] to-[#02070f] border-2 border-emerald-400/80 shadow-[0_0_35px_rgba(16,185,129,0.35)] flex items-center justify-center">
                  <span className="text-5xl sm:text-7xl font-mono font-black text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.8)]">
                    {activeMatch.awayScore}
                  </span>
                </div>
              </div>

              {/* Compact per-set score pills for Badminton / Volleyball */}
              {isSetSport && Array.isArray(activeMatch.sets) && activeMatch.sets.length > 0 && (
                <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5">
                  {activeMatch.sets.map((s) => (
                    <span
                      key={s.setNumber}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold border ${s.setNumber === activeSetNum && activeMatch.status !== 'FINISHED'
                          ? 'bg-emerald-500/25 border-emerald-300 text-emerald-200'
                          : 'bg-slate-900/80 border-slate-600 text-slate-200'
                        }`}
                    >
                      Set {s.setNumber}: {s.homePoints}-{s.awayPoints}
                    </span>
                  ))}
                </div>
              )}

              {/* Penalty shootout badge if exists (Rule #8) */}
              {activeMatch.penaltyShootout && (
                <div className="mt-3 bg-amber-500/20 border-2 border-amber-400 text-amber-200 px-4 py-1 rounded-full text-xs font-black flex items-center gap-1.5 text-center shadow-lg shadow-amber-500/25">
                  <Award className="w-4 h-4 text-amber-400" />
                  <span>PEN: {activeMatch.penaltyShootout.homeScore} - {activeMatch.penaltyShootout.awayScore}</span>
                </div>
              )}
            </div>

            {/* Away Team (5 columns on desktop, text-left) */}
            <div className="col-span-1 md:col-span-5 flex flex-col items-center md:items-start text-center md:text-left">
              {/* Crest with glowing ring */}
              <div className="relative group mb-3">
                <div
                  className="absolute -inset-1 rounded-3xl blur-lg opacity-80 group-hover:opacity-100 transition duration-300"
                  style={{ backgroundColor: awayTeam?.primaryColor || '#059669' }}
                />
                <div
                  className="relative w-20 h-20 sm:w-28 sm:h-28 rounded-2xl sm:rounded-3xl flex items-center justify-center text-3xl sm:text-5xl font-extrabold shadow-2xl border-2 border-white/50"
                  style={{
                    background: `linear-gradient(135deg, ${awayTeam?.primaryColor || '#059669'} 0%, #08111e 100%)`,
                    borderColor: awayTeam?.secondaryColor || '#38bdf8'
                  }}
                >
                  <span className="drop-shadow-lg transform group-hover:scale-110 transition-transform">{sportMeta.icon}</span>
                  <div className="absolute -bottom-2.5 px-3 py-0.5 rounded-full bg-[#081525] border-2 border-cyan-400 text-[10px] sm:text-xs font-black text-cyan-300 uppercase tracking-widest shadow-md">
                    Đội Khách
                  </div>
                </div>
              </div>

              {/* Team Name */}
              <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-wide uppercase drop-shadow-[0_4px_16px_rgba(0,0,0,0.9)]">
                {awayTeam?.name || 'Đội Khách'}
              </h2>

              {/* Badges: Class & Captain */}
              <div className="mt-2.5 flex flex-wrap items-center justify-center md:justify-start gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#071c2f]/90 border border-emerald-500/50 text-emerald-300 text-xs font-bold shadow-md">
                  <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Lớp {awayTeam?.class || 'N/A'} • {awayTeam?.department || 'Khoa CNTT'}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900/95 border border-amber-400/60 text-amber-300 text-xs font-bold shadow-md">
                  <Award className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Đội trưởng: #{awayTeam?.captainName || 'Cầu thủ'}</span>
                </span>
              </div>
            </div>

          </div>
        </div>

        {/* Live Set Scorer Panel (Badminton & Volleyball) */}
        {isSetSport && canEdit && activeMatch.status !== 'FINISHED' && (() => {
          const allSets = Array.from({ length: setConfig.bestOf }, (_, idx) => {
            const sNum = idx + 1;
            const found = (activeMatch.sets || []).find((s) => s.setNumber === sNum);
            return found || { setNumber: sNum, homePoints: 0, awayPoints: 0 };
          });
          const curSet = allSets.find((s) => s.setNumber === activeSetNum) || allSets[0];
          const curSetWinner = determineSetWinner(curSet.homePoints, curSet.awayPoints, activeSetNum, setConfig);
          const matchHasWinner = activeMatch.homeScore >= setsToWin || activeMatch.awayScore >= setsToWin;

          return (
            <div className="relative z-10 px-5 sm:px-8 py-4 bg-[#07182d]/95 border-t border-emerald-500/30 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-base">{sportMeta.icon}</span>
                  <span className="text-xs sm:text-sm font-black text-emerald-300 uppercase tracking-wider">
                    Bảng Chấm Điểm Trực Tiếp Từng Set (BO{setConfig.bestOf})
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {allSets.map((s) => {
                    const isCur = s.setNumber === activeSetNum;
                    const w = s.winner || determineSetWinner(s.homePoints, s.awayPoints, s.setNumber, setConfig);
                    return (
                      <button
                        key={s.setNumber}
                        type="button"
                        onClick={() => setActiveSetNum(s.setNumber)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold border transition-all cursor-pointer ${isCur
                            ? 'bg-emerald-500 text-slate-950 border-emerald-300 shadow-md'
                            : 'bg-slate-900/80 text-slate-200 border-slate-600 hover:border-emerald-400'
                          }`}
                      >
                        Set {s.setNumber}: {s.homePoints}-{s.awayPoints} {w ? '✓' : ''}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-11 gap-3 items-center">
                {/* Home Set Point Controls */}
                <div className="md:col-span-5 p-3.5 rounded-2xl bg-slate-900/90 border border-emerald-500/40 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold text-emerald-300 uppercase">Chủ Nhà • Set {activeSetNum}</div>
                    <div className="text-xs sm:text-sm font-black text-white truncate">{homeTeam?.shortName || 'Đội Nhà'}</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleUpdateSetPoints(activeSetNum, Math.max(0, curSet.homePoints - 1), curSet.awayPoints)}
                      className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-black text-sm border border-slate-600 active:scale-95 cursor-pointer"
                    >
                      -1
                    </button>
                    <input
                      type="number"
                      min={0}
                      max={99}
                      value={curSet.homePoints}
                      onChange={(e) => handleUpdateSetPoints(activeSetNum, Number(e.target.value), curSet.awayPoints)}
                      className="w-16 h-10 text-center font-mono font-black text-xl bg-[#030c18] text-white border-2 border-emerald-400 rounded-xl"
                    />
                    <button
                      type="button"
                      onClick={() => handleUpdateSetPoints(activeSetNum, curSet.homePoints + 1, curSet.awayPoints)}
                      className="px-3.5 h-10 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-black text-xs sm:text-sm border border-emerald-300 shadow-lg active:scale-95 cursor-pointer"
                    >
                      +1 Điểm
                    </button>
                  </div>
                </div>

                {/* Middle Confirm Set / Match Winner */}
                <div className="md:col-span-1 flex md:flex-col items-center justify-center gap-1.5 text-center">
                  <span className="text-xs font-black text-slate-400">SET {activeSetNum}</span>
                  <span className="text-[10px] font-mono text-cyan-300">
                    /{activeSetNum >= setConfig.bestOf ? setConfig.decidingSetPoints : setConfig.pointsPerSet}đ
                  </span>
                </div>

                {/* Away Set Point Controls */}
                <div className="md:col-span-5 p-3.5 rounded-2xl bg-slate-900/90 border border-cyan-500/40 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold text-cyan-300 uppercase">Đội Khách • Set {activeSetNum}</div>
                    <div className="text-xs sm:text-sm font-black text-white truncate">{awayTeam?.shortName || 'Đội Khách'}</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleUpdateSetPoints(activeSetNum, curSet.homePoints, Math.max(0, curSet.awayPoints - 1))}
                      className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-black text-sm border border-slate-600 active:scale-95 cursor-pointer"
                    >
                      -1
                    </button>
                    <input
                      type="number"
                      min={0}
                      max={99}
                      value={curSet.awayPoints}
                      onChange={(e) => handleUpdateSetPoints(activeSetNum, curSet.homePoints, Number(e.target.value))}
                      className="w-16 h-10 text-center font-mono font-black text-xl bg-[#030c18] text-white border-2 border-cyan-400 rounded-xl"
                    />
                    <button
                      type="button"
                      onClick={() => handleUpdateSetPoints(activeSetNum, curSet.homePoints, curSet.awayPoints + 1)}
                      className="px-3.5 h-10 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black text-xs sm:text-sm border border-cyan-300 shadow-lg active:scale-95 cursor-pointer"
                    >
                      +1 Điểm
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className="text-[11px] text-slate-300">
                  {curSetWinner
                    ? `✓ Set ${activeSetNum} đã đủ điều kiện thắng cho ${curSetWinner === 'HOME' ? homeTeam?.shortName : awayTeam?.shortName} (${curSet.homePoints}-${curSet.awayPoints}).`
                    : `Đang chấm điểm Set ${activeSetNum} (mục tiêu ${activeSetNum >= setConfig.bestOf ? setConfig.decidingSetPoints : setConfig.pointsPerSet}đ, cách biệt 2đ).`}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {!matchHasWinner && (
                    <button
                      type="button"
                      onClick={handleConfirmSetAndAdvance}
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg active:scale-95 cursor-pointer"
                    >
                      {activeSetNum < setConfig.bestOf
                        ? `Chốt Set ${activeSetNum} & Sang Set ${activeSetNum + 1}`
                        : `Chốt Set ${activeSetNum}`}
                    </button>
                  )}
                  {matchHasWinner && (
                    <button
                      type="button"
                      onClick={handleFinishMatch}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs shadow-lg animate-pulse cursor-pointer"
                    >
                      🏆 Đã Đủ Set Thắng ({activeMatch.homeScore}-{activeMatch.awayScore}) — Hoàn Tất Trận Đấu
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Live Match Operational Control Bar for Organizer / Referee */}
        {canEdit && (
          <div className="relative z-10 px-5 sm:px-6 py-3.5 sm:py-4 bg-[#081525] border-t-2 border-sky-500/40 flex flex-wrap items-center justify-between gap-3 shadow-2xl">

            {/* Timer controls */}
            <div className="flex flex-wrap items-center gap-2.5">
              {activeMatch.status !== 'LIVE' ? (
                <button
                  onClick={handleStartResume}
                  className="flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-white font-black text-xs sm:text-sm shadow-xl shadow-emerald-500/35 border border-emerald-300 ring-2 ring-emerald-400/20 active:scale-95 transition-all cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>{activeMatch.status === 'SCHEDULED' ? 'Bắt Đầu Trận' : 'Tiếp Tục'}</span>
                </button>
              ) : (
                <button
                  onClick={handlePause}
                  className="flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs sm:text-sm shadow-xl shadow-amber-500/35 border border-amber-200 ring-2 ring-amber-400/20 active:scale-95 transition-all cursor-pointer"
                >
                  <Pause className="w-4 h-4 fill-current" />
                  <span>Tạm Dừng</span>
                </button>
              )}

              {!isSetSport && activeMatch.status === 'LIVE' && activeMatch.half === 1 && (
                <button
                  onClick={handleSetHalftime}
                  className="flex items-center gap-2 px-3.5 sm:px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-blue-600/30 border border-blue-300 ring-2 ring-blue-400/20 active:scale-95 transition-all cursor-pointer"
                >
                  <Coffee className="w-4 h-4" />
                  <span>Nghỉ Giữa Hiệp</span>
                </button>
              )}

              {activeMatch.status !== 'FINISHED' && (
                <button
                  onClick={handleFinishMatch}
                  className="flex items-center gap-2 px-3.5 sm:px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-red-600/30 border border-rose-300 ring-2 ring-rose-400/20 active:scale-95 transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Kết Thúc Trận</span>
                </button>
              )}
            </div>

            {/* Quick Match Action Triggers */}
            {activeMatch.status !== 'FINISHED' && (
              <div className="flex flex-wrap items-center gap-2.5">
                {isSetSport ? (
                  <button
                    onClick={handleOpenQuickSets}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-xs sm:text-sm shadow-xl shadow-emerald-500/35 border-2 border-emerald-300 active:scale-95 transition-all cursor-pointer"
                  >
                    <FileEdit className="w-4 h-4 text-white" />
                    <span>Nhập Nhanh Tỷ Số Set</span>
                  </button>
                ) : (
                  <>
                    {/* Goal Button */}
                    <button
                      onClick={() => {
                        setEventTeamId(homeTeam?.id || '');
                        setGoalModalOpen(true);
                      }}
                      className="flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-black text-xs sm:text-sm shadow-xl shadow-emerald-500/35 border-2 border-emerald-300 active:scale-95 transition-all cursor-pointer ring-2 ring-emerald-400/25"
                    >
                      <PlusCircle className="w-4 h-4 text-white" />
                      <span>+ Bàn Thắng</span>
                    </button>

                    {/* Card Button */}
                    <button
                      onClick={() => {
                        setEventTeamId(homeTeam?.id || '');
                        setCardModalOpen(true);
                      }}
                      className="flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black text-xs sm:text-sm shadow-xl shadow-amber-500/35 border-2 border-amber-200 active:scale-95 transition-all cursor-pointer ring-2 ring-amber-400/25"
                    >
                      <AlertTriangle className="w-4 h-4 text-slate-950" />
                      <span>Phạt Thẻ</span>
                    </button>

                    {/* Substitution Button (Rule #6.2) */}
                    <button
                      onClick={() => {
                        setEventTeamId(homeTeam?.id || '');
                        setSubModalOpen(true);
                      }}
                      className="flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black text-xs sm:text-sm shadow-xl shadow-cyan-500/35 border-2 border-cyan-200 active:scale-95 transition-all cursor-pointer ring-2 ring-cyan-400/25"
                    >
                      <ArrowRightLeft className="w-4 h-4 text-white" />
                      <span>Thay Người</span>
                    </button>

                    {/* Knockout Penalty Shootout Button (chỉ hiện khi thể thức GROUP_KNOCKOUT) */}
                    {!isSingleLeague && activeMatch.round !== 'GROUP' && (
                      <button
                        onClick={() => setPenaltyModalOpen(true)}
                        className="flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs sm:text-sm shadow-xl shadow-purple-600/35 border-2 border-purple-300 active:scale-95 transition-all cursor-pointer ring-2 ring-purple-400/25"
                      >
                        <Award className="w-4 h-4 text-white" />
                        <span>Luân Lưu 6m</span>
                      </button>
                    )}

                    {/* Chỉnh Thời Gian Thi Đấu Riêng Của Trận */}
                    <button
                      onClick={() => {
                        setEditMatchDurationInput(matchDurationMinutes);
                        setEditMatchBreakInput(breakDurationMinutes);
                        setEditMatchCurrentMinInput(Math.floor(seconds / 60));
                        setTimeConfigModalOpen(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-200 font-bold text-xs border border-cyan-500/50 active:scale-95 transition-all cursor-pointer"
                      title="Chỉnh sửa thời lượng trận (phút) và phút đồng hồ hiện tại"
                    >
                      <Clock className="w-4 h-4 text-cyan-300" />
                      <span>Sửa Thời Gian ({matchDurationMinutes}p)</span>
                    </button>
                  </>
                )}

                {/* Forfeit Button */}
                <button
                  onClick={() => {
                    setForfeitTeamId(homeTeam?.id || '');
                    setForfeitModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-950/90 hover:bg-rose-900 text-rose-200 font-bold text-xs border border-rose-500/60 active:scale-95 transition-all cursor-pointer"
                  title="Xử thua nếu đội đến trễ quá 10 phút hoặc bỏ cuộc"
                >
                  <Ban className="w-4 h-4 text-rose-400" />
                  <span>Xử Thua 0–{isSetSport ? setsToWin : 3}</span>
                </button>

              </div>
            )}

          </div>
        )}

      </div>

      {/* Live Match Event Feed / Timeline */}
      <div className="bg-[#0B132B]/80 rounded-2xl border border-slate-800 p-5 shadow-xl flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-amber-400" />
            <h3 className="font-extrabold text-white text-sm">
              Diễn Biến &amp; Nhật Ký Trực Tiếp
            </h3>
          </div>
          <span className="text-xs text-slate-400">{activeMatch.events.length} sự kiện</span>
        </div>

        {/* Quick squad suspension warning banner (Football only) */}
        {!isSetSport && (homeTeam?.players.some((p) => p.isSuspended) || awayTeam?.players.some((p) => p.isSuspended)) && (
          <div className="mb-4 p-2.5 rounded-lg bg-red-950/60 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>
              Cảnh báo kỷ luật Điều 11 &amp; 12: Có cầu thủ bị treo giò 🔒 (không được phép đăng ký vào sân hoặc ghi bàn).
            </span>
          </div>
        )}

        <div className="space-y-3 flex-1 overflow-y-auto max-h-96 pr-1">
          {activeMatch.events.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              {isSetSport
                ? 'Chưa có diễn biến nào. Dùng bảng chấm điểm Set hoặc "Nhập Nhanh Tỷ Số Set" để cập nhật.'
                : 'Chưa có diễn biến nào. Nhấn "+ Bàn Thắng", "Phạt Thẻ" hoặc "Thay Người" để cập nhật.'}
            </div>
          ) : (
            activeMatch.events
              .slice()
              .reverse()
              .map((ev) => {
                const evTeam = teams.find((t) => t.id === ev.teamId);

                return (
                  <div
                    key={ev.id}
                    className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/80 flex items-start gap-3 hover:border-slate-700 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center font-mono font-bold text-xs text-emerald-400 border border-slate-700">
                      {ev.type === 'SET_WIN' ? `S${ev.setNumber || 1}` : `${ev.minute}'`}
                    </div>

                    <div className="flex-1 text-xs">
                      <div className="flex items-center justify-between font-bold text-white">
                        <span className="flex items-center gap-1.5">
                          {ev.type === 'GOAL' && '⚽ BÀN THẮNG!'}
                          {ev.type === 'SET_WIN' && `${sportMeta.icon} CHỐT SET ${ev.setNumber || 1}${ev.setScoreLabel ? ` (${ev.setScoreLabel})` : ''}`}
                          {ev.type === 'CARD' &&
                            (ev.cardType === 'YELLOW'
                              ? '🟨 THẺ VÀNG'
                              : ev.cardType === 'SECOND_YELLOW'
                                ? '🟨🟥 THẺ VÀNG THỨ 2'
                                : '🟥 THẺ ĐỎ TRỰC TIẾP')}
                          {ev.type === 'SUBSTITUTION' && '🔄 THAY NGƯỜI'}
                          {ev.type === 'NOTE' && '⚖️ QUYẾT ĐỊNH TRỌNG TÀI / BTC'}
                        </span>
                        <span className="text-[10px] text-slate-400">{evTeam?.shortName}</span>
                      </div>

                      {ev.type === 'SET_WIN' && (
                        <div className="text-emerald-300 mt-1 font-medium">{ev.reason}</div>
                      )}

                      {ev.type === 'NOTE' && (
                        <div className="text-rose-300 mt-1 font-medium">{ev.reason}</div>
                      )}

                      {ev.type === 'GOAL' && (
                        <div className="text-slate-300 mt-1">
                          <span className="font-semibold text-emerald-300">{ev.playerName}</span>
                          {ev.isOwnGoal && <span className="text-red-400 ml-1">(Phản lưới nhà)</span>}
                          {ev.assistPlayerName && (
                            <span className="text-slate-400 ml-1">
                              (Kiến tạo: {ev.assistPlayerName})
                            </span>
                          )}
                        </div>
                      )}

                      {ev.type === 'CARD' && (
                        <div className="text-slate-300 mt-1">
                          <span className="font-semibold text-amber-300">{ev.playerName}</span>
                          {ev.reason && <span className="text-slate-400 ml-1">- {ev.reason}</span>}
                        </div>
                      )}

                      {ev.type === 'SUBSTITUTION' && (
                        <div className="text-slate-300 mt-1 flex items-center gap-1">
                          <span className="text-red-400">Ra: {ev.playerOutName}</span>
                          <span>➔</span>
                          <span className="text-emerald-400">Vào: {ev.playerInName}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
          )}
        </div>
      </div>

      {/* MODAL 1: Add Goal */}
      {goalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl space-y-4 text-slate-800">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span>⚽</span> Ghi Nhận Bàn Thắng Mới
            </h3>

            {/* Team Picker */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Chọn Đội Ghi Bàn</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEventTeamId(homeTeam?.id || '')}
                  className={`p-2.5 rounded-xl text-xs font-bold border transition-colors ${eventTeamId === homeTeam?.id
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                >
                  {homeTeam?.name}
                </button>
                <button
                  type="button"
                  onClick={() => setEventTeamId(awayTeam?.id || '')}
                  className={`p-2.5 rounded-xl text-xs font-bold border transition-colors ${eventTeamId === awayTeam?.id
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                >
                  {awayTeam?.name}
                </button>
              </div>
            </div>

            {/* Player Scorer (Filters out suspended players!) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Cầu Thủ Ghi Bàn (Không cho phép cầu thủ bị treo giò)
              </label>
              <select
                value={selectedPlayerId}
                onChange={(e) => setSelectedPlayerId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl p-2.5 focus:border-blue-500 focus:bg-white focus:outline-none"
              >
                <option value="">-- Chọn cầu thủ ghi bàn --</option>
                {(eventTeamId === homeTeam?.id ? homeTeam?.players : awayTeam?.players)?.map((p) => (
                  <option key={p.id} value={p.id} disabled={p.isSuspended}>
                    #{p.jerseyNumber} - {p.name} ({p.position}) {p.isSuspended ? '🔒 BỊ TREO GIÒ' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Assist Player */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Cầu Thủ Kiến Tạo (Tùy chọn)</label>
              <select
                value={selectedAssistId}
                onChange={(e) => setSelectedAssistId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl p-2.5 focus:border-blue-500 focus:bg-white focus:outline-none"
              >
                <option value="">-- Không có kiến tạo --</option>
                {(eventTeamId === homeTeam?.id ? homeTeam?.players : awayTeam?.players)?.map((p) => (
                  <option key={p.id} value={p.id}>
                    #{p.jerseyNumber} - {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Minute */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Phút ghi bàn (1-40)</label>
                <input
                  type="number"
                  min={1}
                  max={45}
                  value={eventMinute}
                  onChange={(e) => setEventMinute(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl p-2.5 focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={isOwnGoal}
                    onChange={(e) => setIsOwnGoal(e.target.checked)}
                    className="rounded bg-slate-100 border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Phản lưới nhà (OG)</span>
                </label>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setGoalModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold border border-slate-200 transition-all cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveGoal}
                disabled={!selectedPlayerId}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-black shadow-md shadow-blue-500/25 transition-all cursor-pointer"
              >
                ⚽ Xác Nhận Bàn Thắng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Add Card */}
      {cardModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl space-y-4 text-slate-800">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span>⚠️</span> Phạt Thẻ Trọng Tài {isSingleLeague ? '(Quy Chế CTUT)' : '(Điều 11 & 12)'}
            </h3>
            {isSingleLeague && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
                <strong>Mức phạt thẻ:</strong> Thẻ vàng <strong>20.000đ</strong> (không tự treo giò trận sau) • 02 Thẻ vàng cùng trận <strong>50.000đ</strong> (truất quyền trong trận) • Thẻ đỏ trực tiếp <strong>100.000đ</strong> (truất quyền ngay, BTC quyết định trận tiếp theo).
              </div>
            )}

            {/* Team Picker */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Chọn Đội Phạt Thẻ</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEventTeamId(homeTeam?.id || '')}
                  className={`p-2.5 rounded-xl text-xs font-bold border transition-colors ${eventTeamId === homeTeam?.id
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                >
                  {homeTeam?.name}
                </button>
                <button
                  type="button"
                  onClick={() => setEventTeamId(awayTeam?.id || '')}
                  className={`p-2.5 rounded-xl text-xs font-bold border transition-colors ${eventTeamId === awayTeam?.id
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                >
                  {awayTeam?.name}
                </button>
              </div>
            </div>

            {/* Player */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Cầu Thủ Nhận Thẻ</label>
              <select
                value={selectedPlayerId}
                onChange={(e) => setSelectedPlayerId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl p-2.5 focus:border-blue-500 focus:bg-white"
              >
                <option value="">-- Chọn cầu thủ --</option>
                {(eventTeamId === homeTeam?.id ? homeTeam?.players : awayTeam?.players)?.map((p) => (
                  <option key={p.id} value={p.id}>
                    #{p.jerseyNumber} - {p.name} (Đã có {p.yellowCards}🟨, {p.redCards}🟥)
                  </option>
                ))}
              </select>
            </div>

            {/* Card Type */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Loại Thẻ</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCardType('YELLOW')}
                  className={`p-2.5 rounded-xl text-xs font-black border transition-colors flex items-center justify-center gap-1.5 ${cardType === 'YELLOW'
                      ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-xs ring-1 ring-amber-400'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                >
                  <span>🟨</span> Thẻ Vàng (Tích Lũy)
                </button>
                <button
                  type="button"
                  onClick={() => setCardType('RED')}
                  className={`p-2.5 rounded-xl text-xs font-black border transition-colors flex items-center justify-center gap-1.5 ${cardType === 'RED'
                      ? 'bg-rose-100 text-rose-900 border-rose-300 shadow-xs ring-1 ring-rose-400'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                >
                  <span>🟥</span> Thẻ Đỏ Trực Tiếp
                </button>
              </div>
            </div>

            {/* Card Reason */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Lý Do Phạt Thẻ</label>
              <input
                type="text"
                value={cardReason}
                onChange={(e) => setCardReason(e.target.value)}
                placeholder="VD: Phạm lỗi kéo người, phản ứng trọng tài..."
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl p-2.5 focus:border-blue-500 focus:bg-white"
              />
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCardModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold border border-slate-200 transition-all cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveCard}
                disabled={!selectedPlayerId}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-black shadow-md shadow-amber-500/25 transition-all cursor-pointer"
              >
                ⚠️ Xác Nhận Thẻ Phạt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Substitution (Rule #6.2: Unlimited Substitutions) */}
      {subModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl space-y-4 text-slate-800">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span>🔄</span> Thay Người (Không Giới Hạn - Điều 6.2)
            </h3>

            {/* Team Picker */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Chọn Đội Thay Người</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEventTeamId(homeTeam?.id || '')}
                  className={`p-2.5 rounded-xl text-xs font-bold border transition-colors ${eventTeamId === homeTeam?.id
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                >
                  {homeTeam?.name}
                </button>
                <button
                  type="button"
                  onClick={() => setEventTeamId(awayTeam?.id || '')}
                  className={`p-2.5 rounded-xl text-xs font-bold border transition-colors ${eventTeamId === awayTeam?.id
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                >
                  {awayTeam?.name}
                </button>
              </div>
            </div>

            {/* Player Out */}
            <div>
              <label className="block text-xs font-bold text-rose-600 mb-1">Cầu Thủ Rời Sân (OUT)</label>
              <select
                value={selectedPlayerOutId}
                onChange={(e) => setSelectedPlayerOutId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl p-2.5 focus:border-rose-400 focus:bg-white"
              >
                <option value="">-- Chọn cầu thủ ra sân --</option>
                {(eventTeamId === homeTeam?.id ? homeTeam?.players : awayTeam?.players)?.map((p) => (
                  <option key={p.id} value={p.id}>
                    #{p.jerseyNumber} - {p.name} ({p.position})
                  </option>
                ))}
              </select>
            </div>

            {/* Player In */}
            <div>
              <label className="block text-xs font-bold text-emerald-700 mb-1">Cầu Thủ Vào Sân (IN)</label>
              <select
                value={selectedPlayerInId}
                onChange={(e) => setSelectedPlayerInId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl p-2.5 focus:border-emerald-400 focus:bg-white"
              >
                <option value="">-- Chọn cầu thủ vào sân --</option>
                {(eventTeamId === homeTeam?.id ? homeTeam?.players : awayTeam?.players)?.map((p) => (
                  <option key={p.id} value={p.id} disabled={p.isSuspended}>
                    #{p.jerseyNumber} - {p.name} ({p.position}) {p.isSuspended ? '🔒 BỊ TREO GIÒ' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSubModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold border border-slate-200 transition-all cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveSubstitution}
                disabled={!selectedPlayerOutId || !selectedPlayerInId}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-black shadow-md shadow-blue-500/25 transition-all cursor-pointer"
              >
                🔄 Xác Nhận Thay Người
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Penalty Shootout 6m for Knockout (Rule #8) */}
      {penaltyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl space-y-4 text-slate-800">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span>🥅</span> Luân Lưu 6m - Phân Định Thắng Thua (Điều 8)
            </h3>
            <p className="text-xs text-purple-800 bg-purple-50 p-2.5 rounded-xl border border-purple-200">
              Trận đấu knockout hòa sau 40 phút chính thức: Không đá hiệp phụ, tiến hành đá luân lưu 6m để xác định đội đi tiếp.
            </p>

            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="p-4 rounded-2xl bg-slate-50 text-center border border-slate-200">
                <span className="text-xs text-slate-700 font-bold block mb-2">{homeTeam?.shortName}</span>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={penHome}
                  onChange={(e) => setPenHome(Number(e.target.value))}
                  className="w-16 h-12 text-center text-2xl font-black bg-white text-slate-900 rounded-xl border-2 border-purple-400 mx-auto shadow-xs"
                />
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 text-center border border-slate-200">
                <span className="text-xs text-slate-700 font-bold block mb-2">{awayTeam?.shortName}</span>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={penAway}
                  onChange={(e) => setPenAway(Number(e.target.value))}
                  className="w-16 h-12 text-center text-2xl font-black bg-white text-slate-900 rounded-xl border-2 border-purple-400 mx-auto shadow-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPenaltyModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold border border-slate-200 transition-all cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSavePenalty}
                disabled={penHome === penAway}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-black shadow-md shadow-purple-600/25 transition-all cursor-pointer"
              >
                🥅 Xác Nhận Tỷ Số Penalty
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Post-Match Edit with Audit Log (Rule #26) */}
      {postEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl space-y-4 text-slate-800">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <FileEdit className="w-5 h-5 text-amber-500" />
              Chỉnh Sửa Dữ Liệu Sau Trận Đấu (Điều 26)
            </h3>
            <p className="text-xs text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
              Quy định nghiêm ngặt: Trận đấu đã FINISHED. Mọi chỉnh sửa bắt buộc phải ghi rõ lý do và được lưu trữ vĩnh viễn trong Audit Log của BTC.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-700 font-bold block mb-1">Tỷ số {homeTeam?.shortName}</label>
                <input
                  type="number"
                  min={0}
                  value={activeMatch.homeScore}
                  onChange={(e) => {
                    activeMatch.homeScore = Number(e.target.value);
                    onMatchesUpdate([...matches]);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl p-2 font-mono font-bold focus:bg-white focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-700 font-bold block mb-1">Tỷ số {awayTeam?.shortName}</label>
                <input
                  type="number"
                  min={0}
                  value={activeMatch.awayScore}
                  onChange={(e) => {
                    activeMatch.awayScore = Number(e.target.value);
                    onMatchesUpdate([...matches]);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl p-2 font-mono font-bold focus:bg-white focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-800 block mb-1">
                Lý Do Chỉnh Sửa (Bắt buộc theo Điều 26)
              </label>
              <textarea
                rows={3}
                value={postEditReason}
                onChange={(e) => setPostEditReason(e.target.value)}
                placeholder="VD: Nhập sai biên bản giấy do trọng tài ghi nhầm phút 35..."
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-xs rounded-xl p-2.5 focus:border-amber-500 focus:bg-white focus:outline-none"
              ></textarea>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPostEditModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold border border-slate-200 transition-all cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSavePostEdit}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white text-xs font-black shadow-md shadow-amber-500/25 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <FileEdit className="w-3.5 h-3.5" />
                <span>Xác Nhận &amp; Ghi Audit Log</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: Forfeit */}
      {forfeitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl space-y-4 text-slate-800">
            <h3 className="text-lg font-black text-rose-700 flex items-center gap-2">
              <Ban className="w-5 h-5" /> Xử Thua 0–{isSetSport ? setsToWin : 3} Theo Điều Lệ Giải
            </h3>
            <p className="text-xs text-slate-600 bg-rose-50 p-3 rounded-xl border border-rose-200">
              Áp dụng khi {sportMeta.unitLabel.toLowerCase()} đến trễ quá <strong>10 phút</strong> so với giờ thi đấu quy định, hoặc bỏ cuộc giữa trận. Đối thủ được xử thắng <strong>{isSetSport ? setsToWin : 3}–0</strong>.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Chọn bên bị xử thua (0 điểm, 0–{isSetSport ? setsToWin : 3})
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setForfeitTeamId(homeTeam?.id || '')}
                  className={`p-2.5 rounded-xl text-xs font-bold border transition-colors ${forfeitTeamId === homeTeam?.id
                      ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                >
                  {homeTeam?.name || 'Đội nhà'}
                </button>
                <button
                  type="button"
                  onClick={() => setForfeitTeamId(awayTeam?.id || '')}
                  className={`p-2.5 rounded-xl text-xs font-bold border transition-colors ${forfeitTeamId === awayTeam?.id
                      ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                >
                  {awayTeam?.name || 'Đội khách'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Lý Do Xử Thua</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {[
                  'Đến trễ quá 10 phút so với giờ thi đấu',
                  'Bỏ cuộc / không tiếp tục thi đấu',
                  ...(isSetSport ? [] : ['Không đủ tối thiểu 03 cầu thủ trên sân']),
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setForfeitReason(preset)}
                    className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-semibold text-slate-700"
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={forfeitReason}
                onChange={(e) => setForfeitReason(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl p-2.5 focus:border-rose-500 focus:bg-white"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setForfeitModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmForfeit}
                disabled={!forfeitTeamId}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-md"
              >
                Xác Nhận Xử Thua 0–{isSetSport ? setsToWin : 3}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 7: Edit Match Duration & Clock Minute */}
      {timeConfigModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl space-y-4 text-slate-800">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              Chỉnh Thời Gian Thi Đấu Trận #{activeMatch.matchNumber}
            </h3>
            <p className="text-xs text-slate-600 bg-blue-50 p-2.5 rounded-xl border border-blue-200">
              Cho phép tùy chỉnh tổng thời lượng (phút), thời gian nghỉ giữa hiệp và phút đồng hồ hiện tại cho riêng trận này.
            </p>

            <div>
              <span className="text-xs font-bold text-slate-700 block mb-1.5">Chọn nhanh thời lượng:</span>
              <div className="flex flex-wrap gap-1.5">
                {[40, 50, 60, 70].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setEditMatchDurationInput(mins)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${editMatchDurationInput === mins
                        ? 'bg-blue-600 border-blue-700 text-white'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                  >
                    {mins}p (2×{Math.floor(mins / 2)}p)
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Tổng phút ({Math.floor((editMatchDurationInput || 60) / 2)}p×2)
                </label>
                <input
                  type="number"
                  min={10}
                  max={180}
                  value={editMatchDurationInput}
                  onChange={(e) => setEditMatchDurationInput(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-mono font-bold text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Nghỉ giữa (phút)</label>
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={editMatchBreakInput}
                  onChange={(e) => setEditMatchBreakInput(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-mono font-bold text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Phút hiện tại</label>
                <input
                  type="number"
                  min={0}
                  max={180}
                  value={editMatchCurrentMinInput}
                  onChange={(e) => setEditMatchCurrentMinInput(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-mono font-bold text-xs text-blue-700"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setTimeConfigModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveMatchTimeConfig}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-500 hover:to-sky-500 text-white text-xs font-black shadow-md"
              >
                Lưu Thời Gian Trận
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 8: Quick Set Scores Entry (Badminton / Volleyball) */}
      {quickSetsModalOpen && isSetSport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl space-y-4 text-slate-800">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span>{sportMeta.icon}</span>
              Nhập Nhanh Tỷ Số Các Set (BO{setConfig.bestOf})
            </h3>
            <p className="text-xs text-emerald-800 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
              Nhập điểm từng set cho <strong>{homeTeam?.shortName || 'Chủ nhà'}</strong> và <strong>{awayTeam?.shortName || 'Đội khách'}</strong>. Hệ thống tự cộng số set thắng và tính điểm xếp hạng {sportMeta.label}.
            </p>

            <div className="space-y-2.5">
              <div className="grid grid-cols-12 gap-2 text-[11px] font-bold text-slate-500 px-1">
                <div className="col-span-3">Set</div>
                <div className="col-span-4 text-center truncate">{homeTeam?.shortName || 'Chủ nhà'}</div>
                <div className="col-span-1 text-center">-</div>
                <div className="col-span-4 text-center truncate">{awayTeam?.shortName || 'Đội khách'}</div>
              </div>

              {quickSetsDraft.map((s, idx) => {
                const targetPts = s.setNumber >= setConfig.bestOf ? setConfig.decidingSetPoints : setConfig.pointsPerSet;
                return (
                  <div key={s.setNumber} className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <div className="col-span-3 text-xs font-bold text-slate-700">
                      Set {s.setNumber}
                      <span className="block text-[10px] text-slate-400 font-normal">({targetPts}đ)</span>
                    </div>
                    <div className="col-span-4">
                      <input
                        type="number"
                        min={0}
                        max={99}
                        value={s.homePoints}
                        onChange={(e) => {
                          const val = Math.max(0, Number(e.target.value) || 0);
                          setQuickSetsDraft((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, homePoints: val } : item))
                          );
                        }}
                        className="w-full text-center font-mono font-black text-base bg-white border border-slate-300 rounded-lg p-1.5 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div className="col-span-1 text-center font-black text-slate-400">:</div>
                    <div className="col-span-4">
                      <input
                        type="number"
                        min={0}
                        max={99}
                        value={s.awayPoints}
                        onChange={(e) => {
                          const val = Math.max(0, Number(e.target.value) || 0);
                          setQuickSetsDraft((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, awayPoints: val } : item))
                          );
                        }}
                        className="w-full text-center font-mono font-black text-base bg-white border border-slate-300 rounded-lg p-1.5 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={quickSetsFinishMatch}
                onChange={(e) => setQuickSetsFinishMatch(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>Tự động đánh dấu Trận Đã Kết Thúc (FINISHED) nếu đã đủ {setsToWin} set thắng</span>
            </label>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setQuickSetsModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveQuickSets}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-black shadow-md"
              >
                Lưu Tỷ Số Các Set
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
