'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  UserPlus,
  Users,
  ShieldCheck,
  Scale,
  KeyRound,
  Lock,
  Trash2,
  Search,
  Copy,
  Check,
  Eye,
  EyeOff,
  User,
  Phone,
  Mail,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  ShieldAlert,
  Flag,
} from 'lucide-react';
import { UserAccount, UserRole, Referee, Team } from '@/types';
import { AuthService } from '@/services/auth';
import { StorageService } from '@/services/storage';
import { SoundFX } from '@/utils/soundEffects';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: UserAccount | null;
  currentRole: UserRole;
  teams?: Team[];
  onRefereesUpdated?: (newReferees: Referee[]) => void;
  onAccountsUpdated?: () => void;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  currentRole,
  teams = [],
  onRefereesUpdated,
  onAccountsUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<'ALL' | 'ORGANIZER' | 'REFEREE' | 'TEAM_MANAGER' | 'STUDENT'>('ALL');

  // Create account form state (KHÔNG có mật khẩu mặc định)
  const [targetRole, setTargetRole] = useState<'ORGANIZER' | 'REFEREE' | 'TEAM_MANAGER'>('REFEREE');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [refereeCode, setRefereeCode] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Status states
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successCreatedInfo, setSuccessCreatedInfo] = useState<{
    user: UserAccount;
    plainPassword: string;
  } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Dedicated Reset Password Modal State
  const [resetTargetUser, setResetTargetUser] = useState<UserAccount | null>(null);
  const [newResetPassword, setNewResetPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetModalError, setResetModalError] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoadingList(true);
    const res = await AuthService.fetchAllUsersAsync();
    setLoadingList(false);
    if (res.success) {
      setUsers(res.users);
    } else if (res.error) {
      setErrorMsg(res.error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void loadUsers();
      setErrorMsg(null);
      setSuccessCreatedInfo(null);
      setActionSuccessMsg(null);
      setResetTargetUser(null);
      if (teams.length > 0 && !selectedTeamId) {
        setSelectedTeamId(teams[0].id);
      }
    }
  }, [isOpen]);

  const handleFullNameChange = (val: string) => {
    setFullName(val);
    if (!username || username.startsWith('referee_') || username.startsWith('btc_') || username.startsWith('captain_')) {
      const clean = val
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9\s]/g, '');
      const parts = clean.split(' ').filter(Boolean);
      const lastName = parts[parts.length - 1] || clean;
      if (lastName) {
        if (targetRole === 'REFEREE') {
          setUsername(`referee_${lastName}`);
        } else if (targetRole === 'ORGANIZER') {
          setUsername(`btc_${lastName}`);
        } else {
          setUsername(`captain_${lastName}`);
        }
      }
    }
  };

  useEffect(() => {
    if (targetRole === 'REFEREE') {
      const refs = StorageService.getReferees();
      setRefereeCode(`TT-${String(refs.length + 1).padStart(2, '0')}`);
      if (username.startsWith('btc_') || username.startsWith('captain_')) {
        setUsername(username.replace(/^(btc_|captain_)/, 'referee_'));
      }
    } else if (targetRole === 'ORGANIZER') {
      if (username.startsWith('referee_') || username.startsWith('captain_')) {
        setUsername(username.replace(/^(referee_|captain_)/, 'btc_'));
      }
    } else if (targetRole === 'TEAM_MANAGER') {
      const team = teams.find((t) => t.id === selectedTeamId);
      if (team) {
        setUsername(AuthService.generateCaptainUsername(team.shortName || team.name || team.id));
      } else if (username.startsWith('referee_') || username.startsWith('btc_')) {
        setUsername(username.replace(/^(referee_|btc_)/, 'captain_'));
      }
    }
  }, [targetRole, selectedTeamId]);

  if (!isOpen) return null;

  const canManage = currentRole === 'SUPER_ADMIN' || currentRole === 'ORGANIZER';
  if (!canManage) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
        <div className="bg-white border border-rose-200 rounded-3xl p-6 max-w-md w-full text-center shadow-2xl">
          <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h3 className="text-lg font-black text-slate-900 mb-2">Quyền Truy Cập Bị Từ Chối</h3>
          <p className="text-xs text-slate-600 mb-4">
            Chức năng quản lý và cấp tài khoản chỉ dành riêng cho quyền Admin / Ban Tổ Chức.
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold"
          >
            Đóng
          </button>
        </div>
      </div>
    );
  }

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessCreatedInfo(null);

    if (!password.trim()) {
      setErrorMsg('Vui lòng nhập mật khẩu (hoặc bấm "Tạo mật khẩu ngẫu nhiên").');
      return;
    }

    if (targetRole === 'ORGANIZER') {
      const strength = AuthService.checkPasswordStrength(password);
      if (!strength.isValidForBtc) {
        setErrorMsg(`Mật khẩu tài khoản BTC chưa đủ độ phức tạp: ${strength.errors.join(', ')}.`);
        return;
      }
    } else if (password.trim().length < 6) {
      setErrorMsg('Mật khẩu tài khoản phải có tối thiểu 6 ký tự!');
      return;
    }

    const chosenTeam = targetRole === 'TEAM_MANAGER' ? teams.find((t) => t.id === selectedTeamId) : undefined;
    if (targetRole === 'TEAM_MANAGER' && !chosenTeam) {
      setErrorMsg('Vui lòng chọn đội bóng để gắn cho tài khoản Đội trưởng!');
      return;
    }

    setSubmitting(true);
    const plainPass = password.trim();
    const resolvedEmail = email.trim() || (username.trim() ? `${username.trim()}@ctuet.edu.vn` : '');
    const res = await AuthService.createStaffAccountAsync({
      fullName,
      username,
      password: plainPass,
      role: targetRole,
      phone,
      email: resolvedEmail,
      teamId: chosenTeam?.id,
      teamName: chosenTeam?.name,
    });
    setSubmitting(false);

    if (res.success && res.user) {
      SoundFX.playGoalCheer();
      setSuccessCreatedInfo({ user: res.user, plainPassword: plainPass });

      if (targetRole === 'REFEREE') {
        const referees = StorageService.getReferees();
        const exists = referees.some(
          (r) =>
            r.name.toLowerCase().trim() === fullName.toLowerCase().trim() ||
            (phone && r.phoneNumber === phone.trim())
        );
        if (!exists) {
          const newRef: Referee = {
            id: `REF-${Date.now()}`,
            code: refereeCode.trim() || `TT-${String(referees.length + 1).padStart(2, '0')}`,
            name: fullName.trim(),
            phoneNumber: phone.trim() || '0900000000',
            status: 'ACTIVE',
          };
          const nextRefs = [...referees, newRef];
          StorageService.saveReferees(nextRefs);
          onRefereesUpdated?.(nextRefs);
        }
      }

      StorageService.logAction(
        currentUser?.fullName || 'Ban Quản Trị',
        currentRole,
        'TẠO TÀI KHOẢN MỚI',
        `@${res.user.username}`,
        `Tạo tài khoản ${res.user.fullName} (vai trò: ${res.user.role}) trong CSDL MySQL.`
      );
      await loadUsers();
      onAccountsUpdated?.();

      setFullName('');
      setUsername('');
      setPassword('');
      setPhone('');
      setEmail('');
    } else {
      SoundFX.playWhistle();
      setErrorMsg(res.error || 'Không thể tạo tài khoản, vui lòng thử lại!');
    }
  };

  const handleCopyCredentials = (u: UserAccount, knownPlainPassword?: string) => {
    const isBtc = u.role === 'ORGANIZER' || u.role === 'SUPER_ADMIN';
    const roleLabel =
      u.role === 'REFEREE'
        ? 'Trọng Tài'
        : isBtc
        ? 'Ban Tổ Chức (BTC)'
        : u.role === 'TEAM_MANAGER'
        ? `Đội Trưởng (${u.teamName || 'Đội bóng'})`
        : 'Sinh Viên';

    const lines = [
      `Tài khoản: @${u.username}`,
      knownPlainPassword
        ? `Mật khẩu: ${knownPlainPassword}`
        : `Mật khẩu: [Do Admin cấp riêng / Đã mã hóa trong CSDL]`,
      `Vai trò: ${roleLabel}`,
      `Đăng nhập tại: ${window.location.origin}`,
    ];

    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedId(u.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleCustomResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetUser) return;
    setResetModalError(null);

    const isBtc = resetTargetUser.role === 'ORGANIZER' || resetTargetUser.role === 'SUPER_ADMIN';
    if (isBtc) {
      const strength = AuthService.checkPasswordStrength(newResetPassword);
      if (!strength.isValidForBtc) {
        setResetModalError(`Mật khẩu tài khoản BTC chưa đạt chuẩn: ${strength.errors.join(', ')}.`);
        return;
      }
    } else if (newResetPassword.trim().length < 6) {
      setResetModalError('Mật khẩu mới phải có tối thiểu 6 ký tự!');
      return;
    }

    setSubmitting(true);
    const res = await AuthService.resetUserPasswordAsync(resetTargetUser.id, newResetPassword.trim());
    setSubmitting(false);

    if (res.success) {
      StorageService.logAction(
        currentUser?.fullName || 'Ban Quản Trị',
        currentRole,
        'ĐỔI MẬT KHẨU TÀI KHOẢN',
        `@${resetTargetUser.username}`,
        `Đã cập nhật mật khẩu mới cho tài khoản @${resetTargetUser.username} trong MySQL.`
      );
      await loadUsers();
      onAccountsUpdated?.();
      setActionSuccessMsg(`Đã cập nhật mật khẩu mới (mã hóa Bcrypt) cho @${resetTargetUser.username}!`);
      setResetTargetUser(null);
      setNewResetPassword('');
      setTimeout(() => setActionSuccessMsg(null), 3500);
    } else {
      setResetModalError(res.error || 'Lỗi đặt lại mật khẩu');
    }
  };

  const handleDeleteUser = async (u: UserAccount) => {
    if (!confirm(`Bạn có chắc chắn muốn XÓA tài khoản @${u.username} (${u.fullName}) khỏi CSDL MySQL?`)) {
      return;
    }

    const res = await AuthService.deleteUserAccountAsync(u.id);
    if (res.success) {
      SoundFX.playWhistle();
      if (u.role === 'REFEREE') {
        const referees = StorageService.getReferees();
        const filteredRefs = referees.filter(
          (r) => r.name.toLowerCase().trim() !== u.fullName.toLowerCase().trim()
        );
        if (filteredRefs.length !== referees.length) {
          StorageService.saveReferees(filteredRefs);
          onRefereesUpdated?.(filteredRefs);
        }
      }
      StorageService.logAction(
        currentUser?.fullName || 'Ban Quản Trị',
        currentRole,
        'XÓA TÀI KHOẢN',
        `@${u.username}`,
        `Đã xóa tài khoản @${u.username} (${u.fullName}) khỏi CSDL MySQL.`
      );
      await loadUsers();
      onAccountsUpdated?.();
      setActionSuccessMsg(`Đã xóa tài khoản @${u.username} thành công!`);
      setTimeout(() => setActionSuccessMsg(null), 3000);
    } else {
      alert(res.error || 'Không thể xóa tài khoản!');
    }
  };

  const filteredUsers = users.filter((u) => {
    if (filterRole !== 'ALL') {
      if (filterRole === 'ORGANIZER') {
        if (u.role !== 'ORGANIZER' && u.role !== 'SUPER_ADMIN') return false;
      } else if (u.role !== filterRole) {
        return false;
      }
    }
    if (
      search &&
      !u.fullName.toLowerCase().includes(search.toLowerCase()) &&
      !u.username.toLowerCase().includes(search.toLowerCase()) &&
      !(u.phone && u.phone.includes(search)) &&
      !(u.email && u.email.toLowerCase().includes(search.toLowerCase())) &&
      !(u.teamName && u.teamName.toLowerCase().includes(search.toLowerCase()))
    ) {
      return false;
    }
    return true;
  });

  const btcCount = users.filter((u) => u.role === 'ORGANIZER' || u.role === 'SUPER_ADMIN').length;
  const refereeCount = users.filter((u) => u.role === 'REFEREE').length;
  const captainCount = users.filter((u) => u.role === 'TEAM_MANAGER').length;
  const studentCount = users.filter((u) => u.role === 'STUDENT').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[92vh] bg-white border border-slate-200 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-800">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 via-sky-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900">
                  Quản Lý Tài Khoản &amp; Phân Quyền (MySQL)
                </h2>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  Admin Control
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500">
                Toàn bộ tài khoản được lưu trong bảng MySQL `users` và mã hóa Bcrypt (không dùng mật khẩu mặc định)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 bg-slate-100 border border-slate-200 hover:border-slate-300 active:scale-95 transition-all"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 pt-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('list')}
              className={`px-4 py-2.5 rounded-t-xl text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'list'
                  ? 'border-blue-600 text-blue-700 bg-white font-black'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Danh Sách Tài Khoản</span>
              <span className="text-[10px] bg-slate-200/70 px-2 py-0.5 rounded-full text-slate-700 font-mono">
                {users.length}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveTab('create');
                setErrorMsg(null);
                setSuccessCreatedInfo(null);
              }}
              className={`px-4 py-2.5 rounded-t-xl text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'create'
                  ? 'border-blue-600 text-blue-700 bg-white font-black'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserPlus className="w-4 h-4 text-blue-600" />
              <span>Tạo Tài Khoản Mới</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg font-semibold">
            <Lock className="w-3.5 h-3.5" />
            <span>Bảo mật Bcrypt / SQL CSDL</span>
          </div>
        </div>

        {actionSuccessMsg && (
          <div className="mx-5 mt-3 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs font-bold text-emerald-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccessMsg}</span>
          </div>
        )}

        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {activeTab === 'list' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Tìm theo họ tên, @username, SĐT, email..."
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 text-xs rounded-xl pl-9 pr-3 py-2.5 focus:border-blue-500 focus:bg-white focus:outline-none transition-colors"
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
                  <button
                    onClick={() => setFilterRole('ALL')}
                    className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-colors ${
                      filterRole === 'ALL'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
                    }`}
                  >
                    Tất cả ({users.length})
                  </button>
                  <button
                    onClick={() => setFilterRole('ORGANIZER')}
                    className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                      filterRole === 'ORGANIZER'
                        ? 'bg-blue-600 text-white'
                        : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>BTC ({btcCount})</span>
                  </button>
                  <button
                    onClick={() => setFilterRole('REFEREE')}
                    className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                      filterRole === 'REFEREE'
                        ? 'bg-amber-600 text-white'
                        : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                    }`}
                  >
                    <Scale className="w-3.5 h-3.5" />
                    <span>Trọng Tài ({refereeCount})</span>
                  </button>
                  <button
                    onClick={() => setFilterRole('TEAM_MANAGER')}
                    className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-colors ${
                      filterRole === 'TEAM_MANAGER'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
                    }`}
                  >
                    Đội Trưởng ({captainCount})
                  </button>
                  {studentCount > 0 && (
                    <button
                      onClick={() => setFilterRole('STUDENT')}
                      className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-colors ${
                        filterRole === 'STUDENT'
                          ? 'bg-purple-600 text-white'
                          : 'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100'
                      }`}
                    >
                      Sinh Viên ({studentCount})
                    </button>
                  )}
                </div>
              </div>

              {loadingList ? (
                <div className="py-12 text-center text-xs text-slate-500">Đang tải danh sách từ MySQL...</div>
              ) : filteredUsers.length === 0 ? (
                <div className="py-12 text-center bg-slate-50 border border-slate-200 rounded-2xl">
                  <Users className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs text-slate-500 font-medium">Không tìm thấy tài khoản phù hợp</p>
                  <button
                    onClick={() => setActiveTab('create')}
                    className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-sky-600 text-white text-xs font-bold rounded-xl shadow-md transition-all"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Tạo tài khoản mới ngay</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredUsers.map((u) => {
                    const isReferee = u.role === 'REFEREE';
                    const isBTC = u.role === 'ORGANIZER' || u.role === 'SUPER_ADMIN';
                    const isCaptain = u.role === 'TEAM_MANAGER';
                    const isSelf = currentUser?.id === u.id;

                    return (
                      <div
                        key={u.id}
                        className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 bg-white shadow-xs ${
                          isReferee
                            ? 'border-amber-200 hover:border-amber-400'
                            : isBTC
                            ? 'border-blue-200 hover:border-blue-400'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <img
                            src={u.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.username}`}
                            alt={u.fullName}
                            className={`w-11 h-11 rounded-2xl object-cover border-2 shrink-0 ${
                              isReferee ? 'border-amber-300' : isBTC ? 'border-blue-300' : 'border-slate-200'
                            }`}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs sm:text-sm font-black text-slate-900 truncate">
                                {u.fullName}
                              </span>
                              {isSelf && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                  Bạn
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="font-mono text-xs font-bold text-blue-600">@{u.username}</span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                                  isReferee
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : isBTC
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : isCaptain
                                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                    : 'bg-purple-50 text-purple-700 border-purple-200'
                                }`}
                              >
                                {u.role === 'SUPER_ADMIN'
                                  ? 'Super Admin'
                                  : isBTC
                                  ? 'Ban Tổ Chức'
                                  : isReferee
                                  ? 'Trọng Tài'
                                  : isCaptain
                                  ? `Đội: ${u.teamName || u.teamId || 'Đội bóng'}`
                                  : 'Sinh Viên'}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500 truncate">
                              {u.phone && (
                                <span className="flex items-center gap-1 font-mono">
                                  <Phone className="w-3 h-3 text-slate-400" />
                                  {u.phone}
                                </span>
                              )}
                              {u.email && (
                                <span className="flex items-center gap-1 truncate">
                                  <Mail className="w-3 h-3 text-slate-400" />
                                  <span className="truncate">{u.email}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                            <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded border bg-slate-50 border-slate-200 text-slate-700 flex items-center gap-1">
                              <Lock className="w-3 h-3 text-emerald-600" />
                              <span>Đã mã hóa ({u.passwordAlgo === 'sha256' ? 'SQL SHA-256' : 'Bcrypt'})</span>
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleCopyCredentials(u)}
                              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 transition-all active:scale-95"
                              title="Sao chép tên đăng nhập"
                            >
                              {copiedId === u.id ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  <span className="text-emerald-600 font-bold">Đã chép</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                                  <span>Sao chép</span>
                                </>
                              )}
                            </button>

                            <button
                              onClick={() => {
                                setResetTargetUser(u);
                                setNewResetPassword('');
                                setResetModalError(null);
                              }}
                              className="p-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 transition-all active:scale-95"
                              title="Đổi mật khẩu mới"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                            </button>

                            {!isSelf && !(u.role === 'SUPER_ADMIN' && currentRole !== 'SUPER_ADMIN') && (
                              <button
                                onClick={() => void handleDeleteUser(u)}
                                className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-all active:scale-95"
                                title="Xóa tài khoản"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'create' && (
            <div className="max-w-2xl mx-auto space-y-4">
              {successCreatedInfo && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 shadow-md space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-300">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900">Tạo Tài Khoản Thành Công!</h4>
                      <p className="text-xs text-emerald-800">
                        Đã lưu tài khoản <strong>{successCreatedInfo.user.fullName}</strong> vào CSDL MySQL.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white border border-emerald-200 text-xs font-mono space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Tên đăng nhập:</span>
                      <strong className="text-blue-600">@{successCreatedInfo.user.username}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Email tài khoản:</span>
                      <strong className="text-slate-800">{successCreatedInfo.user.email}</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Mật khẩu vừa tạo:</span>
                      <strong className="text-slate-900 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded font-bold">
                        {successCreatedInfo.plainPassword}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Vai trò:</span>
                      <strong className="text-amber-700">{successCreatedInfo.user.role}</strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopyCredentials(successCreatedInfo.user, successCreatedInfo.plainPassword)}
                      className="flex-1 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-600 text-white font-bold text-xs flex items-center justify-center gap-2"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Sao Chép Thông Tin Đăng Nhập</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('list')}
                      className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-bold text-xs"
                    >
                      Xem Danh Sách
                    </button>
                  </div>
                </div>
              )}

              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    1. Chọn vai trò tài khoản muốn tạo <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div
                      onClick={() => setTargetRole('REFEREE')}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                        targetRole === 'REFEREE'
                          ? 'bg-amber-50/70 border-amber-400 ring-1 ring-amber-400'
                          : 'bg-white border-slate-200 hover:border-slate-300 opacity-85'
                      }`}
                    >
                      <Scale className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-black text-slate-900">Trọng Tài</div>
                        <p className="text-[11px] text-slate-600 mt-0.5">Biên bản trận, tỷ số &amp; thẻ phạt.</p>
                      </div>
                    </div>

                    <div
                      onClick={() => setTargetRole('TEAM_MANAGER')}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                        targetRole === 'TEAM_MANAGER'
                          ? 'bg-indigo-50/70 border-indigo-400 ring-1 ring-indigo-400'
                          : 'bg-white border-slate-200 hover:border-slate-300 opacity-85'
                      }`}
                    >
                      <Flag className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-black text-slate-900">Đội Trưởng</div>
                        <p className="text-[11px] text-slate-600 mt-0.5">Quản lý cầu thủ đội &amp; khiếu nại.</p>
                      </div>
                    </div>

                    <div
                      onClick={() => setTargetRole('ORGANIZER')}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                        targetRole === 'ORGANIZER'
                          ? 'bg-blue-50/70 border-blue-500 ring-1 ring-blue-500'
                          : 'bg-white border-slate-200 hover:border-slate-300 opacity-85'
                      }`}
                    >
                      <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-black text-slate-900">Ban Tổ Chức</div>
                        <p className="text-[11px] text-slate-600 mt-0.5">Toàn quyền điều hành giải đấu.</p>
                      </div>
                    </div>
                  </div>
                </div>

                {targetRole === 'TEAM_MANAGER' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Chọn Đội Bóng Gắn Với Tài Khoản <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedTeamId}
                      onChange={(e) => setSelectedTeamId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-900"
                    >
                      {teams.length === 0 ? (
                        <option value="">-- Chưa có đội bóng nào trong giải đang chọn --</option>
                      ) : (
                        teams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} ({t.shortName})
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Họ và tên nhân sự <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => handleFullNameChange(e.target.value)}
                        placeholder={targetRole === 'REFEREE' ? 'Ví dụ: Trần Văn Hùng' : 'Ví dụ: Nguyễn Văn A'}
                        className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Tên đăng nhập (@username) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      placeholder={targetRole === 'REFEREE' ? 'vd: referee_hung' : 'vd: btc_01'}
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono text-blue-600 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700">
                        Mật khẩu mới <span className="text-red-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const rand = AuthService.generateStrongPassword(12);
                          setPassword(rand);
                          setShowPassword(true);
                        }}
                        className="text-[10px] text-blue-600 hover:text-blue-700 underline font-mono flex items-center gap-1"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Tạo mật khẩu ngẫu nhiên</span>
                      </button>
                    </div>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={
                          targetRole === 'ORGANIZER'
                            ? 'Nhập mật khẩu mạnh (>= 8 ký tự)...'
                            : 'Nhập mật khẩu (>= 6 ký tự)...'
                        }
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {targetRole === 'ORGANIZER' && password && (
                      <div className="mt-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                        {(() => {
                          const str = AuthService.checkPasswordStrength(password);
                          return (
                            <div>
                              <div className="flex items-center justify-between text-[11px] mb-1">
                                <span className="text-slate-600">Độ phức tạp mật khẩu BTC:</span>
                                <strong style={{ color: str.color }}>{str.label}</strong>
                              </div>
                              <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden flex gap-0.5">
                                {[0, 1, 2, 3].map((step) => (
                                  <div
                                    key={step}
                                    className="h-full flex-1 transition-all"
                                    style={{ backgroundColor: step <= str.score ? str.color : '#CBD5E1' }}
                                  />
                                ))}
                              </div>
                              {!str.isValidForBtc && (
                                <span className="text-[10px] text-amber-700 mt-1.5 block">
                                  ⚠️ Yêu cầu BTC: {str.errors.join(', ')}.
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Số điện thoại liên hệ</label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Ví dụ: 0901 234 567"
                        className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Email (@ctuet.edu.vn - Tùy chọn)</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={username ? `${username}@ctuet.edu.vn` : 'email@ctuet.edu.vn'}
                        className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white"
                      />
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Để trống sẽ tự tạo email: <strong className="font-mono text-blue-700">{username || 'username'}@ctuet.edu.vn</strong>
                    </span>
                  </div>

                  {targetRole === 'REFEREE' && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Mã trọng tài</label>
                      <input
                        type="text"
                        value={refereeCode}
                        onChange={(e) => setRefereeCode(e.target.value)}
                        placeholder="Ví dụ: TT-01, TT-02..."
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-amber-300 rounded-xl text-xs sm:text-sm font-mono text-amber-800 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white"
                      />
                    </div>
                  )}
                </div>

                {errorMsg && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2 text-xs text-rose-700">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className={`w-full py-3 rounded-xl font-black text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50 ${
                      targetRole === 'REFEREE'
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
                        : targetRole === 'TEAM_MANAGER'
                        ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white'
                        : 'bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-600 text-white'
                    }`}
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>{submitting ? 'Đang lưu vào MySQL...' : 'Xác Nhận Tạo Tài Khoản Trong CSDL'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {resetTargetUser && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-slate-900/50">
            <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 text-slate-800">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-700 border border-amber-200">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">Đặt Mật Khẩu Mới (MySQL)</h3>
                    <p className="text-xs text-slate-500">
                      Tài khoản: <strong className="text-blue-600 font-mono">@{resetTargetUser.username}</strong> ({resetTargetUser.fullName})
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setResetTargetUser(null);
                    setResetModalError(null);
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-800 rounded-xl hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {resetModalError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{resetModalError}</span>
                </div>
              )}

              <form onSubmit={handleCustomResetPassword} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">Nhập mật khẩu mới</span>
                  <button
                    type="button"
                    onClick={() => {
                      const rand = AuthService.generateStrongPassword(12);
                      setNewResetPassword(rand);
                      setShowResetPassword(true);
                    }}
                    className="text-[10px] text-blue-600 hover:text-blue-700 underline font-mono flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Tạo mật khẩu mạnh</span>
                  </button>
                </div>

                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    required
                    value={newResetPassword}
                    onChange={(e) => setNewResetPassword(e.target.value)}
                    placeholder={
                      resetTargetUser.role === 'ORGANIZER' || resetTargetUser.role === 'SUPER_ADMIN'
                        ? 'Nhập mật khẩu phức tạp mới (>= 8 ký tự)...'
                        : 'Nhập mật khẩu mới (>= 6 ký tự)...'
                    }
                    className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700"
                  >
                    {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {newResetPassword && (
                  <div className="space-y-1.5 pt-1">
                    {(() => {
                      const str = AuthService.checkPasswordStrength(newResetPassword);
                      return (
                        <div>
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="text-slate-600">Độ phức tạp:</span>
                            <strong style={{ color: str.color }}>{str.label}</strong>
                          </div>
                          <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden flex gap-0.5">
                            {[0, 1, 2, 3].map((step) => (
                              <div
                                key={step}
                                className="h-full flex-1 transition-all"
                                style={{ backgroundColor: step <= str.score ? str.color : '#CBD5E1' }}
                              />
                            ))}
                          </div>
                          {(resetTargetUser.role === 'ORGANIZER' || resetTargetUser.role === 'SUPER_ADMIN') && !str.isValidForBtc && (
                            <div className="text-[10px] text-amber-700 mt-1.5 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3 text-amber-500 shrink-0" />
                              <span>Yêu cầu BTC: {str.errors.join(', ')}</span>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-600 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 disabled:opacity-50"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{submitting ? 'Đang cập nhật...' : 'Lưu Mật Khẩu Mới (Bcrypt MySQL)'}</span>
                </button>
              </form>

              <div className="pt-1 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setResetTargetUser(null);
                    setResetModalError(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold"
                >
                  Hủy Bỏ
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
