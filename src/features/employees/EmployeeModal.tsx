import React, { useState, useEffect } from 'react';
import { Employee } from '../../types/employee';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

interface EmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<Employee>) => Promise<void>;
  employee?: Employee | null;
  isLoading?: boolean;
}

export const EmployeeModal: React.FC<EmployeeModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  employee,
  isLoading = false,
}) => {
  const isEditing = !!employee;

  const [nik, setNik] = useState('');
  const [namaLengkap, setNamaLengkap] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (employee) {
      setNik(employee.nik);
      setNamaLengkap(employee.namaLengkap);
    } else {
      setNik('');
      setNamaLengkap('');
    }
    setError(null);
  }, [employee, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanNik = nik.trim();
    const cleanNama = namaLengkap.trim();

    if (!isEditing && !cleanNik) {
      setError('NIK wajib diisi.');
      return;
    }

    if (!cleanNama) {
      setError('Nama lengkap wajib diisi.');
      return;
    }

    try {
      if (isEditing) {
        // Backend contract: PATCH /api/employees/:nik with { namaLengkap }
        await onSubmit({
          namaLengkap: cleanNama,
        });
      } else {
        // Backend creates new employees as active and rejects additional fields.
        await onSubmit({
          nik: cleanNik,
          namaLengkap: cleanNama,
        });
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan data karyawan.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Ubah Data Karyawan' : 'Tambah Karyawan Baru'}
      subtitle={
        isEditing
          ? 'Perbarui rincian nama karyawan. NIK bersifat permanen dan tidak dapat diubah.'
          : 'Daftarkan karyawan baru ke dalam sistem absensi on-premise kantor.'
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            Batal
          </Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={isLoading}>
            {isEditing ? 'Simpan Perubahan' : 'Tambahkan Karyawan'}
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
          label="Nomor Induk Karyawan (NIK)"
          placeholder="Contoh: 202401011"
          value={nik}
          onChange={(e) => setNik(e.target.value)}
          disabled={isEditing || isLoading}
          helperText={
            isEditing
              ? 'NIK tidak dapat diubah demi menjaga integritas data riwayat absensi.'
              : 'Gunakan nomor identitas unik karyawan.'
          }
          required
        />

        <Input
          label="Nama Lengkap Karyawan"
          placeholder="Contoh: Muhammad Rizki"
          value={namaLengkap}
          onChange={(e) => setNamaLengkap(e.target.value)}
          disabled={isLoading}
          helperText="Sesuai kartu identitas atau data kepegawaian resmi kantor."
          required
        />

        {!isEditing && <p className="text-xs text-slate-500">Karyawan baru dibuat dengan status aktif.</p>}
      </form>
    </Modal>
  );
};
