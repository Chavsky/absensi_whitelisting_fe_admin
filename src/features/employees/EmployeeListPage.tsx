import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  UserPlus,
  Search,
  Edit2,
  Eye,
  Power,
  Smartphone,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../../lib/api';
import { Employee, EmployeeListResponse } from '../../types/employee';
import { useToast } from '../../context/ToastContext';
import { StatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Pagination } from '../../components/ui/Pagination';
import { Modal } from '../../components/ui/Modal';
import { LoadingState } from '../../components/ui/LoadingState';
import { EmptyState } from '../../components/ui/EmptyState';
import { EmployeeModal } from './EmployeeModal';
import { EmployeeDetailModal } from './EmployeeDetailModal';

export const EmployeeListPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);

  // Status toggle confirmation modal
  const [statusConfirmTarget, setStatusConfirmTarget] = useState<Employee | null>(null);

  // Query filter mapping to backend isActive boolean
  const isActiveQueryParam =
    statusFilter === 'ACTIVE' ? true : statusFilter === 'INACTIVE' ? false : undefined;

  const { data, isLoading, isError, refetch } = useQuery<EmployeeListResponse>({
    queryKey: ['employees', { search, isActive: isActiveQueryParam, page: currentPage }],
    queryFn: () =>
      api.get('/employees', {
        search,
        isActive: isActiveQueryParam,
        page: currentPage,
        limit: 8,
      }),
  });

  // Create mutation: POST /api/employees with { nik, namaLengkap, isActive }
  const createMutation = useMutation({
    mutationFn: (newEmp: Partial<Employee>) => api.post('/employees', newEmp),
    onSuccess: () => {
      success('Berhasil', 'Karyawan baru berhasil didaftarkan.');
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['attendanceSummary'] });
    },
    onError: (err: any) => {
      toastError('Gagal Menambahkan', err.message || 'Terjadi kesalahan saat menambah karyawan.');
    },
  });

  // Edit mutation: PATCH /api/employees/:nik with { namaLengkap }
  const editMutation = useMutation({
    mutationFn: ({ nik, data }: { nik: string; data: Partial<Employee> }) =>
      api.patch(`/employees/${nik}`, data),
    onSuccess: () => {
      success('Berhasil', 'Data karyawan berhasil diperbarui.');
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: (err: any) => {
      toastError('Gagal Memperbarui', err.message || 'Terjadi kesalahan saat mengubah data.');
    },
  });

  // Toggle status mutation: PATCH /api/employees/:nik/status with { isActive }
  const statusMutation = useMutation({
    mutationFn: ({ nik, isActive }: { nik: string; isActive: boolean }) =>
      api.patch(`/employees/${nik}/status`, { isActive }),
    onSuccess: (_, variables) => {
      success(
        'Status Berhasil Diubah',
        `Karyawan kini berstatus ${variables.isActive ? 'Aktif' : 'Nonaktif'}.`
      );
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['attendanceSummary'] });
      setStatusConfirmTarget(null);
    },
    onError: (err: any) => {
      toastError('Gagal Mengubah Status', err.message || 'Terjadi kesalahan saat mengubah status.');
      setStatusConfirmTarget(null);
    },
  });

  const handleOpenCreate = () => {
    setEditingEmployee(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (emp: Employee) => {
    setEditingEmployee(emp);
    setIsFormModalOpen(true);
  };

  const handleOpenDetail = (emp: Employee) => {
    setViewingEmployee(emp);
    setIsDetailModalOpen(true);
  };

  const handleFormSubmit = async (formData: Partial<Employee>) => {
    if (editingEmployee) {
      await editMutation.mutateAsync({ nik: editingEmployee.nik, data: formData });
    } else {
      await createMutation.mutateAsync(formData);
    }
  };

  const handleConfirmStatusToggle = async () => {
    if (!statusConfirmTarget) return;
    await statusMutation.mutateAsync({
      nik: statusConfirmTarget.nik,
      isActive: !statusConfirmTarget.isActive,
    });
  };

  const employees = data?.data || [];
  const pagination = data?.pagination || { total: 0, page: 1, limit: 8, totalPages: 1 };

  return (
    <div className="space-y-6">
      {/* Page Title & Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Manajemen Data Karyawan</h1>
          <p className="text-xs text-slate-500 mt-1">
            Kelola master data pegawai kantor, status keaktifan, dan verifikasi perangkat terdaftar.
          </p>
        </div>
        <Button
          onClick={handleOpenCreate}
          variant="primary"
          icon={<UserPlus className="w-4 h-4" />}
        >
          Tambah Karyawan
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="w-full sm:flex-1">
          <Input
            placeholder="Cari berdasarkan NIK atau nama lengkap karyawan..."
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
          <LoadingState message="Memuat data karyawan..." className="h-64" />
        ) : isError ? (
          <div className="p-8 text-center">
            <p className="text-sm text-rose-600 mb-3">Tidak dapat terhubung ke backend absensi (http://localhost:3000).</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Coba Lagi
            </Button>
          </div>
        ) : employees.length === 0 ? (
          <EmptyState
            icon={<Users className="w-6 h-6" />}
            title="Tidak Ada Data Karyawan"
            description={
              search
                ? `Tidak ditemukan karyawan dengan kata kunci "${search}".`
                : 'Belum ada data karyawan yang terdaftar dalam sistem.'
            }
            action={
              <Button size="sm" variant="outline" onClick={handleOpenCreate}>
                Tambah Karyawan Baru
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">NIK</th>
                  <th className="py-3 px-4">Nama Lengkap</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Perangkat Enrolled</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.map((emp) => (
                  <tr key={emp.nik} className="hover:bg-slate-50/70 transition-colors">
                    {/* NIK */}
                    <td className="py-3 px-4 font-mono font-medium text-slate-800">
                      {emp.nik}
                    </td>

                    {/* Nama Lengkap */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{emp.namaLengkap}</div>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      <StatusBadge status={emp.isActive} />
                    </td>

                    {/* Device */}
                    <td className="py-3 px-4">
                      {emp.device ? (
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <Smartphone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="truncate max-w-[180px]" title={emp.device.deviceName || emp.device.status}>
                            {emp.device.deviceName || emp.device.status}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Belum Terdaftar</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Detail */}
                        <button
                          onClick={() => handleOpenDetail(emp)}
                          className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                          title="Lihat Detail Profil"
                          aria-label={`Detail ${emp.namaLengkap}`}
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Edit */}
                        <button
                          onClick={() => handleOpenEdit(emp)}
                          className="p-1.5 rounded-md text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          title="Ubah Data Karyawan"
                          aria-label={`Edit ${emp.namaLengkap}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {/* Status Toggle (Aktif / Nonaktif) */}
                        <button
                          onClick={() => setStatusConfirmTarget(emp)}
                          className={`p-1.5 rounded-md transition-colors ${
                            emp.isActive
                              ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                              : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                          }`}
                          title={emp.isActive ? 'Nonaktifkan Karyawan' : 'Aktifkan Karyawan'}
                          aria-label={`${emp.isActive ? 'Nonaktifkan' : 'Aktifkan'} ${emp.namaLengkap}`}
                        >
                          <Power className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.total}
          limit={pagination.limit}
          onPageChange={(page) => setCurrentPage(page)}
        />
      </div>

      {/* Add / Edit Modal */}
      <EmployeeModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSubmit={handleFormSubmit}
        employee={editingEmployee}
        isLoading={createMutation.isPending || editMutation.isPending}
      />

      {/* Detail Modal */}
      <EmployeeDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        employee={viewingEmployee}
        onEmployeeUpdated={(updatedEmployee) => {
          setViewingEmployee(updatedEmployee);
          void queryClient.invalidateQueries({ queryKey: ['employees'] });
        }}
      />

      {/* Status Toggle Confirmation Modal */}
      <Modal
        isOpen={!!statusConfirmTarget}
        onClose={() => setStatusConfirmTarget(null)}
        title={
          statusConfirmTarget?.isActive
            ? 'Konfirmasi Nonaktifkan Karyawan'
            : 'Konfirmasi Aktifkan Karyawan'
        }
        subtitle="Harap pastikan keputusan perubahan status pegawai kantor."
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
              onClick={handleConfirmStatusToggle}
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
              Anda akan {statusConfirmTarget?.isActive ? 'menonaktifkan' : 'mengaktifkan'}{' '}
              <strong className="text-slate-900 font-semibold">{statusConfirmTarget?.namaLengkap}</strong>{' '}
              (NIK: <span className="font-mono">{statusConfirmTarget?.nik}</span>).
            </div>
          </div>
          {statusConfirmTarget?.isActive && (
            <p className="text-slate-500 leading-normal">
              Karyawan nonaktif tidak akan dapat melakukan presensi melalui perangkat mobile. Seluruh riwayat presensi yang telah tercatat sebelumnya akan tetap tersimpan aman di database.
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
};
