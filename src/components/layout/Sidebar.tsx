import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  FileSpreadsheet,
  BarChart3,
  Settings,
  LogOut,
  Fingerprint,
  CalendarClock,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export const Sidebar: React.FC = () => {
  const { admin, logout } = useAuth();
  const { success, error } = useToast();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      success('Logout Berhasil', 'Anda telah keluar dari sesi admin.');
      navigate('/login');
    } catch (err: any) {
      error('Gagal Logout', err.message || 'Terjadi kesalahan saat logout.');
    }
  };

  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
      isActive
        ? 'bg-slate-900 text-white shadow-xs'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
    }`;

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 select-none">
      {/* Brand & System Tag */}
      <div className="p-5 border-b border-slate-100 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-xs">
          <Fingerprint className="w-5 h-5 text-indigo-300" />
        </div>
        <div>
          <div className="text-sm font-bold tracking-tight text-slate-900 flex items-center gap-1.5">
            PRESENSI<span className="text-indigo-600 font-extrabold">HUB</span>
          </div>
          <div className="text-[11px] font-medium text-slate-400">Web Admin On-Premise</div>
        </div>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-6">
        {/* Dashboard */}
        <div>
          <div className="px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Dashboard
          </div>
          <nav className="space-y-1">
            <NavLink to="/dashboard" className={navItemClass}>
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span>Dashboard</span>
            </NavLink>
          </nav>
        </div>

        {/* Manajemen */}
        <div>
          <div className="px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Manajemen
          </div>
          <nav className="space-y-1">
            <NavLink to="/employees" className={navItemClass}>
              <Users className="w-4 h-4 shrink-0" />
              <span>Data Karyawan</span>
            </NavLink>
            <NavLink to="/admins" className={navItemClass}>
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Data Admin</span>
            </NavLink>
            <NavLink to="/attendance-sessions" className={navItemClass}>
              <CalendarClock className="w-4 h-4 shrink-0" />
              <span>Sesi & Jadwal</span>
            </NavLink>
          </nav>
        </div>

        {/* Laporan */}
        <div>
          <div className="px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Laporan
          </div>
          <nav className="space-y-1">
            <NavLink to="/reports" className={navItemClass}>
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
              <span>Laporan Absensi</span>
            </NavLink>
            <NavLink to="/statistics" className={navItemClass}>
              <BarChart3 className="w-4 h-4 shrink-0" />
              <span>Statistik Absensi</span>
            </NavLink>
          </nav>
        </div>

        {/* Akun */}
        <div>
          <div className="px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Akun
          </div>
          <nav className="space-y-1">
            <NavLink to="/settings" className={navItemClass}>
              <Settings className="w-4 h-4 shrink-0" />
              <span>Pengaturan Akun</span>
            </NavLink>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-rose-600 hover:text-rose-700 hover:bg-rose-50/70 transition-colors text-left"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>Logout</span>
            </button>
          </nav>
        </div>
      </div>

      {/* Admin Profile Footer */}
      <div className="p-3.5 border-t border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-3 px-2 py-1.5">
          <div className="w-8 h-8 rounded-full bg-slate-200 border border-slate-300 text-slate-700 flex items-center justify-center font-bold text-xs uppercase">
            {admin?.username?.slice(0, 2) || '—'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-slate-900 truncate">
              {admin?.namaLengkap || '—'}
            </div>
            <div className="text-[11px] text-slate-500 font-mono truncate">
              {admin?.username ? `@${admin.username}` : '—'}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
