import { UserAccount, UserRole } from '@/types';
import { checkPasswordStrength, generateStrongPassword } from '@/utils/crypto';
import { fetchJsonWithTimeout } from '@/utils/network';

interface AuthApiPayload {
  ok?: boolean;
  error?: string;
  authenticated?: boolean;
  user?: UserAccount;
  users?: UserAccount[];
  deletedUser?: UserAccount;
}

/**
 * ITFTMS 2026 - Authentication Service (PHP Session + MySQL)
 * KHÔNG chứa bất kỳ tài khoản mặc định, mật khẩu mẫu hay hàm tự tạo tài khoản nào.
 * Toàn bộ tài khoản được tạo bằng SQL trong CSDL hoặc qua API quản trị sau khi đăng nhập.
 */
export class AuthService {
  private static get isClient(): boolean {
    return typeof window !== 'undefined';
  }

  static clearLegacyLocalAuth(): void {
    if (!this.isClient) return;
    try {
      localStorage.removeItem('itftms_accounts_list_2026');
      localStorage.removeItem('itftms_current_authenticated_user_2026');
      localStorage.removeItem('itftms_current_role_2026');
    } catch {}
  }

  static generateCaptainUsername(shortNameOrId: string): string {
    const raw = (shortNameOrId || '').toLowerCase().trim();
    const unPrefixed = raw.replace(/^captain_+/, '');
    const clean = unPrefixed
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]/g, '');
    return `captain_${clean || 'team'}`;
  }

  private static async requestAuthJson(
    action: string,
    options: { method?: 'GET' | 'POST'; body?: unknown; timeoutMs?: number } = {}
  ) {
    const { method = 'GET', body, timeoutMs = 10000 } = options;
    return fetchJsonWithTimeout<AuthApiPayload>(`/api/auth.php?action=${action}`, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      timeoutMs,
      ...(body !== undefined
        ? {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }
        : {}),
    });
  }

  static async fetchSessionUserAsync(): Promise<UserAccount | null> {
    if (!this.isClient) return null;
    this.clearLegacyLocalAuth();
    const res = await this.requestAuthJson('me', { method: 'GET', timeoutMs: 6000 });
    if (res.ok && res.data?.ok && res.data.authenticated && res.data.user) {
      return res.data.user;
    }
    return null;
  }

  static async loginAsync(
    identifier: string,
    password: string
  ): Promise<{ success: boolean; user?: UserAccount; error?: string }> {
    const res = await this.requestAuthJson('login', {
      method: 'POST',
      body: { identifier, password },
      timeoutMs: 12000,
    });
    if (res.ok && res.data?.ok && res.data.user) {
      return { success: true, user: res.data.user };
    }
    if (res.isNetworkError || res.isTimeout) {
      return {
        success: false,
        error: res.error || 'Không thể kết nối máy chủ xác thực MySQL. Vui lòng kiểm tra mạng hoặc api/config.php!',
      };
    }
    return {
      success: false,
      error: res.error || 'Tên đăng nhập hoặc mật khẩu không chính xác!',
    };
  }

  static async registerAsync(data: {
    fullName: string;
    username: string;
    email: string;
    password: string;
    studentId?: string;
    class?: string;
    phone?: string;
  }): Promise<{ success: boolean; user?: UserAccount; error?: string }> {
    const res = await this.requestAuthJson('register', {
      method: 'POST',
      body: data,
      timeoutMs: 12000,
    });
    if (res.ok && res.data?.ok && res.data.user) {
      return { success: true, user: res.data.user };
    }
    return {
      success: false,
      error: res.error || 'Đăng ký tài khoản thất bại!',
    };
  }

  static async logoutAsync(): Promise<void> {
    if (!this.isClient) return;
    await this.requestAuthJson('logout', { method: 'POST', timeoutMs: 5000 });
    this.clearLegacyLocalAuth();
  }

  static async fetchAllUsersAsync(): Promise<{ success: boolean; users: UserAccount[]; error?: string }> {
    const res = await this.requestAuthJson('users', { method: 'GET', timeoutMs: 10000 });
    if (res.ok && res.data?.ok && Array.isArray(res.data.users)) {
      return { success: true, users: res.data.users };
    }
    return {
      success: false,
      users: [],
      error: res.error || 'Không thể tải danh sách tài khoản.',
    };
  }

  static async createStaffAccountAsync(data: {
    fullName: string;
    username: string;
    password: string;
    role: UserRole;
    phone?: string;
    email?: string;
    teamId?: string;
    teamName?: string;
  }): Promise<{ success: boolean; user?: UserAccount; error?: string }> {
    const res = await this.requestAuthJson('create_staff', {
      method: 'POST',
      body: data,
      timeoutMs: 12000,
    });
    if (res.ok && res.data?.ok && res.data.user) {
      return { success: true, user: res.data.user };
    }
    return { success: false, error: res.error || 'Không thể tạo tài khoản!' };
  }

  static async createCaptainAccountAsync(data: {
    teamId: string;
    teamName: string;
    captainName?: string;
    username: string;
    password: string;
    email?: string;
    phone?: string;
  }): Promise<{ success: boolean; user?: UserAccount; error?: string }> {
    const res = await this.requestAuthJson('create_captain', {
      method: 'POST',
      body: data,
      timeoutMs: 12000,
    });
    if (res.ok && res.data?.ok && res.data.user) {
      return { success: true, user: res.data.user };
    }
    return { success: false, error: res.error || 'Không thể tạo tài khoản Đội trưởng!' };
  }

  static async resetUserPasswordAsync(
    userId: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> {
    const res = await this.requestAuthJson('reset_password', {
      method: 'POST',
      body: { userId, newPassword },
      timeoutMs: 12000,
    });
    if (res.ok && res.data?.ok) {
      return { success: true };
    }
    return { success: false, error: res.error || 'Không thể đổi mật khẩu!' };
  }

  static async deleteUserAccountAsync(
    userId: string
  ): Promise<{ success: boolean; deletedUser?: UserAccount; error?: string }> {
    const res = await this.requestAuthJson('delete_user', {
      method: 'POST',
      body: { userId },
      timeoutMs: 12000,
    });
    if (res.ok && res.data?.ok) {
      return { success: true, deletedUser: res.data.deletedUser };
    }
    return { success: false, error: res.error || 'Không thể xóa tài khoản!' };
  }

  static checkPasswordStrength(password: string) {
    return checkPasswordStrength(password);
  }

  static generateStrongPassword(length = 12): string {
    return generateStrongPassword(length);
  }
}
