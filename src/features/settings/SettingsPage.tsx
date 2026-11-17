import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, User, Eye, EyeOff, Server, Check, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { StatusBadge } from '../../components/ui/Badge';
import { validateAdminPassword } from '../../lib/passwordUtils';
import { ApiClientError, api } from '../../lib/api';
import { useToast } from '../../context/ToastContext';

export const SettingsPage: React.FC = () => {
  const { admin, clearAdmin } = useAuth();
  const navigate = useNavigate();
  const { success } = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordValidation = validateAdminPassword(newPassword);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!passwordValidation.isValid) {
      setError(passwordValidation.errorMessage || 'Password baru belum memenuhi standar keamanan.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Konfirmasi password baru tidak cocok.');
      return;
    }
    if (!admin) {
      setError('Sesi admin tidak tersedia. Silakan masuk kembali.');
      return;
    }

    setIsLoading(true);
    try {
      await api.patch(`/admins/${admin.id}/password`, { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      success('Password berhasil diubah', 'Sesi admin telah berakhir. Silakan masuk kembali dengan password baru.');
      clearAdmin();
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err instanceof ApiClientError && err.statusCode === 400
        ? 'Password saat ini tidak sesuai atau password baru tidak memenuhi kebijakan.'
        : err instanceof Error ? err.message : 'Gagal mengubah password. Coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Title */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Pengaturan Akun Administrator</h1>
        <p className="text-xs text-slate-500 mt-1">
          Kelola rincian profil autentikasi, perbarui password akun, dan tinjau arsitektur keamanan sesi.
        </p>
      </div>

      {/* Profile Overview Card */}
      <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-xs">
        <h2 className="text-sm font-semibold text-slate-900 mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
          <User className="w-4 h-4 text-slate-600" />
          <span>Informasi Akun Anda</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="text-slate-400 font-medium">Username</label>
            <div className="text-sm font-mono font-semibold text-slate-900 mt-0.5">
              {admin?.username ? `@${admin.username}` : '—'}
            </div>
          </div>

          <div>
            <label className="text-slate-400 font-medium">Nama Lengkap</label>
            <div className="text-sm font-semibold text-slate-900 mt-0.5">
              {admin?.namaLengkap}
            </div>
          </div>

          <div>
            <label className="text-slate-400 font-medium">Status Akun</label>
            <div className="mt-1">
              {admin ? <StatusBadge status={admin.isActive} /> : '—'}
            </div>
          </div>

          <div>
            <label className="text-slate-400 font-medium">Hak Akses Sistem</label>
            <div className="text-slate-800 font-medium mt-0.5">
              Full Administrator (Setara)
            </div>
          </div>
        </div>
      </div>

      {/* Change Password Form */}
      <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-xs">
        <h2 className="text-sm font-semibold text-slate-900 mb-1 flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-slate-600" />
          <span>Perbarui Password Administrator</span>
        </h2>
        <p className="text-xs text-slate-500 mb-5">
          Perubahan password sendiri memverifikasi password saat ini dan mencabut sesi setelah berhasil.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
            {error}
          </div>
        )}
        <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
          <Input label="Password Saat Ini" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} disabled={isLoading} required />
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

          <div className="pt-2">
            <Button type="submit" variant="primary" isLoading={isLoading} disabled={isLoading}>
              Perbarui Password Sekarang
            </Button>
          </div>
        </form>
      </div>

      {/* Security Architecture Information */}
      <div className="bg-slate-100/70 p-5 rounded-xl border border-slate-200/80 text-xs text-slate-600 space-y-3">
        <div className="flex items-center gap-2 font-semibold text-slate-800">
          <Server className="w-4 h-4 text-slate-700" />
          <span>Arsitektur Keamanan Sesi On-Premise</span>
        </div>
        <p className="leading-relaxed text-[11px] text-slate-500">
          Sistem Web Admin beroperasi sepenuhnya di atas model keamanan zero-storage credential:
        </p>
        <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600 pl-1">
          <li><strong>Cookie HttpOnly:</strong> Token sesi <code className="bg-white px-1 py-0.5 rounded border border-slate-200 font-mono">admin_session</code> tidak dapat diakses atau dibaca oleh JavaScript browser.</li>
          <li><strong>No LocalStorage:</strong> Tidak ada token JWT, password, atau credential yang disimpan di <code className="bg-white px-1 py-0.5 rounded border border-slate-200 font-mono">localStorage</code> atau <code className="bg-white px-1 py-0.5 rounded border border-slate-200 font-mono">sessionStorage</code>.</li>
          <li><strong>SameSite Policy:</strong> Cookie dikirim otomatis oleh browser hanya untuk request domain yang sama, mencegah serangan CSRF.</li>
          <li><strong>No Simulated Tokens:</strong> Seluruh verifikasi sesi dilakukan secara live melalui endpoint <code className="bg-white px-1 py-0.5 rounded border border-slate-200 font-mono">GET /api/auth/me</code>.</li>
        </ul>
      </div>
    </div>
  );
};
