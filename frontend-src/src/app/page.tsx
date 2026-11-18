'use client';

import React, { useState, useEffect } from 'react';
import {
  Team,
  Match,
  Venue,
  Referee,
  Complaint,
  FinancialTransaction,
  TournamentAward,
  AuditLog,
  UserRole,
  TournamentStatus,
  Tournament,
  UserAccount,
  PaidFineRecord,
  getSportMeta,
} from '@/types';
import { StorageService, defaultCleanAwards } from '@/services/storage';
import { ScheduleEngine, migrateMatchTimesTo7AM } from '@/services/scheduleEngine';
import { AuthService } from '@/services/auth';
import { AuthModal } from '@/components/auth/AuthModal';
import { UserManagementModal } from '@/components/auth/UserManagementModal';
import {
  subscribeTournamentCloud,
  pushTournamentCloud,
  subscribeTournamentsListCloud,
  createTournamentCloud,
  deleteTournamentCloud,
  invalidateTournamentPollCache,
  triggerCloudRefreshNow,
  subscribeCloudSyncSnapshot,
  getCloudSyncSnapshot,
  flushAllOfflineSyncQueue,
  retryOfflineSyncAfterAuth,
  clearOfflineSyncForTournament,
  getQueuedTournamentPatch,
  TournamentStatsMap,
  CloudSyncSnapshot,
} from '@/services/dbSync';
import { Header } from '@/components/layout/Header';
import { OfflineSyncBanner } from '@/components/layout/CloudSyncBadge';
import { Navigation, TabKey } from '@/components/layout/Navigation';
import { PublicHome } from '@/components/home/PublicHome';
import { LiveMatchCenter } from '@/components/live/LiveMatchCenter';
import { ScheduleView } from '@/components/schedule/ScheduleView';
import { StandingsView } from '@/components/standings/StandingsView';
import { BracketTree } from '@/components/bracket/BracketTree';
import { TeamsView } from '@/components/teams/TeamsView';
import { DrawStudio } from '@/components/draw/DrawStudio';
import { DisciplineView } from '@/components/discipline/DisciplineView';
import { ComplaintsView } from '@/components/complaints/ComplaintsView';
import { FinanceView } from '@/components/finance/FinanceView';
import { AwardsView } from '@/components/awards/AwardsView';
import { AuditLogsView } from '@/components/audit/AuditLogsView';
import { CreateTournamentModal } from '@/components/tournament/CreateTournamentModal';
import { TournamentPortal } from '@/components/portal/TournamentPortal';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { MobileMenuDrawer } from '@/components/layout/MobileMenuDrawer';
import { SoundFX } from '@/utils/soundEffects';

