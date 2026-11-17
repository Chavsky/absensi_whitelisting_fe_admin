import React, { useState } from 'react';
import { Eye, EyeOff, KeyRound, Check, X } from 'lucide-react';
import { AdminAccount } from '../../types/admin';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { validateAdminPassword } from '../../lib/passwordUtils';

interface AdminPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (newPassword: string) => Promise<void>;
  admin: AdminAccount | null;
  isLoading?: boolean;
}

export const AdminPasswordModal: React.FC<AdminPasswordModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  admin,
  isLoading = false,
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!admin) return null;

  const passwordValidation = validateAdminPassword(newPassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!passwordValidation.isValid) {
      setError(passwordValidation.errorMessage || 'Password belum memenuhi kebijakan keamanan.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Konfirmasi password tidak cocok.');
      return;
    }

    try {
      await onSubmit(newPassword);
      setNewPassword('');
      setConfirmPassword('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Gagal mereset password admin.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reset Password Admin"
      subtitle={`Tetapkan password baru untuk akun @${admin.username} (${admin.namaLengkap})`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            Batal
          </Button>
          <Button variant="danger" onClick={handleSubmit} isLoading={isLoading}>
            Simpan Password Baru
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
            {error}
          </div>
        )}

        <div>
          <Input
            label="Password Baru"
            type={showPassword ? 'text' : 'password'}
            placeholder="Minimal 12 karakter kombinasi"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            startIcon={<KeyRound className="w-4 h-4" />}
            endIcon={
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword(!showPassword)}
                className="hover:text-slate-600 focus:outline-none"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
            disabled={isLoading}
            required
          />

          {newPassword.length > 0 && (
            <div className="mt-2 p-3 bg-slate-50 border border-slate-200/80 rounded-lg text-[11px] space-y-1">
              <div className="font-semibold text-slate-700 mb-1">Syarat Kompleksitas Password:</div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                <span className={`flex items-center gap-1 ${passwordValidation.hasMinLength ? 'text-emerald-600 font-medium' : 'text-slate-400'}`}>
                  {passwordValidation.hasMinLength ? <Check className="w-3 h-3 text-emerald-600" /> : <X className="w-3 h-3" />}
                  Min. 12 karakter
                </span>
                <span className={`flex items-center gap-1 ${passwordValidation.hasUppercase ? 'text-emerald-600 font-medium' : 'text-slate-400'}`}>
                  {passwordValidation.hasUppercase ? <Check className="w-3 h-3 text-emerald-600" /> : <X className="w-3 h-3" />}
                  Huruf besar (A-Z)
                </span>
                <span className={`flex items-center gap-1 ${passwordValidation.hasLowercase ? 'text-emerald-600 font-medium' : 'text-slate-400'}`}>
                  {passwordValidation.hasLowercase ? <Check className="w-3 h-3 text-emerald-600" /> : <X className="w-3 h-3" />}
                  Huruf kecil (a-z)
                </span>
                <span className={`flex items-center gap-1 ${passwordValidation.hasNumber ? 'text-emerald-600 font-medium' : 'text-slate-400'}`}>
                  {passwordValidation.hasNumber ? <Check className="w-3 h-3 text-emerald-600" /> : <X className="w-3 h-3" />}
                  Digit angka (0-9)
                </span>
                <span className={`flex items-center gap-1 col-span-2 ${passwordValidation.hasSymbol ? 'text-emerald-600 font-medium' : 'text-slate-400'}`}>
                  {passwordValidation.hasSymbol ? <Check className="w-3 h-3 text-emerald-600" /> : <X className="w-3 h-3" />}
                  Simbol khusus (!@#$%^&*...)
                </span>
                <span className={`col-span-2 ${passwordValidation.hasMaxByteLength ? 'text-emerald-600' : 'text-rose-600'}`}>Maksimal 72 byte UTF-8</span>
              </div>
            </div>
          )}
        </div>

        <Input
          label="Ulangi Password Baru"
          type={showPassword ? 'text' : 'password'}
          placeholder="Ketik ulang password baru"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          startIcon={<KeyRound className="w-4 h-4" />}
          disabled={isLoading}
          required
        />

        <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg text-xs text-slate-500 leading-relaxed">
          Pemberitahuan: Setelah password direset melalui <code className="font-mono text-slate-700 bg-white px-1 py-0.5 rounded border border-slate-200">PATCH /api/admins/:id/password</code>, sesi aktif admin bersangkutan akan dicabut dan harus login kembali.
        </div>
      </form>
    </Modal>
  );
};
