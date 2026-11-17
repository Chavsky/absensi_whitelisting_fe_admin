import React from 'react';

type StatusType =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'Tepat Waktu'
  | 'Terlambat'
  | 'Belum Absen'
  | 'Sudah Absen'
  | 'Pulang Cepat'
  | 'Hadir'
  | 'info'
  | boolean;

interface StatusBadgeProps {
  status?: StatusType | string | null;
  label?: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status = 'Belum Absen', label, className = '' }) => {
  // Normalize boolean isActive from backend (true = Aktif, false = Nonaktif)
  const safeStatus = status ?? 'Belum Absen';
  const normalizedStatus = typeof safeStatus === 'boolean' ? (safeStatus ? 'Aktif' : 'Nonaktif') : safeStatus;
  const displayLabel = label || normalizedStatus;

  switch (normalizedStatus) {
    case 'ACTIVE':
    case 'Aktif':
    case 'Tepat Waktu':
    case 'Hadir':
    case 'Sudah Absen':
      return (
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50/80 px-2 py-0.5 rounded border border-emerald-200/60 ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" aria-hidden="true" />
          <span>{displayLabel === 'ACTIVE' ? 'Aktif' : displayLabel}</span>
        </span>
      );

    case 'Terlambat':
      return (
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50/80 px-2 py-0.5 rounded border border-amber-200/60 ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" aria-hidden="true" />
          <span>{displayLabel}</span>
        </span>
      );

    case 'Pulang Cepat':
      return (
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium text-orange-700 bg-orange-50/80 px-2 py-0.5 rounded border border-orange-200/60 ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" aria-hidden="true" />
          <span>{displayLabel}</span>
        </span>
      );

    case 'INACTIVE':
    case 'Nonaktif':
      return (
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/80 ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" aria-hidden="true" />
          <span>{displayLabel === 'INACTIVE' ? 'Nonaktif' : displayLabel}</span>
        </span>
      );

    case 'Belum Absen':
    default:
      return (
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium text-rose-600 bg-rose-50/60 px-2 py-0.5 rounded border border-rose-200/50 ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" aria-hidden="true" />
          <span>{displayLabel}</span>
        </span>
      );
  }
};
