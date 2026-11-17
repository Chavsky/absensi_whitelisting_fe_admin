import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Fingerprint, Eye, EyeOff, Lock, User, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export const LoginPage: React.FC = () => {
  const { admin, login, backendUnavailable, retrySession } = useAuth();
  const { success } = useToast();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // If already logged in, redirect to dashboard
  if (admin) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanUsername = username.trim();
    if (!cleanUsername) {
      setErrorMessage('Username wajib diisi.');
      return;
    }

    if (!password) {
      setErrorMessage('Password wajib diisi.');
      return;
    }

    setIsLoading(true);

    try {
      await login(cleanUsername, password);
      success('Autentikasi Berhasil', `Selamat datang kembali, ${cleanUsername}`);
      navigate('/dashboard');
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal login. Periksa username dan password Anda.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-slate-50 p-4 select-none">
      {/* Background Subtle Grid Texture */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-40 pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-slate-900 text-white shadow-md mb-4 ring-4 ring-slate-100">
            <Fingerprint className="w-7 h-7 text-indigo-400" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            PRESENSI<span className="text-indigo-600 font-extrabold">HUB</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Portal Administrasi Web Presensi Karyawan On-Premise
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200/80 p-7 sm:p-8">
          <div className="mb-6">
            <h2 className="text-base font-semibold text-slate-900">Masuk ke Web Admin</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Masukkan kredensial administrator resmi kantor untuk melanjutkan.
            </p>
          </div>

          {errorMessage && (
            <div className="mb-5 p-3 rounded-lg bg-rose-50 border border-rose-200/80 flex items-start gap-2.5 text-xs text-rose-700 animate-in fade-in">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed font-medium">{errorMessage}</div>
            </div>
          )}

          {backendUnavailable && (
            <div className="mb-5 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
              Backend belum dapat dijangkau. Sesi belum dianggap invalid.{' '}
              <button type="button" className="font-semibold underline" onClick={() => void retrySession()}>
                Coba periksa lagi
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Username"
              type="text"
              autoComplete="username"
              placeholder="Contoh: admin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              startIcon={<User className="w-4 h-4" />}
              disabled={isLoading}
              required
            />

            <div>
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                startIcon={<Lock className="w-4 h-4" />}
                endIcon={
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword(!showPassword)}
                    className="hover:text-slate-600 focus:outline-none"
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
                disabled={isLoading}
                required
              />
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                className="w-full py-2.5"
                isLoading={isLoading}
              >
                Masuk ke Sistem
              </Button>
            </div>
          </form>

          {/* Local Server Note */}
          <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>Server Local: Port 3000</span>
            <span className="font-mono text-slate-500">HttpOnly Session</span>
          </div>
        </div>

        {/* Backend Note */}
        <div className="mt-4 text-center">
          <p className="text-xs text-slate-500">
            Terhubung ke Backend Absensi Resmi · Autentikasi Cookie HttpOnly
          </p>
        </div>
      </div>
    </div>
  );
};
