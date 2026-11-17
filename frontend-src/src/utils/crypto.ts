/**
 * ITFTMS 2026 - Password UI Helpers
 * KHÔNG chứa bất kỳ mật khẩu mặc định hay khóa bí mật nào ở phía client.
 * Toàn bộ băm và kiểm tra mật khẩu được thực hiện ở máy chủ PHP + MySQL.
 */

export interface PasswordStrengthResult {
  score: number; // 0 đến 4
  label: 'Rất yếu' | 'Yếu' | 'Trung bình' | 'Mạnh' | 'Rất mạnh';
  color: string;
  hasMinLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
  isValidForBtc: boolean;
  errors: string[];
}

export function checkPasswordStrength(password: string): PasswordStrengthResult {
  const p = (password || '').trim();
  const hasMinLength = p.length >= 8;
  const hasUppercase = /[A-Z]/.test(p);
  const hasLowercase = /[a-z]/.test(p);
  const hasNumber = /[0-9]/.test(p);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(p);

  const errors: string[] = [];
  if (!hasMinLength) errors.push('Tối thiểu 8 ký tự');
  if (!hasUppercase) errors.push('Có ít nhất 1 chữ HOA (A-Z)');
  if (!hasLowercase) errors.push('Có ít nhất 1 chữ thường (a-z)');
  if (!hasNumber) errors.push('Có ít nhất 1 chữ số (0-9)');
  if (!hasSpecialChar) errors.push('Có ít nhất 1 ký tự đặc biệt (!@#$%...)');

  let score = 0;
  if (p.length >= 6) score += 1;
  if (p.length >= 8) score += 1;
  if (hasUppercase && hasLowercase) score += 1;
  if (hasNumber) score += 1;
  if (hasSpecialChar) score += 1;

  const normalizedScore = Math.min(4, Math.max(0, score - 1));
  const labels: Array<PasswordStrengthResult['label']> = ['Rất yếu', 'Yếu', 'Trung bình', 'Mạnh', 'Rất mạnh'];
  const colors = ['#EF4444', '#F97316', '#EAB308', '#10B981', '#06B6D4'];

  const isValidForBtc = hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecialChar;

  return {
    score: normalizedScore,
    label: labels[normalizedScore] || 'Yếu',
    color: colors[normalizedScore] || '#EF4444',
    hasMinLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    hasSpecialChar,
    isValidForBtc,
    errors,
  };
}

function secureRandomIndex(max: number): number {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const arr = new Uint32Array(1);
    window.crypto.getRandomValues(arr);
    return arr[0] % max;
  }
  return Math.floor(Math.random() * max);
}

export function generateStrongPassword(length = 12): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const special = '@#$%!&*';
  const all = upper + lower + digits + special;

  const result = [
    upper[secureRandomIndex(upper.length)],
    lower[secureRandomIndex(lower.length)],
    digits[secureRandomIndex(digits.length)],
    special[secureRandomIndex(special.length)],
  ];

  for (let i = 4; i < length; i++) {
    result.push(all[secureRandomIndex(all.length)]);
  }

  for (let i = result.length - 1; i > 0; i--) {
    const j = secureRandomIndex(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result.join('');
}
