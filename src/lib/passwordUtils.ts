/**
 * Password Policy Enforcement for Admin Accounts:
 * - Minimum 12 characters
 * - At least one uppercase letter (A-Z)
 * - At least one lowercase letter (a-z)
 * - At least one number (0-9)
 * - At least one symbol / special character (!@#$%^&*...)
 */

export interface PasswordValidationResult {
  isValid: boolean;
  hasMinLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
  hasMaxByteLength: boolean;
  errorMessage?: string;
}

export function validateAdminPassword(password: string): PasswordValidationResult {
  const hasMinLength = password.length >= 12;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  const hasMaxByteLength = new TextEncoder().encode(password).length <= 72;

  const isValid = hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSymbol && hasMaxByteLength;

  let errorMessage: string | undefined;
  if (!isValid) {
    if (!hasMinLength) {
      errorMessage = 'Password minimal harus 12 karakter.';
    } else if (!hasUppercase) {
      errorMessage = 'Password harus mengandung minimal satu huruf kapital (A-Z).';
    } else if (!hasLowercase) {
      errorMessage = 'Password harus mengandung minimal satu huruf kecil (a-z).';
    } else if (!hasNumber) {
      errorMessage = 'Password harus mengandung minimal satu digit angka (0-9).';
    } else if (!hasSymbol) {
      errorMessage = 'Password harus mengandung minimal satu simbol/karakter khusus (!@#$%^&*...).';
    } else if (!hasMaxByteLength) {
      errorMessage = 'Password maksimal 72 byte dalam UTF-8.';
    }
  }

  return {
    isValid,
    hasMinLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    hasSymbol,
    hasMaxByteLength,
    errorMessage,
  };
}
