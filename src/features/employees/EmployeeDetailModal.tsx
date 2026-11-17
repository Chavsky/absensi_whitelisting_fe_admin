import React, { useEffect, useState } from 'react';
import {
  Smartphone,
  Calendar,
  Copy,
  ShieldAlert,
} from 'lucide-react';
import { Employee, EmployeeDetailResponse } from '../../types/employee';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { formatJakartaDateTime } from '../../lib/dateUtils';
import { api, ApiClientError } from '../../lib/api';
import { useToast } from '../../context/ToastContext';

type DeviceAction = 'enrollment' | 'recovery' | 'session-revoke' | 'device-revoke';
type RevocationAction = 'session' | 'device';

interface EmployeeDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
  onEmployeeUpdated: (employee: Employee) => void;
}

interface IssuedCode {
  kind: 'Aktivasi' | 'Pemulihan';
  code: string;
  expiresAt: string;
}

interface SessionRevocationResponse {
  success: boolean;
  data?: { nik: string; revokedAt: string };
}

interface DeviceRevocationResponse {
  success: boolean;
  data?: { id: number; nik: string; status: string; revokedAt: string };
}

function isValidTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function apiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiClientError) {
    const responseMessage =
      typeof error.data?.message === 'string' ? error.data.message : undefined;
    return responseMessage || error.message;
  }
  return error instanceof Error ? error.message : fallback;
}

