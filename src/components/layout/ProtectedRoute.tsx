import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LoadingState } from '../ui/LoadingState';
import { Button } from '../ui/Button';

export const ProtectedRoute: React.FC = () => {
  const { admin, isLoading, backendUnavailable, retrySession } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
        <LoadingState message="Memverifikasi sesi admin..." />
      </div>
    );
  }

  if (backendUnavailable) {
    return <div className="h-screen flex flex-col items-center justify-center gap-3 bg-slate-50 text-center p-6">
      <p className="text-sm font-semibold text-slate-800">Backend sedang tidak tersedia</p>
      <p className="text-xs text-slate-500">Sesi belum dapat diperiksa. Periksa koneksi backend lalu coba lagi.</p>
      <Button onClick={retrySession}>Coba Lagi</Button>
    </div>;
  }

  if (!admin) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};