export default function Home() {
  const [mounted, setMounted] = useState(false);

  // User Authentication state
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authNotice, setAuthNotice] = useState<string | undefined>(undefined);

  // Portal vs Single Tournament view mode
  const [viewMode, setViewMode] = useState<'portal' | 'tournament'>('portal');
  const [allTournaments, setAllTournaments] = useState<Tournament[]>([]);
  const [tournamentStats, setTournamentStats] = useState<TournamentStatsMap>({});

  // Mobile navigation drawer
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Core application states
  const [tournament, setTournament] = useState<Tournament>(StorageService.getTournament());
  const [createTournamentOpen, setCreateTournamentOpen] = useState(false);
  const [editTournamentOpen, setEditTournamentOpen] = useState(false);
  const [editingTournament, setEditingTournament] = useState<Tournament | undefined>(undefined);
  const [userManagementOpen, setUserManagementOpen] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [referees, setReferees] = useState<Referee[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [finances, setFinances] = useState<FinancialTransaction[]>([]);
  const [awards, setAwards] = useState<TournamentAward[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [paidFines, setPaidFines] = useState<Record<string, PaidFineRecord>>({});

  // Cloud sync status
  const [cloudStatus, setCloudStatus] = useState<'connected' | 'connecting' | 'offline'>('connecting');
  const [syncSnapshot, setSyncSnapshot] = useState<CloudSyncSnapshot>(() => getCloudSyncSnapshot());

  const handleManualRetrySync = () => {
    setCloudStatus('connecting');
    void flushAllOfflineSyncQueue();
    triggerCloudRefreshNow();
  };

  // RBAC & Tournament Status
  const [currentRole, setCurrentRole] = useState<UserRole>('STUDENT');
  const [tournamentStatus, setTournamentStatus] = useState<TournamentStatus>('GROUP_STAGE');

  // Navigation & History Stack (Hỗ trợ lùi 1 trang trên điện thoại & trình duyệt)
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [selectedMatchId, setSelectedMatchId] = useState<string>('');
  const [navHistory, setNavHistory] = useState<{ viewMode: 'portal' | 'tournament'; tab: TabKey }[]>([]);

  const handleNavigateTab = (tab: TabKey, pushToHistory = true) => {
    if (tab === activeTab && viewMode === 'tournament') return;

    // Bảo mật phân quyền: Trọng tài, Đội trưởng, Sinh viên không được xem Tài chính và Audit Log
    if ((tab === 'finance' || tab === 'audit') && currentRole !== 'SUPER_ADMIN' && currentRole !== 'ORGANIZER') {
      alert('Quyền truy cập bị từ chối: Mục Tài Chính & Lệ Phí chỉ dành riêng cho Ban Tổ Chức (BTC) và Super Admin!');
      return;
    }

    if (pushToHistory) {
      setNavHistory((prev) => {
        const current = { viewMode, tab: activeTab };
        if (prev.length > 0 && prev[prev.length - 1].viewMode === current.viewMode && prev[prev.length - 1].tab === current.tab) {
          return prev;
        }
        return [...prev, current];
      });
      if (typeof window !== 'undefined') {
        window.history.pushState({ viewMode: 'tournament', tab }, '');
      }
    }
    setActiveTab(tab);
    setAuditLogs(StorageService.getAuditLogs());
  };

  const handleNavigateViewMode = (mode: 'portal' | 'tournament', pushToHistory = true) => {
    if (mode === viewMode) return;
    if (pushToHistory) {
      setNavHistory((prev) => {
        const current = { viewMode, tab: activeTab };
        if (prev.length > 0 && prev[prev.length - 1].viewMode === current.viewMode && prev[prev.length - 1].tab === current.tab) {
          return prev;
        }
        return [...prev, current];
      });
      if (typeof window !== 'undefined') {
        window.history.pushState({ viewMode: mode, tab: activeTab }, '');
      }
    }
    setViewMode(mode);
  };

  const handleGoBack = () => {
    SoundFX.playClick();
    
    // 1. Đóng menu mobile nếu đang mở
    if (mobileMenuOpen) {
      setMobileMenuOpen(false);
      return;
    }
    // 2. Đóng các modal nếu đang mở
    if (editTournamentOpen) {
      setEditTournamentOpen(false);
      return;
    }
    if (createTournamentOpen) {
      setCreateTournamentOpen(false);
      return;
    }
    if (authModalOpen) {
      setAuthModalOpen(false);
      return;
    }
    if (userManagementOpen) {
      setUserManagementOpen(false);
      return;
    }

    // 3. Nếu có lịch sử trang trước trong ngăn xếp:
    if (navHistory.length > 0) {
      const prevEntry = navHistory[navHistory.length - 1];
      setNavHistory((prev) => prev.slice(0, -1));
      setViewMode(prevEntry.viewMode);
      setActiveTab(prevEntry.tab);
      return;
    }

    // 4. Mặc định thông minh nếu ngăn xếp rỗng:
    if (viewMode === 'tournament') {
      if (activeTab !== 'home') {
        setActiveTab('home');
      } else {
        setViewMode('portal');
      }
      return;
    }

    // 5. Nếu ở portal và trình duyệt có history:
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
    }
  };

  const canGoBack = navHistory.length > 0 || viewMode === 'tournament';

  // Lắng nghe phím back điện thoại và cử chỉ vuốt cạnh trái màn hình (popstate)
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (e.state) {
        if (e.state.viewMode) setViewMode(e.state.viewMode);
        if (e.state.tab) setActiveTab(e.state.tab);
      } else {
        if (activeTab !== 'home') {
          setActiveTab('home');
        } else if (viewMode === 'tournament') {
          setViewMode('portal');
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeTab, viewMode]);

  // Initial local data loading + MySQL Session & Tournaments List subscription
  useEffect(() => {
    const all = StorageService.getAllTournaments();
    setAllTournaments(all);
    const curr = StorageService.getTournament();
    setTournament(curr);
    const cleaned = StorageService.cleanExcessGroupsData(curr);
    setTeams(cleaned.teams);
    setMatches(cleaned.matches);
    setVenues(StorageService.getVenues());
    setReferees(StorageService.getReferees());
    setComplaints(StorageService.getComplaints());
    setFinances(StorageService.getFinances());
    setAwards(StorageService.getAwards());
    setAuditLogs(StorageService.getAuditLogs());
    setPaidFines(StorageService.getPaidFines());
    setTournamentStatus(StorageService.getTournamentStatus());

    // Lắng nghe hàng đợi đồng bộ offline <-> MySQL
    const unsubSync = subscribeCloudSyncSnapshot(setSyncSnapshot);

    const isInitiallyOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
    if (isInitiallyOffline) {
      setCloudStatus('offline');
      setMounted(true);
    }

    // Kiểm tra phiên đăng nhập thực tế từ PHP Session + MySQL (có timeout tránh treo khi mạng yếu)
    const hydrateSession = () => {
      void AuthService.fetchSessionUserAsync().then((user) => {
        if (user) {
          setCurrentUser(user);
          setCurrentRole(user.role);
          StorageService.setCurrentRole(user.role);
          void retryOfflineSyncAfterAuth();
          invalidateTournamentPollCache();
          triggerCloudRefreshNow();
        }
        setMounted(true);
      });
    };

    if (!isInitiallyOffline) {
      hydrateSession();
    }

    const handleOnline = () => {
      setCloudStatus('connecting');
      void flushAllOfflineSyncQueue();
      triggerCloudRefreshNow();
      hydrateSession();
    };
    const handleOffline = () => setCloudStatus('offline');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Lắng nghe danh sách các giải đấu trên CSDL MySQL
    const unsubList = subscribeTournamentsListCloud(
      (cloudList, stats) => {
        setCloudStatus('connected');
        if (stats) {
          setTournamentStats(stats);
        }
        if (Array.isArray(cloudList)) {
          setAllTournaments(cloudList);
          StorageService.saveAllTournaments(cloudList);

          if (cloudList.length === 0) {
            setTournament({} as Tournament);
            setTeams([]);
            setMatches([]);
            setFinances([]);
            setComplaints([]);
            StorageService.saveTeams([]);
            StorageService.saveMatches([]);
            setViewMode('portal');
          } else {
            setTournament((prev) => {
              if (!prev || !prev.id || !cloudList.some((t) => t.id === prev.id)) {
                return cloudList[0];
              }
              return prev;
            });
          }
        }
      },
      (err) => {
        console.warn('[MySQL] Lỗi đồng bộ danh sách giải đấu:', err);
        setCloudStatus('offline');
      }
    );

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubSync();
      unsubList();
    };
  }, []);

  // Lắng nghe cập nhật đồng bộ cho giải đấu đang chọn từ MySQL
  useEffect(() => {
    if (!tournament.id) return;

    const unsub = subscribeTournamentCloud(
      tournament.id,
      (cloudData) => {
        setCloudStatus('connected');
        if (cloudData.tournament) {
          setTournament(cloudData.tournament);
          StorageService.saveTournament(cloudData.tournament);
        }
        if (cloudData.manualSuspensions && typeof cloudData.manualSuspensions === 'object') {
          StorageService.saveManualSuspensions(cloudData.manualSuspensions);
        }
        if (cloudData.btcTieBreaks && typeof cloudData.btcTieBreaks === 'object') {
          StorageService.saveBtcTieBreaks(cloudData.btcTieBreaks);
        }
        if (cloudData.paidFines && typeof cloudData.paidFines === 'object') {
          setPaidFines(cloudData.paidFines);
          StorageService.savePaidFines(cloudData.paidFines);
        }
        if (Array.isArray(cloudData.teams)) {
          setTeams(cloudData.teams);
          StorageService.saveTeams(cloudData.teams);
        }
        if (Array.isArray(cloudData.matches)) {
          setMatches(cloudData.matches);
          StorageService.saveMatches(cloudData.matches);
        }
        if (Array.isArray(cloudData.venues)) {
          setVenues(cloudData.venues);
          StorageService.saveVenues(cloudData.venues);
        }
        if (Array.isArray(cloudData.referees)) {
          setReferees(cloudData.referees);
          StorageService.saveReferees(cloudData.referees);
        }
        if (Array.isArray(cloudData.complaints)) {
          setComplaints(cloudData.complaints);
          StorageService.saveComplaints(cloudData.complaints);
        }
        if (Array.isArray(cloudData.finances)) {
          setFinances(cloudData.finances);
          StorageService.saveFinances(cloudData.finances);
        }
        if (Array.isArray(cloudData.awards)) {
          const cleanedAwards = cloudData.awards.filter(
            (a: TournamentAward) => a.code !== 'TOP_SCORER' && a.code !== 'FAIR_PLAY'
          );
          setAwards(cleanedAwards);
          StorageService.saveAwards(cleanedAwards);
        }
        if (Array.isArray(cloudData.auditLogs)) {
          setAuditLogs(cloudData.auditLogs);
          StorageService.saveAuditLogs(cloudData.auditLogs);
        }
        if (cloudData.status) {
          setTournamentStatus(cloudData.status);
          StorageService.setTournamentStatus(cloudData.status);
        }
      },
      () => {
        setCloudStatus('offline');
      }
    );

    return () => {
      unsub();
    };
  }, [tournament.id]);

  const handleRoleChange = (_newRole: UserRole) => {
    // Bảo mật: Quyền hệ thống luôn gắn chặt với tài khoản đã xác thực trên PHP Session + MySQL
    handleOpenAuthModal('Vui lòng đăng nhập tài khoản đúng vai trò để sử dụng quyền tương ứng.');
  };

  const handleStatusChange = (newStatus: TournamentStatus) => {
    setTournamentStatus(newStatus);
    StorageService.setTournamentStatus(newStatus);
    StorageService.logAction(
      currentRole,
      currentRole,
      'CHUYỂN TRẠNG THÁI GIẢI ĐẤU',
      'Tournament State Machine',
      `Giai đoạn giải đấu chuyển sang: ${newStatus}`
    );
    const updatedLogs = StorageService.getAuditLogs();
    setAuditLogs(updatedLogs);
    pushTournamentCloud(tournament.id, {
      status: newStatus,
      auditLogs: updatedLogs,
    });
  };

  const handleSelectTournament = (tour: Tournament) => {
    StorageService.setActiveTournamentId(tour.id);
    invalidateTournamentPollCache(tour.id);
    const effectiveTour = getQueuedTournamentPatch(tour.id) || tour;
    setTournament(effectiveTour);
    setTeams(StorageService.getTeams());
    setMatches(StorageService.getMatches());
    setVenues(StorageService.getVenues());
    setReferees(StorageService.getReferees());
    setFinances(StorageService.getFinances());
    setComplaints(StorageService.getComplaints());
    setAwards(StorageService.getAwards());
    setAuditLogs(StorageService.getAuditLogs());
    setPaidFines(StorageService.getPaidFines());
    setTournamentStatus(tour.status || StorageService.getTournamentStatus());
    setNavHistory((prev) => [...prev, { viewMode: 'portal', tab: 'home' }]);
    if (typeof window !== 'undefined') {
      window.history.pushState({ viewMode: 'tournament', tab: 'home' }, '');
    }
    setViewMode('tournament');
    setActiveTab('home');
  };

  const handleDeleteTournament = async (tourId: string) => {
    const res = await deleteTournamentCloud(tourId);
    if (!res.ok) {
      alert(res.error || 'Không thể xóa giải đấu trên MySQL!');
      return;
    }

    StorageService.deleteTournament(tourId);
    const updatedList = StorageService.getAllTournaments();
    setAllTournaments(updatedList);

    if (tournament.id === tourId) {
      if (updatedList.length > 0) {
        handleSelectTournament(updatedList[0]);
      } else {
        setTournament({} as Tournament);
        setTeams([]);
        setMatches([]);
        setVenues([]);
        setReferees([]);
        setComplaints([]);
        setFinances([]);
        setAwards([]);
        setViewMode('portal');
      }
    }
  };

  const handleClearData = () => {
    if (confirm('Xác nhận: Bạn có muốn XÓA SẠCH toàn bộ dữ liệu giải đấu (đội bóng, lịch thi đấu, tỷ số, khiếu nại, thu chi) để bắt đầu lại từ đầu?')) {
      clearOfflineSyncForTournament(tournament.id);
      StorageService.clearAllData();
      StorageService.saveManualSuspensions({});
      StorageService.saveBtcTieBreaks({});
      StorageService.savePaidFines({});
      StorageService.saveTournamentStatsCache(tournament.id, [], []);
      setTournament(StorageService.getTournament());
      const updatedList = StorageService.getAllTournaments();
      setAllTournaments(updatedList);
      setTeams([]);
      setMatches([]);
      setComplaints([]);
      setFinances([]);
      setPaidFines({});
      setAwards(StorageService.getAwards());
      const updatedLogs = StorageService.getAuditLogs();
      setAuditLogs(updatedLogs);
      setTournamentStatus('REGISTRATION');
      void pushTournamentCloud(tournament.id, {
        teams: [],
        matches: [],
        complaints: [],
        finances: [],
        awards: defaultCleanAwards,
        manualSuspensions: {},
        btcTieBreaks: {},
        paidFines: {},
        status: 'REGISTRATION',
        auditLogs: updatedLogs,
      });
      alert('Đã xóa sạch dữ liệu giải đấu thành công trên CSDL MySQL!');
    }
  };

  const handleCreateNewTournament = async (newTour: Tournament) => {
    StorageService.createNewTournament(newTour);
    const updatedList = StorageService.getAllTournaments();
    const initialTeams = StorageService.getTeams();
    const initialMatches = StorageService.getMatches();
    const initialVenues = StorageService.getVenues();
    const initialReferees = StorageService.getReferees();
    const initialFinances = StorageService.getFinances();
    const initialComplaints = StorageService.getComplaints();
    const initialAwards = StorageService.getAwards();
    const initialLogs = StorageService.getAuditLogs();
    const initialStatus = newTour.status || 'REGISTRATION';

    const res = await createTournamentCloud({
      tournament: newTour,
      teams: initialTeams,
      matches: initialMatches,
      venues: initialVenues,
      referees: initialReferees,
      finances: initialFinances,
      complaints: initialComplaints,
      awards: initialAwards,
      auditLogs: initialLogs,
      manualSuspensions: {},
      btcTieBreaks: {},
      paidFines: {},
      status: initialStatus,
    });

    if (!res.ok) {
      alert(res.error || 'Không thể lưu giải đấu mới vào CSDL MySQL!');
      return;
    }

    setTournament(newTour);
    setAllTournaments(updatedList);
    setTeams(initialTeams);
    setMatches(initialMatches);
    setVenues(initialVenues);
    setReferees(initialReferees);
    setFinances(initialFinances);
    setComplaints(initialComplaints);
    setAwards(initialAwards);
    setAuditLogs(initialLogs);
    setTournamentStatus(initialStatus);
    setCreateTournamentOpen(false);
    setViewMode('tournament');
    setActiveTab('home');
  };

  const handleTournamentUpdate = (updatedTour: Tournament) => {
    StorageService.updateTournament(updatedTour);
    setTournament(updatedTour);
    const updatedList = StorageService.getAllTournaments();
    setAllTournaments(updatedList);
    const updatedLogs = StorageService.getAuditLogs();
    setAuditLogs(updatedLogs);
    void pushTournamentCloud(updatedTour.id, {
      tournament: updatedTour,
      auditLogs: updatedLogs,
    });
  };

  const handleOpenEditTournament = (tourToEdit: Tournament) => {
    setEditingTournament(tourToEdit);
    setEditTournamentOpen(true);
  };

  const handleSaveEditedTournament = (updatedTour: Tournament) => {
    StorageService.updateTournament(updatedTour);
    if (tournament.id === updatedTour.id) {
      setTournament(updatedTour);
    }
    const cleaned = StorageService.cleanExcessGroupsData(updatedTour);
    let currentMatches = cleaned.matches;
    if (
      updatedTour.formatType === 'GROUP_KNOCKOUT' &&
      updatedTour.startDate &&
      updatedTour.startDate !== tournament.startDate
    ) {
      currentMatches = ScheduleEngine.synchronizeMatchTimes(
        currentMatches,
        cleaned.teams,
        venues,
        referees,
        updatedTour.startDate
      );
      StorageService.saveMatches(currentMatches);
    }
    setTeams(cleaned.teams);
    setMatches(currentMatches);
    const updatedList = StorageService.getAllTournaments();
    setAllTournaments(updatedList);
    const updatedLogs = StorageService.getAuditLogs();
    setAuditLogs(updatedLogs);
    setEditTournamentOpen(false);
    setEditingTournament(undefined);
    void pushTournamentCloud(updatedTour.id, {
      tournament: updatedTour,
      teams: cleaned.teams,
      matches: currentMatches,
      auditLogs: updatedLogs,
    });
    alert(`Đã cập nhật cấu hình giải đấu "${updatedTour.name}" thành công!`);
  };

  // Đồng bộ cập nhật Trận đấu
  const handleMatchesUpdate = (newMatches: Match[]) => {
    setMatches(newMatches);
    StorageService.saveMatches(newMatches);
    const updatedTeams = StorageService.getTeams();
    setTeams(updatedTeams);
    const updatedLogs = StorageService.getAuditLogs();
    setAuditLogs(updatedLogs);
    void pushTournamentCloud(tournament.id, {
      matches: newMatches,
      teams: updatedTeams,
      auditLogs: updatedLogs,
    });
  };

  // Đồng bộ cập nhật Đội bóng & Cầu thủ
  const handleTeamsUpdate = (newTeams: Team[]) => {
    setTeams(newTeams);
    StorageService.saveTeams(newTeams);
    const updatedLogs = StorageService.getAuditLogs();
    setAuditLogs(updatedLogs);
    void pushTournamentCloud(tournament.id, {
      teams: newTeams,
      manualSuspensions: StorageService.getManualSuspensions(),
      auditLogs: updatedLogs,
    });
  };

  // Đồng bộ cập nhật Khiếu nại
  const handleComplaintsUpdate = (newComplaints: Complaint[]) => {
    setComplaints(newComplaints);
    StorageService.saveComplaints(newComplaints);
    const updatedLogs = StorageService.getAuditLogs();
    setAuditLogs(updatedLogs);
    void pushTournamentCloud(tournament.id, {
      complaints: newComplaints,
      auditLogs: updatedLogs,
    });
  };

  // Đồng bộ cập nhật Tài chính
  const handleFinancesUpdate = (newFinances: FinancialTransaction[]) => {
    setFinances(newFinances);
    StorageService.saveFinances(newFinances);
    const updatedLogs = StorageService.getAuditLogs();
    setAuditLogs(updatedLogs);
    void pushTournamentCloud(tournament.id, {
      finances: newFinances,
      auditLogs: updatedLogs,
    });
  };

  // Đồng bộ cập nhật Giải thưởng
  const handleAwardsUpdate = (newAwards: TournamentAward[]) => {
    setAwards(newAwards);
    StorageService.saveAwards(newAwards);
    const updatedLogs = StorageService.getAuditLogs();
    setAuditLogs(updatedLogs);
    void pushTournamentCloud(tournament.id, {
      awards: newAwards,
      auditLogs: updatedLogs,
    });
  };

  // Đồng bộ cập nhật Tiền phạt thẻ
  const handlePaidFinesUpdate = (nextMap: Record<string, PaidFineRecord>) => {
    setPaidFines(nextMap);
    StorageService.savePaidFines(nextMap);
    const updatedLogs = StorageService.getAuditLogs();
    setAuditLogs(updatedLogs);
    void pushTournamentCloud(tournament.id, {
      paidFines: nextMap,
      auditLogs: updatedLogs,
    });
  };

  const handleAddFineFinance = (tx: FinancialTransaction) => {
    const nextFin = [tx, ...finances];
    handleFinancesUpdate(nextFin);
  };

  // Quick navigation to live match
  const handleSelectMatchAndNavigateLive = (matchId: string) => {
    setSelectedMatchId(matchId);
    handleNavigateTab('live');
  };

  // User Authentication handlers
  const handleLoginSuccess = (user: UserAccount) => {
    setCurrentUser(user);
    setCurrentRole(user.role);
    StorageService.setCurrentRole(user.role);
    if ((activeTab === 'finance' || activeTab === 'audit' || activeTab === 'draw') && user.role !== 'SUPER_ADMIN' && user.role !== 'ORGANIZER') {
      setActiveTab('home');
    }
    if (activeTab === 'complaints' && (user.role !== 'SUPER_ADMIN' && user.role !== 'ORGANIZER' && user.role !== 'TEAM_MANAGER')) {
      setActiveTab('home');
    }
    setAuthModalOpen(false);
    void retryOfflineSyncAfterAuth();
    invalidateTournamentPollCache();
    triggerCloudRefreshNow();
  };

  const handleLogout = () => {
    void AuthService.logoutAsync();
    setCurrentUser(null);
    setCurrentRole('STUDENT');
    StorageService.setCurrentRole('STUDENT');
    setFinances([]);
    setAuditLogs([]);
    setComplaints([]);
    if (activeTab === 'finance' || activeTab === 'audit' || activeTab === 'draw' || activeTab === 'complaints') {
      setActiveTab('home');
    }
    invalidateTournamentPollCache();
    triggerCloudRefreshNow();
  };

  const [authInitialUsername, setAuthInitialUsername] = useState<string>('');

  const handleOpenAuthModal = (notice?: string, initialUsername?: string) => {
    setAuthNotice(notice);
    setAuthInitialUsername(initialUsername || '');
    setAuthModalOpen(true);
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-transparent flex flex-col items-center justify-center text-slate-800">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <div className="text-sm font-bold text-blue-600">Đang khởi tạo ITFTMS 2026...</div>
      </div>
    );
  }

  // View: Outer Portal of All Created Tournaments
  if (viewMode === 'portal' || allTournaments.length === 0 || !tournament?.id) {
    return (
      <div className="min-h-screen bg-transparent">
        <TournamentPortal
          tournaments={allTournaments}
          tournamentStats={tournamentStats}
          onSelectTournament={handleSelectTournament}
          onCreateTournament={() => setCreateTournamentOpen(true)}
          onEditTournament={handleOpenEditTournament}
          onDeleteTournament={handleDeleteTournament}
          currentRole={currentRole}
          onRoleChange={handleRoleChange}
          cloudStatus={cloudStatus}
          syncSnapshot={syncSnapshot}
          onRetrySync={handleManualRetrySync}
          currentUser={currentUser}
          onOpenAuthModal={() => handleOpenAuthModal()}
          onOpenUserManagement={() => setUserManagementOpen(true)}
          onLogout={handleLogout}
          onGoBack={handleGoBack}
          canGoBack={canGoBack}
        />
        <CreateTournamentModal
          isOpen={createTournamentOpen}
          onClose={() => setCreateTournamentOpen(false)}
          onSubmit={handleCreateNewTournament}
          currentTournament={tournament}
          mode="create"
        />
        <CreateTournamentModal
          isOpen={editTournamentOpen}
          onClose={() => {
            setEditTournamentOpen(false);
            setEditingTournament(undefined);
          }}
          onSubmit={handleSaveEditedTournament}
          currentTournament={editingTournament || tournament}
          mode="edit"
        />
        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          onLoginSuccess={handleLoginSuccess}
          messageNotice={authNotice}
          initialIdentifier={authInitialUsername}
        />
        <UserManagementModal
          isOpen={userManagementOpen}
          onClose={() => setUserManagementOpen(false)}
          currentUser={currentUser}
          currentRole={currentRole}
          teams={teams}
          onRefereesUpdated={(newReferees) => {
            setReferees(newReferees);
            if (tournament.id) {
              void pushTournamentCloud(tournament.id, {
                referees: newReferees,
              });
            }
          }}
          onAccountsUpdated={() => {
            setAuditLogs(StorageService.getAuditLogs());
          }}
        />
      </div>
    );
  }

  const liveMatches = matches.filter((m) => m.status === 'LIVE');
  const activeComplaints = complaints.filter((c) => c.status === 'PENDING' || c.status === 'UNDER_REVIEW');
  const suspendedPlayers = teams.flatMap((t) => t.players).filter((p) => p.isSuspended);
  const sportMeta = getSportMeta(tournament?.sportType);

  return (
    <div className="min-h-screen flex flex-col bg-transparent text-slate-900">
      
      {/* Header with Role Switcher, Tournament Stage, Sound FX & Clear Data */}
      <Header
        currentRole={currentRole}
        onRoleChange={handleRoleChange}
        tournamentStatus={tournamentStatus}
        onStatusChange={handleStatusChange}
        onClearData={handleClearData}
        liveMatchCount={liveMatches.length}
        onNavigateToLive={() => handleNavigateTab('live')}
        tournament={tournament}
        onOpenCreateTournament={() => setCreateTournamentOpen(true)}
        onEditTournament={() => handleOpenEditTournament(tournament)}
        onBackToPortal={() => handleNavigateViewMode('portal')}
        cloudStatus={cloudStatus}
        syncSnapshot={syncSnapshot}
        onRetrySync={handleManualRetrySync}
        onOpenMobileMenu={() => setMobileMenuOpen(true)}
        currentUser={currentUser}
        onOpenAuthModal={() => handleOpenAuthModal()}
        onOpenUserManagement={() => setUserManagementOpen(true)}
        onLogout={handleLogout}
        onGoBack={handleGoBack}
        canGoBack={canGoBack}
        activeTab={activeTab}
      />

      <OfflineSyncBanner
        cloudStatus={cloudStatus}
        syncSnapshot={syncSnapshot}
        onRetrySync={handleManualRetrySync}
        onRequestAuth={() =>
          handleOpenAuthModal('Vui lòng đăng nhập lại để đẩy dữ liệu đang lưu tạm lên MySQL.')
        }
      />

      {/* Navigation Tabs Bar */}
      <Navigation
        activeTab={activeTab}
        onTabChange={handleNavigateTab}
        liveMatchCount={liveMatches.length}
        activeComplaintsCount={activeComplaints.length}
        suspendedPlayersCount={suspendedPlayers.length}
        currentRole={currentRole}
        formatType={tournament?.formatType || 'SINGLE_LEAGUE'}
        onBackToPortal={() => handleNavigateViewMode('portal')}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-28 md:py-8">
        
        {activeTab === 'home' && (
          <PublicHome
            teams={teams}
            matches={matches}
            finances={finances}
            complaints={complaints}
            onNavigate={handleNavigateTab}
            onSelectMatch={handleSelectMatchAndNavigateLive}
            currentRole={currentRole}
            tournament={tournament}
          />
        )}

        {activeTab === 'live' && (
          <LiveMatchCenter
            matches={matches}
            teams={teams}
            onMatchesUpdate={handleMatchesUpdate}
            currentRole={currentRole}
            selectedMatchId={selectedMatchId}
            tournament={tournament}
          />
        )}

        {activeTab === 'schedule' && (
          <ScheduleView
            matches={matches}
            teams={teams}
            venues={venues}
            referees={referees}
            onMatchesUpdate={handleMatchesUpdate}
            onSelectMatch={handleSelectMatchAndNavigateLive}
            currentRole={currentRole}
            tournament={tournament}
            onTournamentUpdate={handleTournamentUpdate}
          />
        )}

        {activeTab === 'standings' && (
          <StandingsView
            teams={teams}
            matches={matches}
            currentRole={currentRole}
            tournament={tournament}
            onRefresh={() => {
              const refreshedTeams = StorageService.getTeams();
              const refreshedMatches = StorageService.getMatches();
              const refreshedLogs = StorageService.getAuditLogs();
              setTeams(refreshedTeams);
              setMatches(refreshedMatches);
              setAuditLogs(refreshedLogs);
              if (tournament.id) {
                void pushTournamentCloud(tournament.id, {
                  matches: refreshedMatches,
                  btcTieBreaks: StorageService.getBtcTieBreaks(),
                  auditLogs: refreshedLogs,
                });
              }
            }}
          />
        )}

        {activeTab === 'bracket' && (
          (tournament?.formatType || 'SINGLE_LEAGUE') === 'SINGLE_LEAGUE' ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center space-y-3 shadow-xs">
              <h3 className="text-lg font-black text-slate-900">Thể Thức Vòng Tròn 1 Lượt (Không Đá Knockout)</h3>
              <p className="text-xs text-slate-600 max-w-md mx-auto">
                Theo thể lệ giải, 12 đội thi đấu vòng tròn 1 lượt tính điểm xếp hạng chung cuộc (Top 1–2–3 nhận giải Nhất, Nhì, Ba). Vui lòng xem Bảng Xếp Hạng để theo dõi thứ hạng.
              </p>
              <button
                onClick={() => handleNavigateTab('standings')}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold"
              >
                Xem Bảng Xếp Hạng
              </button>
            </div>
          ) : (
            <BracketTree
              matches={matches}
              teams={teams}
              onSelectMatch={handleSelectMatchAndNavigateLive}
            />
          )
        )}

        {activeTab === 'teams' && (
          <TeamsView
            teams={teams}
            onTeamsUpdate={handleTeamsUpdate}
            currentRole={currentRole}
            tournament={tournament}
            currentUser={currentUser}
            onOpenAuthModal={handleOpenAuthModal}
          />
        )}

        {activeTab === 'draw' && (
          (currentRole === 'SUPER_ADMIN' || currentRole === 'ORGANIZER') ? (
            <DrawStudio
              teams={teams}
              onTeamsUpdate={handleTeamsUpdate}
              currentRole={currentRole}
              tournament={tournament}
              onTournamentUpdate={handleTournamentUpdate}
            />
          ) : (
            <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center text-slate-600 shadow-sm">
              Chức năng Bốc thăm chia bảng chỉ dành riêng cho Ban Tổ Chức (BTC) điều hành.
            </div>
          )
        )}

        {activeTab === 'discipline' && (
          <DisciplineView
            teams={teams}
            matches={matches}
            onTeamsUpdate={handleTeamsUpdate}
            currentRole={currentRole}
            tournament={tournament}
            paidFines={paidFines}
            onPaidFinesUpdate={handlePaidFinesUpdate}
            onAddFinanceTx={handleAddFineFinance}
          />
        )}

        {activeTab === 'complaints' && (
          (currentRole === 'SUPER_ADMIN' || currentRole === 'ORGANIZER' || currentRole === 'TEAM_MANAGER') ? (
            <ComplaintsView
              complaints={complaints}
              matches={matches}
              teams={teams}
              onComplaintsUpdate={handleComplaintsUpdate}
              currentRole={currentRole}
              currentUser={currentUser}
            />
          ) : (
            <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center text-slate-600 shadow-sm">
              Chức năng Khiếu nại 15 phút chỉ dành riêng cho Đội trưởng và Ban Tổ Chức theo Điều 17.
            </div>
          )
        )}

        {activeTab === 'finance' && (
          (currentRole === 'SUPER_ADMIN' || currentRole === 'ORGANIZER') ? (
            <FinanceView
              finances={finances}
              teams={teams}
              onFinancesUpdate={handleFinancesUpdate}
              onTeamsUpdate={handleTeamsUpdate}
              currentRole={currentRole}
              tournament={tournament}
              matches={matches}
              paidFines={paidFines}
            />
          ) : (
            <div className="bg-white border border-rose-200 rounded-3xl p-12 text-center space-y-4 shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto text-2xl">
                🔒
              </div>
              <h3 className="text-xl font-black text-slate-900">Khu Vực Bảo Mật Ban Tổ Chức</h3>
              <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                Thông tin tài chính, thu chi và lệ phí chỉ dành riêng cho Ban Tổ Chức (BTC) và Quản Trị Viên. Trọng tài, Đội trưởng và Sinh viên không được cấp quyền truy cập.
              </p>
            </div>
          )
        )}

        {activeTab === 'awards' && (
          <AwardsView
            awards={awards}
            onAwardsUpdate={handleAwardsUpdate}
            currentRole={currentRole}
            matches={matches}
            teams={teams}
            tournament={tournament}
          />
        )}

        {activeTab === 'audit' && (
          (currentRole === 'SUPER_ADMIN' || currentRole === 'ORGANIZER') ? (
            <AuditLogsView
              logs={auditLogs}
              currentRole={currentRole}
              onOpenUserManagement={() => setUserManagementOpen(true)}
            />
          ) : (
            <div className="bg-white border border-rose-200 rounded-3xl p-12 text-center space-y-4 shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto text-2xl">
                🔒
              </div>
              <h3 className="text-xl font-black text-white">Khu Vực Bảo Mật Ban Tổ Chức</h3>
              <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                Nhật ký hệ thống (Audit Logs) chỉ dành riêng cho Ban Tổ Chức và Quản Trị Viên kiểm soát dữ liệu.
              </p>
            </div>
          )
        )}

      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 text-slate-600 py-8 px-4 sm:px-6 lg:px-8 mt-12 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              ITFTMS 2026
            </span>
            <div>
              <span className="font-semibold text-slate-800 block">Khoa Công Nghệ Thông Tin • Ban Thể Thao Đoàn - Hội</span>
              <span className="text-[11px] text-blue-700 font-bold">Thực hiện: Phạm Su Bin • Lớp Kỹ Thuật Phần Mềm 23</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-slate-500">
            <span>{sportMeta.icon} {sportMeta.fullLabel}</span>
            <span>•</span>
            <span>{teams.length || tournament?.maxTeams || 12} {sportMeta.unitShortLabel} • {teams.reduce((s, t) => s + (t.players?.length || 0), 0)} {sportMeta.playerLabel}</span>
            <span>•</span>
            <span>{matches.length || ((tournament?.formatType || 'SINGLE_LEAGUE') === 'SINGLE_LEAGUE' ? 66 : 32)} Trận đấu</span>
            <span>•</span>
            <span>
              {(tournament?.formatType || 'SINGLE_LEAGUE') === 'SINGLE_LEAGUE'
                ? 'Vòng tròn 1 lượt'
                : 'Chia bảng & Knockout'}
            </span>
          </div>

          <div className="text-slate-500 text-center md:text-right">
            <div>Hệ Thống Quản Lý &amp; Điều Hành Giải Thể Thao CNTT 2026</div>
            <div className="text-[11px] font-semibold text-slate-700 mt-0.5">Phạm Su Bin — Lớp Kỹ Thuật Phần Mềm 23</div>
          </div>
        </div>
      </footer>

      {/* Modal: Tạo Mới Giải Đấu */}
      <CreateTournamentModal
        isOpen={createTournamentOpen}
        onClose={() => setCreateTournamentOpen(false)}
        onSubmit={handleCreateNewTournament}
        currentTournament={tournament}
        mode="create"
      />

      {/* Modal: Chỉnh Sửa Giải Đấu (Số Bảng, Số Đội 1 Bảng, Lệ Phí, Format) */}
      <CreateTournamentModal
        isOpen={editTournamentOpen}
        onClose={() => {
          setEditTournamentOpen(false);
          setEditingTournament(undefined);
        }}
        onSubmit={handleSaveEditedTournament}
        currentTournament={editingTournament || tournament}
        mode="edit"
      />

      {/* Mobile Smartphone Floating Bottom Navigation Bar */}
      <MobileBottomNav
        activeTab={activeTab}
        onTabChange={handleNavigateTab}
        liveMatchCount={liveMatches.length}
        activeComplaintsCount={activeComplaints.length}
        suspendedPlayersCount={suspendedPlayers.length}
        onOpenMobileMenu={() => setMobileMenuOpen(true)}
        onGoBack={handleGoBack}
        canGoBack={canGoBack}
      />

      {/* Mobile Full Screen Menu Drawer */}
      <MobileMenuDrawer
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        activeTab={activeTab}
        onSelectTab={handleNavigateTab}
        tournament={tournament}
        currentRole={currentRole}
        onRoleChange={handleRoleChange}
        tournamentStatus={tournamentStatus}
        onStatusChange={handleStatusChange}
        onOpenCreateTournament={() => setCreateTournamentOpen(true)}
        liveMatchCount={liveMatches.length}
        activeComplaintsCount={activeComplaints.length}
        suspendedPlayersCount={suspendedPlayers.length}
        onOpenEditTournament={() => handleOpenEditTournament(tournament)}
        onBackToPortal={() => handleNavigateViewMode('portal')}
        onClearData={handleClearData}
        currentUser={currentUser}
        onOpenAuthModal={() => handleOpenAuthModal()}
        onOpenUserManagement={() => setUserManagementOpen(true)}
        onLogout={handleLogout}
        onGoBack={handleGoBack}
        canGoBack={canGoBack}
        cloudStatus={cloudStatus}
        syncSnapshot={syncSnapshot}
        onRetrySync={handleManualRetrySync}
      />

      {/* Authentication Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
        messageNotice={authNotice}
        initialIdentifier={authInitialUsername}
      />

      {/* User & Staff Account Management Modal (Admin / BTC / Referee / Captain) */}
      <UserManagementModal
        isOpen={userManagementOpen}
        onClose={() => setUserManagementOpen(false)}
        currentUser={currentUser}
        currentRole={currentRole}
        teams={teams}
        onRefereesUpdated={(newReferees) => {
          setReferees(newReferees);
          void pushTournamentCloud(tournament.id, {
            referees: newReferees,
          });
        }}
        onAccountsUpdated={() => {
          setAuditLogs(StorageService.getAuditLogs());
        }}
      />

    </div>
  );
}