export const EmployeeDetailModal: React.FC<EmployeeDetailModalProps> = ({
  isOpen,
  onClose,
  employee,
  onEmployeeUpdated,
}) => {
  const { success, error: toastError, warning } = useToast();
  const [deviceAction, setDeviceAction] = useState<DeviceAction | null>(null);
  const [issuedCode, setIssuedCode] = useState<IssuedCode | null>(null);
  const [refreshedEmployee, setRefreshedEmployee] = useState<Employee | null>(null);
  const [sessionRevokedAt, setSessionRevokedAt] = useState<string | null>(null);
  const [confirmationAction, setConfirmationAction] = useState<RevocationAction | null>(null);

  useEffect(() => {
    setIssuedCode(null);
    setDeviceAction(null);
    setRefreshedEmployee(null);
    setSessionRevokedAt(null);
    setConfirmationAction(null);
  }, [isOpen, employee?.nik]);

  if (!employee) return null;
  const displayedEmployee =
    refreshedEmployee?.nik === employee.nik ? refreshedEmployee : employee;

  const closeModal = () => {
    setIssuedCode(null);
    setConfirmationAction(null);
    setSessionRevokedAt(null);
    setRefreshedEmployee(null);
    onClose();
  };

  const handleModalClose = () => {
    if (confirmationAction) {
      setConfirmationAction(null);
      return;
    }
    closeModal();
  };

  const applyEmployeeUpdate = (updatedEmployee: Employee) => {
    setRefreshedEmployee(updatedEmployee);
    onEmployeeUpdated(updatedEmployee);
  };

  const refreshEmployee = async () => {
    const result = await api.get<EmployeeDetailResponse>(
      `/employees/${encodeURIComponent(employee.nik)}`
    );
    if (
      result?.success !== true ||
      !result.data ||
      result.data.nik !== employee.nik
    ) {
      throw new Error('Backend tidak mengembalikan data karyawan yang dapat diverifikasi.');
    }
    applyEmployeeUpdate(result.data);
  };

  const issueDeviceCode = async (kind: 'enrollment' | 'recovery') => {
    setDeviceAction(kind);
    setIssuedCode(null);
    try {
      const suffix = kind === 'enrollment' ? 'enrollment' : 'session-recovery';
      const result = await api.post<{
        success: boolean;
        data?: { code: string; expiresAt: string };
      }>(
        `/devices/${encodeURIComponent(employee.nik)}/${suffix}`
      );
      const codePattern = kind === 'recovery' ? /^[a-f0-9]{32}$/i : /^[a-f0-9]{16}$/i;
      if (
        result?.success !== true ||
        typeof result.data?.code !== 'string' ||
        !codePattern.test(result.data.code) ||
        !isValidTimestamp(result.data.expiresAt)
      ) {
        throw new Error('Response backend tidak valid; kode tidak ditampilkan.');
      }
      setIssuedCode({ kind: kind === 'enrollment' ? 'Aktivasi' : 'Pemulihan', ...result.data });
      success('Kode Berhasil Diterbitkan', `Kode ${kind === 'enrollment' ? 'aktivasi' : 'pemulihan'} siap digunakan.`);
    } catch (err) {
      toastError('Gagal Menerbitkan Kode', apiErrorMessage(err, 'Periksa koneksi dan coba lagi.'));
    } finally {
      setDeviceAction(null);
    }
  };

  const copyIssuedCode = async () => {
    if (!issuedCode) return;
    try {
      await navigator.clipboard.writeText(issuedCode.code);
      success('Kode Disalin', 'Sampaikan kode kepada karyawan melalui kanal yang aman.');
    } catch {
      toastError('Gagal Menyalin Kode', 'Salin kode secara manual dan jangan membagikannya melalui kanal publik.');
    }
  };

  const explainAmbiguousFailure = (error: unknown, fallback: string) => {
    const baseMessage = apiErrorMessage(error, fallback);
    const statusCode = error instanceof ApiClientError ? error.statusCode : 0;
    if (statusCode > 0 && statusCode < 500) {
      return `${baseMessage} Permintaan tidak dikirim ulang otomatis.`;
    }
    return `${baseMessage} Hasil tindakan mungkin belum dapat dipastikan. Periksa status sebelum mencoba lagi; permintaan tidak dikirim ulang otomatis.`;
  };

  const handleRevokeSession = async () => {
    setDeviceAction('session-revoke');
    try {
      const result = await api.post<SessionRevocationResponse>(
        `/devices/${encodeURIComponent(employee.nik)}/session/revoke`
      );
      if (
        result?.success !== true ||
        result.data?.nik !== employee.nik ||
        !isValidTimestamp(result.data.revokedAt)
      ) {
        throw new Error('Response pencabutan sesi tidak dapat diverifikasi.');
      }
      setSessionRevokedAt(result.data.revokedAt);
      setConfirmationAction(null);
      success('Sesi Perangkat Dicabut', 'Pendaftaran perangkat tidak dicabut.');
      try {
        await refreshEmployee();
      } catch {
        warning('Sesi Berhasil Dicabut', 'Pembaruan data karyawan gagal dimuat. Respons pencabutan sudah diterima backend.');
      }
    } catch (err) {
      toastError('Gagal Mencabut Sesi', explainAmbiguousFailure(err, 'Periksa koneksi backend.'));
    } finally {
      setDeviceAction(null);
    }
  };

  const handleRevokeDevice = async () => {
    setDeviceAction('device-revoke');
    try {
      const result = await api.post<DeviceRevocationResponse>(
        `/devices/${encodeURIComponent(employee.nik)}/revoke`
      );
      if (
        result?.success !== true ||
        !Number.isSafeInteger(result.data?.id) ||
        result.data?.nik !== employee.nik ||
        result.data.status !== 'revoked' ||
        !isValidTimestamp(result.data.revokedAt)
      ) {
        throw new Error('Response pencabutan perangkat tidak dapat diverifikasi.');
      }

      const updatedEmployee: Employee = {
        ...displayedEmployee,
        device: {
          ...(displayedEmployee.device ?? {}),
          status: result.data.status,
          revokedAt: result.data.revokedAt,
        },
      };
      applyEmployeeUpdate(updatedEmployee);
      setSessionRevokedAt(null);
      setConfirmationAction(null);
      success('Perangkat Dicabut', 'Sesi aktif dan kode pemulihan perangkat juga dinonaktifkan.');
      try {
        await refreshEmployee();
      } catch {
        warning('Perangkat Berhasil Dicabut', 'Pembaruan detail gagal dimuat. Status perangkat memakai respons pencabutan backend.');
      }
    } catch (err) {
      toastError('Gagal Mencabut Perangkat', explainAmbiguousFailure(err, 'Periksa koneksi backend.'));
    } finally {
      setDeviceAction(null);
    }
  };

  const confirmRevocation = confirmationAction === 'session'
    ? handleRevokeSession
    : handleRevokeDevice;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleModalClose}
      title="Rincian Profil Karyawan"
      subtitle={`Informasi master data dan status perangkat terverifikasi untuk NIK ${employee.nik}`}
      maxWidth="md"
      footer={
        <Button
          variant="outline"
          onClick={closeModal}
        >
          Tutup
        </Button>
      }
    >
      <div className="space-y-5">
        {/* Profile Card Header */}
        <div className="flex items-center gap-3.5 p-4 bg-slate-50 border border-slate-200/80 rounded-xl">
          <div className="w-12 h-12 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center font-bold text-slate-700 text-sm">
            {displayedEmployee.namaLengkap.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-slate-900 truncate">
              {displayedEmployee.namaLengkap}
            </div>
            <div className="text-xs font-mono text-slate-500">
              NIK: {displayedEmployee.nik}
            </div>
          </div>
          <StatusBadge status={displayedEmployee.isActive} />
        </div>

        <div className="p-3 bg-white border border-slate-200/80 rounded-lg text-xs">
          <div className="flex items-center gap-1.5 text-slate-400 font-semibold uppercase tracking-wider text-[10px] mb-1">
            <Calendar className="w-3.5 h-3.5" />
            <span>Tanggal Pendaftaran</span>
          </div>
          <div className="font-medium text-slate-800">
            {formatJakartaDateTime(displayedEmployee.createdAt)}
          </div>
        </div>

        {/* Device Registration Details */}
        <div className="p-4 border border-slate-200/80 rounded-xl bg-white space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-900 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-slate-600" />
              <span>Status Perangkat</span>
            </div>
            {displayedEmployee.device ? (
              <span className="text-[11px] font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                {displayedEmployee.device.status}
              </span>
            ) : (
              <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                Belum Terdaftar
              </span>
            )}
          </div>

          {displayedEmployee.device ? (
            <div className="text-xs space-y-1.5 pt-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Status Perangkat:</span>
                <span className="font-medium text-slate-800">{displayedEmployee.device.status}</span>
              </div>
              {displayedEmployee.device.deviceName && <div className="flex justify-between"><span className="text-slate-500">Nama Perangkat:</span><span className="text-slate-700">{displayedEmployee.device.deviceName}</span></div>}
              {displayedEmployee.device.activatedAt && <div className="flex justify-between"><span className="text-slate-500">Aktivasi:</span><span className="text-slate-700">{formatJakartaDateTime(displayedEmployee.device.activatedAt)}</span></div>}
              {displayedEmployee.device.lastUsedAt && <div className="flex justify-between"><span className="text-slate-500">Terakhir Digunakan:</span><span className="text-slate-700">{formatJakartaDateTime(displayedEmployee.device.lastUsedAt)}</span></div>}
              {displayedEmployee.device.revokedAt && <div className="flex justify-between"><span className="text-slate-500">Dicabut:</span><span className="text-slate-700">{formatJakartaDateTime(displayedEmployee.device.revokedAt)}</span></div>}
            </div>
          ) : (
            <p className="text-xs text-slate-500 pt-1 leading-relaxed">
              Karyawan ini belum mengaitkan perangkat mobile resmi untuk presensi kantor. Pendaftaran perangkat akan diverifikasi melalui sistem login PWA karyawan.
            </p>
          )}
        </div>

        <div className="p-4 border border-slate-200/80 rounded-xl bg-white space-y-2 text-xs">
          <div className="font-semibold text-slate-900">Status Sesi Perangkat</div>
          {sessionRevokedAt ? (
            <p className="text-slate-600">
              Sesi dicabut pada {formatJakartaDateTime(sessionRevokedAt)}. Status ini berasal dari respons aksi saat ini; backend belum menyertakan riwayat sesi pada detail karyawan.
            </p>
          ) : (
            <p className="text-slate-500">
              Status sesi belum tersedia pada endpoint detail karyawan.
            </p>
          )}
        </div>

        <div className="p-4 border border-slate-200/80 rounded-xl bg-slate-50/70 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-900">
              Operasi Manajemen Perangkat
            </div>
            <span className="text-[10px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              ADMIN DEVICE ACTIONS
            </span>
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            Kode aktivasi dan pemulihan berlaku 10 menit. Kode pemulihan hanya tersedia untuk perangkat aktif; penerbitan kode baru membatalkan kode sebelumnya. Kode bersifat rahasia, sampaikan kepada karyawan melalui kanal yang aman.
          </p>
          {issuedCode && (
            <div className="p-3 rounded-lg bg-white border border-amber-200 text-xs">
              <div className="flex items-center gap-2 text-amber-800 font-semibold">
                <ShieldAlert className="w-4 h-4" />
                <span>Kode {issuedCode.kind} — rahasia</span>
              </div>
              <code className="block text-lg font-mono font-bold tracking-wider text-indigo-700 mt-2">{issuedCode.code}</code>
              <div className="text-slate-500 mt-1">Berlaku sampai {formatJakartaDateTime(issuedCode.expiresAt)}</div>
              <Button type="button" variant="outline" size="sm" className="mt-3" icon={<Copy className="w-3.5 h-3.5" />} onClick={() => void copyIssuedCode()}>
                Salin Kode
              </Button>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" isLoading={deviceAction === 'enrollment'} disabled={!!deviceAction || displayedEmployee.device?.status === 'active'} onClick={() => void issueDeviceCode('enrollment')}>Terbitkan Kode Aktivasi</Button>
            <Button type="button" variant="outline" size="sm" isLoading={deviceAction === 'recovery'} disabled={!!deviceAction || displayedEmployee.device?.status !== 'active'} onClick={() => void issueDeviceCode('recovery')}>Terbitkan Kode Pemulihan</Button>
          </div>
        </div>

        <div className="p-4 border border-slate-200/80 rounded-xl bg-white space-y-3">
          <div className="text-xs font-semibold text-slate-900">Pencabutan Akses</div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Pencabutan sesi mengakhiri sesi perangkat tanpa mencabut pendaftaran perangkat. Pencabutan perangkat menonaktifkan perangkat, semua sesi aktif, dan kode pemulihan yang belum digunakan.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!!deviceAction || displayedEmployee.device?.status !== 'active'}
              onClick={() => setConfirmationAction('session')}
            >
              Cabut Sesi
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={!!deviceAction || !displayedEmployee.device || displayedEmployee.device.status === 'revoked'}
              onClick={() => setConfirmationAction('device')}
            >
              Cabut Perangkat
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
          Riwayat aktivitas keamanan belum ditampilkan karena backend belum menyediakan endpoint baca <code>security_audit_logs</code>.
        </div>
      </div>

      <Modal
        isOpen={confirmationAction !== null}
        onClose={() => setConfirmationAction(null)}
        title={confirmationAction === 'session' ? 'Konfirmasi Pencabutan Sesi' : 'Konfirmasi Pencabutan Perangkat'}
        subtitle={`Karyawan ${displayedEmployee.namaLengkap} (NIK ${displayedEmployee.nik})`}
        maxWidth="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setConfirmationAction(null)}
              disabled={!!deviceAction}
            >
              Batal
            </Button>
            <Button
              variant="danger"
              onClick={() => void confirmRevocation()}
              isLoading={deviceAction === 'session-revoke' || deviceAction === 'device-revoke'}
              disabled={!confirmationAction || !!deviceAction}
            >
              {confirmationAction === 'session' ? 'Ya, Cabut Sesi' : 'Ya, Cabut Perangkat'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 leading-relaxed">
          {confirmationAction === 'session'
            ? 'Semua sesi aktif pada perangkat karyawan akan dicabut. Pendaftaran perangkat tetap aktif dan tidak ikut dicabut.'
            : 'Perangkat karyawan akan dicabut. Perangkat tidak dapat digunakan untuk mengakses sistem, seluruh sesi aktif akan dicabut, dan kode pemulihan yang belum digunakan akan dibatalkan.'}
        </p>
      </Modal>
    </Modal>
  );
};
