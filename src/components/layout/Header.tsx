import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Clock, Shield, ChevronRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const routeTitleMap: Record<string, { title: string; category: string }> = {
  '/dashboard': { title: 'Dashboard', category: 'Overview' },
  '/employees': { title: 'Data Karyawan', category: 'Manajemen' },
  '/admins': { title: 'Data Admin', category: 'Manajemen' },
  '/reports': { title: 'Laporan Absensi', category: 'Laporan' },
  '/statistics': { title: 'Statistik Absensi', category: 'Laporan' },
  '/settings': { title: 'Pengaturan Akun', category: 'Akun' },
};

export const Header: React.FC = () => {
  const location = useLocation();
  const { admin } = useAuth();
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('id-ID', {
          timeZone: 'Asia/Jakarta',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }) + ' WIB'
      );
      setCurrentDate(
        now.toLocaleDateString('id-ID', {
          timeZone: 'Asia/Jakarta',
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const routeInfo = routeTitleMap[location.pathname] || {
    title: 'Sistem Absensi',
    category: 'Admin',
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-slate-400 font-medium">{routeInfo.category}</span>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-slate-800 font-semibold">{routeInfo.title}</span>
      </div>

      {/* Right Details: Realtime Clock, Network/Local Status, Admin Badge */}
      <div className="flex items-center gap-4">
        {/* Realtime Live Clock */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-slate-50 border border-slate-200/80 rounded-lg text-xs font-medium text-slate-700">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          <span>{currentDate}</span>
          <span className="text-slate-300">|</span>
          <span className="font-mono text-slate-900 font-semibold">{currentTime}</span>
        </div>

        {/* Local Network Status */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50/70 border border-emerald-200/60 rounded-md text-[11px] font-medium text-emerald-800">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Jaringan Kantor (LAN)</span>
        </div>

        {/* Current Admin Quick Link */}
        <Link
          to="/settings"
          className="flex items-center gap-2 pl-3 border-l border-slate-200 text-xs font-medium text-slate-700 hover:text-slate-900 transition-colors"
        >
          <Shield className="w-3.5 h-3.5 text-indigo-600" />
          <span>{admin?.username}</span>
        </Link>
      </div>
    </header>
  );
};
