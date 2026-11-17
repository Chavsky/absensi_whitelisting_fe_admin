import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldCheck,
  UserPlus,
  Search,
  KeyRound,
  Edit2,
  Power,
  AlertTriangle,
  User,
} from 'lucide-react';
import { api } from '../../lib/api';
import { AdminAccount, AdminListResponse } from '../../types/admin';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { StatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Pagination } from '../../components/ui/Pagination';
import { Modal } from '../../components/ui/Modal';
import { LoadingState } from '../../components/ui/LoadingState';
import { EmptyState } from '../../components/ui/EmptyState';
import { AdminModal } from './AdminModal';
import { AdminPasswordModal } from './AdminPasswordModal';

export const AdminListPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { admin: currentAdmin } = useAuth();
  const { success, error: toastError } = useToast();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminAccount | null>(null);

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordTargetAdmin, setPasswordTargetAdmin] = useState<AdminAccount | null>(null);

  const [statusConfirmTarget, setStatusConfirmTarget] = useState<AdminAccount | null>(null);

  // Query filter mapping to isActive boolean
  const isActiveQueryParam =
    statusFilter === 'ACTIVE' ? true : statusFilter === 'INACTIVE' ? false : undefined;

  // Fetch Admins from official backend
  const { data, isLoading, isError, refetch } = useQuery<AdminListResponse>({
    queryKey: ['admins', { search, isActive: isActiveQueryParam, page: currentPage }],
    queryFn: () =>
      api.get('/admins', {
        search,
        isActive: isActiveQueryParam,
        page: currentPage,
        limit: 8,
      }),
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (newAdmin: any) => api.post('/admins', newAdmin),
    onSuccess: () => {
      success('Berhasil', 'Admin baru berhasil didaftarkan.');
      queryClient.invalidateQueries({ queryKey: ['admins'] });
    },
    onError: (err: any) => {
      toastError('Gagal Membuat Admin', err.message || 'Terjadi kesalahan.');
    },
  });

  // Edit mutation with backend contract (username, namaLengkap)
  const editMutation = useMutation({
    mutationFn: ({ id, username, namaLengkap }: { id: number; username: string; namaLengkap: string }) =>
      api.patch(`/admins/${id}`, { username, namaLengkap }),
    onSuccess: () => {
      success('Berhasil', 'Data admin berhasil diperbarui.');
      queryClient.invalidateQueries({ queryKey: ['admins'] });
    },
    onError: (err: any) => {
      toastError('Gagal Memperbarui Admin', err.message || 'Terjadi kesalahan.');
    },
  });

  // Reset password mutation with backend contract (newPassword)
  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, newPassword }: { id: number; newPassword: string }) =>
      api.patch(`/admins/${id}/password`, { newPassword }),
    onSuccess: () => {
      success('Password Berhasil Direset', 'Kredensial baru telah aktif.');
    },
    onError: (err: any) => {
      toastError('Gagal Reset Password', err.message || 'Terjadi kesalahan.');
    },
  });

  // Status toggle mutation with backend contract (isActive)
  const statusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      api.patch(`/admins/${id}/status`, { isActive }),
    onSuccess: (_, variables) => {
      success(
        'Status Admin Diubah',
        `Admin sekarang berstatus ${variables.isActive ? 'Aktif' : 'Nonaktif'}.`
      );
      queryClient.invalidateQueries({ queryKey: ['admins'] });
      setStatusConfirmTarget(null);
    },
    onError: (err: any) => {
      toastError('Gagal Mengubah Status', err.message || 'Terjadi kesalahan.');
      setStatusConfirmTarget(null);
    },
  });

  const handleOpenCreate = () => {
    setEditingAdmin(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (target: AdminAccount) => {
    setEditingAdmin(target);
    setIsFormModalOpen(true);
  };

  const handleOpenPassword = (target: AdminAccount) => {
    setPasswordTargetAdmin(target);
    setIsPasswordModalOpen(true);
  };

  const handleFormSubmit = async (formData: any) => {
    if (editingAdmin) {
      await editMutation.mutateAsync({
        id: editingAdmin.id,
        username: formData.username,
        namaLengkap: formData.namaLengkap,
      });
    } else {
      await createMutation.mutateAsync(formData);
    }
  };

  const handleConfirmStatus = async () => {
    if (!statusConfirmTarget) return;

    if (currentAdmin?.id === statusConfirmTarget.id && statusConfirmTarget.isActive) {
      toastError('Tindakan Ditolak', 'Anda tidak dapat menonaktifkan akun admin Anda sendiri.');
      setStatusConfirmTarget(null);
      return;
    }

    await statusMutation.mutateAsync({
      id: statusConfirmTarget.id,
      isActive: !statusConfirmTarget.isActive,
    });
  };

  const admins = data?.data || [];
  const pagination = data?.pagination || { total: 0, page: 1, limit: 8, totalPages: 1 };

  return (
    <div className="space-y-6">
      {/* Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Manajemen Akun Admin</h1>
          <p className="text-xs text-slate-500 mt-1">
            Seluruh administrator memiliki hak kelola setara. Pastikan username dan password dijaga dengan aman.
          </p>
        </div>
        <Button
          onClick={handleOpenCreate}
          variant="primary"
          icon={<UserPlus className="w-4 h-4" />}
        >
          Tambah Admin
        </Button>
      </div>

      {/* Filter and Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="w-full sm:flex-1">
          <Input
            placeholder="Cari admin berdasarkan username atau nama lengkap..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            startIcon={<Search className="w-4 h-4" />}
          />
        </div>
        <div className="w-full sm:w-48">
          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            options={[
              { value: 'ALL', label: 'Semua Status' },
              { value: 'ACTIVE', label: 'Hanya Aktif' },
              { value: 'INACTIVE', label: 'Hanya Nonaktif' },
            ]}
          />
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        {isLoading ? (
          <LoadingState message="Memuat data administrator..." className="h-64" />
        ) : isError ? (
          <div className="p-8 text-center">
            <p className="text-sm text-rose-600 mb-3">Tidak dapat terhubung ke backend absensi (http://localhost:3000).</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Coba Lagi
            </Button>
          </div>
        ) : admins.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck className="w-6 h-6" />}
            title="Tidak Ada Admin"
            description="Tidak ada data akun administrator yang sesuai kriteria pencarian."
            action={
              <Button size="sm" variant="outline" onClick={handleOpenCreate}>
                Tambah Admin Baru
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">ID Admin</th>
                  <th className="py-3 px-4">Username</th>
                  <th className="py-3 px-4">Nama Lengkap</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Tanggal Registrasi</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {admins.map((adm) => {
                  const isCurrent = adm.id === currentAdmin?.id;
                  return (
                    <tr key={adm.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* ID */}
                      <td className="py-3 px-4 font-mono font-medium text-slate-600">
                        {adm.id}
                      </td>

                      {/* Username */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-mono font-semibold text-slate-900">
                          <span>@{adm.username}</span>
                          {isCurrent && (
                            <span className="text-[10px] font-sans font-medium text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200">
                              Akun Anda
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Nama Lengkap */}
                      <td className="py-3 px-4 font-medium text-slate-800">
                        {adm.namaLengkap}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <StatusBadge status={adm.isActive} />
                      </td>

                      {/* Created At */}
                      <td className="py-3 px-4 text-slate-500">
                        {new Date(adm.createdAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Edit Details */}
                          <button
                            onClick={() => handleOpenEdit(adm)}
                            className="p-1.5 rounded-md text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                            title="Ubah Username / Nama"
                            aria-label={`Ubah ${adm.username}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Reset Password */}
                          <button
                            onClick={() => handleOpenPassword(adm)}
                            className="p-1.5 rounded-md text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                            title="Reset Password"
                            aria-label={`Reset password ${adm.username}`}
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>

                          {/* Toggle Status (Active / Inactive) */}
                          <button
                            onClick={() => setStatusConfirmTarget(adm)}
                            disabled={isCurrent && adm.isActive}
                            className={`p-1.5 rounded-md transition-colors ${
                              isCurrent
                                ? 'opacity-30 cursor-not-allowed text-slate-400'
                                : adm.isActive
                                ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                                : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={
                              isCurrent
                                ? 'Tidak dapat menonaktifkan akun sendiri'
                                : adm.isActive
                                ? 'Nonaktifkan Admin'
                                : 'Aktifkan Admin'
                            }
                            aria-label={`Ubah status ${adm.username}`}
                          >
                            <Power className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.total}
          limit={pagination.limit}
          onPageChange={(page) => setCurrentPage(page)}
        />
      </div>

      {/* Add / Edit Admin Modal */}
      <AdminModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSubmit={handleFormSubmit}
        admin={editingAdmin}
        isLoading={createMutation.isPending || editMutation.isPending}
      />

      {/* Reset Password Modal */}
      <AdminPasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        onSubmit={async (pw) => {
          if (passwordTargetAdmin) {
            await resetPasswordMutation.mutateAsync({ id: passwordTargetAdmin.id, newPassword: pw });
          }
        }}
        admin={passwordTargetAdmin}
        isLoading={resetPasswordMutation.isPending}
      />

      {/* Status Toggle Confirm Modal */}
      <Modal
        isOpen={!!statusConfirmTarget}
        onClose={() => setStatusConfirmTarget(null)}
        title={
          statusConfirmTarget?.isActive
            ? 'Konfirmasi Nonaktifkan Admin'
            : 'Konfirmasi Aktifkan Admin'
        }
        subtitle="Perubahan status akan langsung mempengaruhi kemampuan login."
        maxWidth="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setStatusConfirmTarget(null)}
              disabled={statusMutation.isPending}
            >
              Batal
            </Button>
            <Button
              variant={statusConfirmTarget?.isActive ? 'danger' : 'primary'}
              onClick={handleConfirmStatus}
              isLoading={statusMutation.isPending}
            >
              {statusConfirmTarget?.isActive ? 'Ya, Nonaktifkan' : 'Ya, Aktifkan'}
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-xs text-slate-600">
          <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200/80 rounded-lg text-amber-800">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              Anda akan {statusConfirmTarget?.isActive ? 'menonaktifkan' : 'mengaktifkan'} akun{' '}
              <strong className="text-slate-900 font-semibold">@{statusConfirmTarget?.username}</strong>{' '}
              ({statusConfirmTarget?.namaLengkap}).
            </div>
          </div>
          {statusConfirmTarget?.isActive && (
            <p className="text-slate-500 leading-normal">
              Admin nonaktif akan langsung dikeluarkan dari sesi aktif dan tidak dapat mengakses Web Admin hingga diaktifkan kembali.
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
};
