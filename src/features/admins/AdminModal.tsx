import React, { useState, useEffect } from 'react';
import { Check, X, ShieldAlert } from 'lucide-react';
import { AdminAccount } from '../../types/admin';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { validateAdminPassword } from '../../lib/passwordUtils';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  admin?: AdminAccount | null;
  isLoading?: boolean;
}

export const AdminModal: React.FC<AdminModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  admin,
  isLoading = false,
}) => {
  const isEditing = !!admin;

  const [username, setUsername] = useState('');
  const [namaLengkap, setNamaLengkap] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (admin) {
      setUsername(admin.username);
      setNamaLengkap(admin.namaLengkap);
      setPassword('');
    } else {
      setUsername('');
      setNamaLengkap('');
      setPassword('');
    }
    setError(null);
  }, [admin, isOpen]);

  const passwordValidation = validateAdminPassword(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanUsername = username.trim().toLowerCase();
    const cleanNamaLengkap = namaLengkap.trim();

    if (!cleanUsername) {
      setError('Username wajib diisi.');
      return;
    }

    if (!cleanNamaLengkap) {
      setError('Nama lengkap wajib diisi.');
      return;
    }

    if (!isEditing) {
      if (!passwordValidation.isValid) {
        setError(passwordValidation.errorMessage || 'Password belum memenuhi kebijakan keamanan.');
        return;
      }
    }

    try {
      if (isEditing) {
        // Backend contract: PATCH /api/admins/:id with { username, namaLengkap }
        await onSubmit({
          id: admin.id,
          username: cleanUsername,
          namaLengkap: cleanNamaLengkap,
        });
      } else {
        // Backend creates new administrators as active and rejects additional fields.
        await onSubmit({
          username: cleanUsername,
          namaLengkap: cleanNamaLengkap,
          password,
        });
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan data admin.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Ubah Data Akun Admin' : 'Tambah Administrator Baru'}
      subtitle={
        isEditing
          ? 'Perbarui username atau nama lengkap administrator kantor.'
          : 'Buat akun administrator baru dengan hak akses setara.'
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            Batal
          </Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={isLoading}>
            {isEditing ? 'Simpan Perubahan' : 'Buat Akun Admin'}
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

        <Input
          label="Username"
          placeholder="Contoh: admin_ops"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={isLoading}
          helperText="Gunakan huruf kecil tanpa spasi. Harus unik di seluruh sistem."
          required
        />

        <Input
          label="Nama Lengkap"
          placeholder="Contoh: Hendra Setiawan"
          value={namaLengkap}
          onChange={(e) => setNamaLengkap(e.target.value)}
          disabled={isLoading}
          required
        />

        {!isEditing && (
          <>
            <div>
              <Input
                label="Password Awal"
                type="password"
                placeholder="Minimal 12 karakter kombinasi"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
              />

              {/* Password Policy Checklist */}
              {password.length > 0 && (
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

            <p className="text-xs text-slate-500">Akun administrator baru dibuat dengan status aktif.</p>
          </>
        )}
      </form>
    </Modal>
  );
};
