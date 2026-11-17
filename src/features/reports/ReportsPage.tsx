import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileDown, Search } from 'lucide-react';
import { ApiClientError, api } from '../../lib/api';
import {
  AttendanceSession,
  AttendanceSummaryResponse,
  DailyReportResponse,
  EmployeeAttendanceHistoryResponse,
  PeriodReportResponse,
} from '../../types/report';
import { EmployeeListResponse } from '../../types/employee';
import { StatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Pagination } from '../../components/ui/Pagination';
import { LoadingState } from '../../components/ui/LoadingState';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../context/ToastContext';
import { getJakartaDate, getPastJakartaDate } from '../../lib/dateUtils';

type ReportTab = 'daily' | 'period' | 'summary' | 'employee';
type CorrectionStatus = 'Hadir' | 'Tidak Hadir';

interface AttendanceSessionListResponse {
  success: boolean;
  data: Array<{
    key: string;
    versions: Array<{ name: string; effectiveFrom: string }>;
  }>;
}

interface AttendanceCorrectionLog {
  id: number;
  nik: string;
  attendanceDate: string;
  revision: number;
  previousStatus: CorrectionStatus;
  newStatus: CorrectionStatus;
  reason: string;
  correctedByAdminId: number;
  correctedByAdminUsername: string;
  correctedAt: string;
}

interface CorrectionHistoryResponse {
  success: boolean;
  data: AttendanceCorrectionLog[];
}

interface CorrectionMutationResponse {
  success: boolean;
  data?: AttendanceCorrectionLog;
}

const allSessionsOption = { value: 'ALL', label: 'Semua Sesi' };

function sessionLabel(session: AttendanceSession, name?: string): string {
  return name || session;
}

function formatBusinessTime(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString('id-ID', {
    timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
}

function formatCorrectionDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
}

function correctionErrorMessage(error: unknown): string {
  if (!(error instanceof ApiClientError)) {
    return error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui.';
  }
  const message = typeof error.data?.message === 'string' ? error.data.message : '';
  if (error.statusCode === 400) {
    const known: Record<string, string> = {
      CORRECTION_REASON_INVALID: 'Alasan wajib diisi dan maksimal 500 karakter.',
      CORRECTION_DATE_IN_FUTURE: 'Presensi pada tanggal mendatang tidak dapat dikoreksi.',
      CORRECTION_SESSION_NOT_FINISHED: 'Sesi belum selesai menurut jadwal Asia/Jakarta.',
      CORRECTION_SCHEDULE_NOT_FOUND: 'Tidak ada sesi aktif terjadwal untuk tanggal tersebut.',
      CORRECTION_EMPLOYEE_OUTSIDE_DATE: 'Karyawan belum terdaftar pada tanggal presensi tersebut.',
      CORRECTION_EMPLOYEE_NOT_FOUND: 'Karyawan tidak ditemukan.',
      SESSION_NOT_FOUND: 'Sesi absensi tidak ditemukan.',
      SESSION_KEY_INVALID: 'Identitas sesi tidak valid.',
    };
    return known[message] || message || 'Data koreksi tidak valid.';
  }
  if (error.statusCode === 401) return 'Sesi Admin tidak valid atau telah berakhir. Silakan login kembali.';
  if (error.statusCode === 403) return 'Anda tidak memiliki izin untuk mengoreksi presensi.';
  if (error.statusCode === 404) return message || 'Karyawan atau sesi tidak ditemukan.';
  if (error.statusCode === 409) return message || 'Koreksi bertentangan dengan data saat ini.';
  if (error.statusCode >= 500) return 'Backend gagal menyimpan koreksi. Periksa status sebelum mencoba lagi.';
  return message || error.message;
}

export const ReportsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();
  const today = getJakartaDate();
  const [tab, setTab] = useState<ReportTab>('daily');
  const [dailyDate, setDailyDate] = useState(today);
  const [startDate, setStartDate] = useState(getPastJakartaDate(6));
  const [endDate, setEndDate] = useState(today);
  const [search, setSearch] = useState('');
  const [session, setSession] = useState('ALL');
  const [nik, setNik] = useState('');
  const [page, setPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const [correctionTarget, setCorrectionTarget] = useState<DailyReportResponse['data'][number] | null>(null);
  const [correctionStatus, setCorrectionStatus] = useState<CorrectionStatus>('Hadir');
  const [correctionReason, setCorrectionReason] = useState('');
  const [confirmCorrection, setConfirmCorrection] = useState(false);
  const limit = 8;
  const sessionParam = session === 'ALL' ? undefined : session;

  const sessionsQuery = useQuery<AttendanceSessionListResponse>({
    queryKey: ['attendanceSessions'],
    queryFn: () => api.get('/admins/attendance-sessions'),
  });
  const dynamicSessionOptions = sessionsQuery.data?.success
    ? sessionsQuery.data.data.map((item) => {
      const currentVersion = [...item.versions]
        .sort((first, second) => second.effectiveFrom.localeCompare(first.effectiveFrom))[0];
      return {
        value: item.key,
        label: currentVersion?.name || item.key,
      };
    })
    : [];
  const sessionOptions = [
    allSessionsOption,
    ...dynamicSessionOptions.filter((option, index, options) =>
      options.findIndex((candidate) => candidate.value === option.value) === index
    ),
  ];

  const employeesQuery = useQuery<EmployeeListResponse>({
    queryKey: ['employeeDropdownList'],
    queryFn: () => api.get('/employees', { page: 1, limit: 100 }),
    enabled: tab === 'employee',
  });

  const dailyQuery = useQuery<DailyReportResponse>({
    queryKey: ['dailyReport', { date: dailyDate, page, search, session: sessionParam }],
    queryFn: () => api.get('/reports/attendance/daily', {
      date: dailyDate, page, limit, search, sesi: sessionParam,
    }),
    enabled: tab === 'daily',
  });

  const periodQuery = useQuery<PeriodReportResponse>({
    queryKey: ['periodReport', { startDate, endDate, page, search, session: sessionParam }],
    queryFn: () => api.get('/reports/attendance/period', {
      startDate, endDate, page, limit, search, sesi: sessionParam,
    }),
    enabled: tab === 'period',
  });

  // Summary is per employee and returns a dynamic sessions array from the backend.
  const summaryQuery = useQuery<AttendanceSummaryResponse>({
    queryKey: ['summaryReport', { startDate, endDate, page, search }],
    queryFn: () => api.get('/reports/attendance/summary', { startDate, endDate, page, limit, search }),
    enabled: tab === 'summary',
  });
  const summarySessionKeys = Array.from(new Set(
    (summaryQuery.data?.data ?? []).flatMap((row) => row.sessions.map((session) => session.key)),
  )).sort();

  const historyQuery = useQuery<EmployeeAttendanceHistoryResponse>({
    queryKey: ['employeeHistory', { nik, startDate, endDate, page }],
    queryFn: () => api.get(`/reports/attendance/employee/${encodeURIComponent(nik)}`, {
      startDate, endDate, page, limit,
    }),
    enabled: tab === 'employee' && Boolean(nik),
  });

  const correctionHistoryQuery = useQuery<CorrectionHistoryResponse>({
    queryKey: [
      'attendanceCorrections',
      correctionTarget?.nik,
      correctionTarget?.tanggal,
      correctionTarget?.sessionKey || correctionTarget?.sesi,
    ],
    queryFn: async () => {
      if (!correctionTarget) throw new Error('Pilih baris presensi untuk melihat riwayat koreksi.');
      const response = await api.get<CorrectionHistoryResponse>(
        `/admins/attendance-sessions/${encodeURIComponent(correctionTarget.sessionKey || correctionTarget.sesi)}/corrections`,
        { nik: correctionTarget.nik, date: correctionTarget.tanggal },
      );
      if (response?.success !== true || !Array.isArray(response.data)) {
        throw new Error('Backend tidak mengembalikan riwayat koreksi yang valid.');
      }
      return response;
    },
    enabled: Boolean(correctionTarget),
  });

  const correctionMutation = useMutation({
    retry: false,
    mutationFn: async () => {
      if (!correctionTarget) throw new Error('Baris presensi tidak dipilih.');
      const reason = correctionReason.trim();
      if (!reason || reason.length > 500) {
        throw new Error('Alasan wajib diisi dan maksimal 500 karakter.');
      }
      const response = await api.post<CorrectionMutationResponse>(
        `/admins/attendance-sessions/${encodeURIComponent(correctionTarget.sessionKey || correctionTarget.sesi)}/corrections`,
        {
          nik: correctionTarget.nik,
          date: correctionTarget.tanggal,
          status: correctionStatus,
          reason,
        },
      );
      const result = response?.data;
      if (
        response?.success !== true ||
        !result ||
        result.nik !== correctionTarget.nik ||
        result.newStatus !== correctionStatus ||
        result.reason !== reason ||
        !Number.isSafeInteger(result.correctedByAdminId) ||
        typeof result.correctedByAdminUsername !== 'string' ||
        !Number.isSafeInteger(result.revision) ||
        !Number.isFinite(Date.parse(result.correctedAt))
      ) {
        throw new Error('Response backend tidak mengonfirmasi penyimpanan koreksi.');
      }
      return result;
    },
    onSuccess: async (result) => {
      success(
        'Koreksi Presensi Tersimpan',
        `Status ${result.previousStatus} → ${result.newStatus}; revisi #${result.revision} tercatat oleh ${result.correctedByAdminUsername}.`,
      );
      setConfirmCorrection(false);
      setCorrectionTarget(null);
      setCorrectionReason('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['dailyReport'] }),
        queryClient.invalidateQueries({ queryKey: ['periodReport'] }),
        queryClient.invalidateQueries({ queryKey: ['summaryReport'] }),
        queryClient.invalidateQueries({ queryKey: ['employeeHistory'] }),
        queryClient.invalidateQueries({ queryKey: ['attendanceCorrections'] }),
      ]);
    },
    onError: (error: unknown) => toastError('Gagal Mengoreksi Presensi', correctionErrorMessage(error)),
  });

  const resetPage = () => setPage(1);
  const changeTab = (next: ReportTab) => { setTab(next); resetPage(); };

  const openCorrection = (row: DailyReportResponse['data'][number]) => {
    if (row.statusAbsensi !== 'Hadir' && row.statusAbsensi !== 'Tidak Hadir') return;
    setCorrectionTarget(row);
    setCorrectionStatus(row.statusAbsensi === 'Hadir' ? 'Tidak Hadir' : 'Hadir');
    setCorrectionReason('');
    setConfirmCorrection(false);
  };

  const exportCsv = async () => {
    setIsExporting(true);
    try {
      const params: Record<string, string | number | undefined> = {};
      let filename: string;
      if (tab === 'daily') {
        params.startDate = dailyDate;
        params.endDate = dailyDate;
        params.search = search || undefined;
        params.sesi = sessionParam;
        filename = `laporan-absensi-harian-${dailyDate}.csv`;
      } else {
        params.startDate = startDate;
        params.endDate = endDate;
        params.search = tab === 'employee' ? nik || undefined : search || undefined;
        params.sesi = tab === 'period' ? sessionParam : undefined;
        filename = `laporan-absensi-${startDate}-sd-${endDate}.csv`;
      }
      await api.downloadFile('/reports/attendance/export', params, filename);
      success('Ekspor Selesai', 'File CSV berhasil diunduh.');
    } catch (err) {
      toastError('Gagal Ekspor CSV', err instanceof Error ? err.message : 'Gagal mengunduh CSV.');
    } finally {
      setIsExporting(false);
    }
  };

  const tabs: { key: ReportTab; label: string }[] = [
    { key: 'daily', label: 'Harian' }, { key: 'period', label: 'Periode' },
    { key: 'summary', label: 'Ringkasan' }, { key: 'employee', label: 'Riwayat Pegawai' },
  ];

  const errorPanel = (retry: () => unknown) => <div className="p-8 text-center">
    <p className="text-sm text-rose-600 mb-3">Data laporan tidak dapat dimuat dari backend.</p>
    <Button variant="outline" size="sm" onClick={() => void retry()}>Coba Lagi</Button>
  </div>;

  return <div className="space-y-6">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Laporan Rekapitulasi Presensi</h1>
        <p className="text-xs text-slate-500 mt-1">Catatan per sesi, ringkasan per karyawan, riwayat, dan ekspor CSV.</p>
      </div>
      <Button onClick={exportCsv} variant="outline" isLoading={isExporting} disabled={isExporting} icon={<FileDown className="w-4 h-4 text-emerald-600" />}>Ekspor CSV</Button>
    </div>

    <div className="flex items-center gap-1.5 p-1 bg-white border border-slate-200/80 rounded-xl max-w-xl">
      {tabs.map((item) => <button key={item.key} onClick={() => changeTab(item.key)} className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${tab === item.key ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}>{item.label}</button>)}
    </div>

    <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-wrap items-end gap-3">
      {tab === 'daily' ? <>
        <div className="w-full sm:w-48"><Input label="Tanggal (WIB)" type="date" value={dailyDate} onChange={(e) => { setDailyDate(e.target.value); resetPage(); }} /></div>
        <div className="w-full sm:flex-1"><Input label="Pencarian Pegawai" placeholder="Cari NIK atau nama..." value={search} onChange={(e) => { setSearch(e.target.value); resetPage(); }} startIcon={<Search className="w-4 h-4" />} /></div>
        <div className="w-full sm:w-48"><Select label="Filter Sesi" value={session} onChange={(e) => { setSession(e.target.value); resetPage(); }} options={sessionOptions} /></div>
      </> : <>
        {tab === 'employee' && <>
          <div className="w-full sm:w-60"><Input label="Cari Pegawai (NIK)" placeholder="Masukkan NIK" value={nik} onChange={(e) => { setNik(e.target.value.trim()); resetPage(); }} /></div>
          {employeesQuery.data?.data?.length ? <div className="w-full sm:w-72"><Select label="Pilih dari Daftar" value={nik} onChange={(e) => { setNik(e.target.value); resetPage(); }} options={[{ value: '', label: '-- Pilih Pegawai --' }, ...employeesQuery.data.data.map((employee) => ({ value: employee.nik, label: `${employee.nik} - ${employee.namaLengkap}` }))]} /></div> : null}
        </>}
        <div className="w-full sm:w-40"><Input label="Mulai Tanggal" type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); resetPage(); }} /></div>
        <div className="w-full sm:w-40"><Input label="Sampai Tanggal" type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); resetPage(); }} /></div>
        {tab !== 'employee' && <div className="w-full sm:flex-1"><Input label="Pencarian Pegawai" placeholder="Cari NIK atau nama..." value={search} onChange={(e) => { setSearch(e.target.value); resetPage(); }} startIcon={<Search className="w-4 h-4" />} /></div>}
        {tab === 'period' && <div className="w-full sm:w-48"><Select label="Filter Sesi" value={session} onChange={(e) => { setSession(e.target.value); resetPage(); }} options={sessionOptions} /></div>}
      </>}
    </div>
    {tab === 'daily' && sessionsQuery.isError && <p className="text-xs text-amber-700">Daftar sesi dinamis gagal dimuat; filter sesi hanya menampilkan pilihan baku. {correctionErrorMessage(sessionsQuery.error)}</p>}
    {tab === 'employee' && employeesQuery.isError && <p className="text-xs text-rose-600">Daftar pegawai gagal dimuat. Anda tetap dapat memasukkan NIK secara langsung.</p>}
    {tab === 'employee' && employeesQuery.isLoading && <p className="text-xs text-slate-500">Memuat daftar pegawai…</p>}

    {tab === 'daily' && <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
      {dailyQuery.isLoading ? <LoadingState message="Mengambil laporan harian..." className="h-64" /> : dailyQuery.isError ? errorPanel(dailyQuery.refetch) : !dailyQuery.data?.data.length ? <EmptyState title="Tidak Ada Data Pegawai" description="Tidak ditemukan pegawai untuk filter ini." /> : <>
        <p className="px-4 py-3 text-[11px] text-slate-500 border-b border-slate-100">Tanpa filter sesi, backend mengembalikan satu baris untuk setiap sesi aktif pada tanggal tersebut. “Belum Absen” adalah status tampilan, bukan record tersimpan.</p>
        <div className="overflow-x-auto"><table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase"><tr><th className="py-3 px-4">Pegawai</th><th className="py-3 px-4">Tanggal</th><th className="py-3 px-4">Sesi</th><th className="py-3 px-4">Waktu</th><th className="py-3 px-4">Status Karyawan</th><th className="py-3 px-4 text-right">Status Presensi</th><th className="py-3 px-4 text-right">Koreksi</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{dailyQuery.data.data.map((row) => <tr key={`${row.nik}:${row.tanggal}:${row.sessionKey || row.sesi}`}><td className="py-3 px-4"><div className="font-semibold">{row.namaLengkap}</div><div className="font-mono text-slate-500">{row.nik}</div></td><td className="py-3 px-4 font-mono">{row.tanggal}</td><td className="py-3 px-4">{sessionLabel(row.sessionKey || row.sesi, row.sessionName)}</td><td className="py-3 px-4 font-mono">{formatBusinessTime(row.waktuAbsen)}</td><td className="py-3 px-4">{row.statusKaryawan}</td><td className="py-3 px-4 text-right"><StatusBadge status={row.statusAbsensi} /></td><td className="py-3 px-4 text-right">{row.statusAbsensi === 'Hadir' || row.statusAbsensi === 'Tidak Hadir' ? <Button type="button" variant="outline" size="sm" onClick={() => openCorrection(row)}>{row.correctionId ? 'Koreksi / Riwayat' : 'Koreksi'}</Button> : <span className="text-[11px] text-slate-400">Belum final</span>}</td></tr>)}</tbody>
        </table></div>
        <Pagination currentPage={dailyQuery.data.pagination.page} totalPages={dailyQuery.data.pagination.totalPages} totalItems={dailyQuery.data.pagination.total} limit={dailyQuery.data.pagination.limit} onPageChange={setPage} />
      </>}
    </div>}

    {tab === 'period' && <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
      {periodQuery.isLoading ? <LoadingState message="Mengambil laporan periode..." className="h-64" /> : periodQuery.isError ? errorPanel(periodQuery.refetch) : !periodQuery.data?.data.length ? <EmptyState title="Tidak Ada Record" description="Tidak ada catatan presensi pada rentang tanggal ini." /> : <>
        <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase"><tr><th className="py-3 px-4">Tanggal</th><th className="py-3 px-4">Pegawai</th><th className="py-3 px-4">Sesi</th><th className="py-3 px-4">Waktu</th><th className="py-3 px-4">Status Karyawan</th><th className="py-3 px-4 text-right">Status Presensi</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{periodQuery.data.data.map((row) => <tr key={row.id}><td className="py-3 px-4 font-mono">{row.tanggal}</td><td className="py-3 px-4"><div className="font-semibold">{row.namaLengkap}</div><div className="font-mono text-slate-500">{row.nik}</div></td><td className="py-3 px-4">{sessionLabel(row.sessionKey || row.sesi, row.sessionName)}</td><td className="py-3 px-4 font-mono">{formatBusinessTime(row.waktuAbsen)}</td><td className="py-3 px-4">{row.statusKaryawan}</td><td className="py-3 px-4 text-right"><StatusBadge status={row.statusAbsensi} /></td></tr>)}</tbody>
        </table></div><Pagination currentPage={periodQuery.data.pagination.page} totalPages={periodQuery.data.pagination.totalPages} totalItems={periodQuery.data.pagination.total} limit={periodQuery.data.pagination.limit} onPageChange={setPage} />
      </>}
    </div>}

    {tab === 'summary' && <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
      {summaryQuery.isLoading ? <LoadingState message="Menghitung ringkasan karyawan..." className="h-64" /> : summaryQuery.isError ? errorPanel(summaryQuery.refetch) : !summaryQuery.data?.data.length ? <EmptyState title="Tidak Ada Ringkasan" description="Tidak ditemukan karyawan pada filter ini." /> : <>
        <div className="p-4 border-b border-slate-100 text-[11px] text-slate-500">Ringkasan jumlah record per karyawan untuk setiap sesi yang dikembalikan backend. Nilai ditampilkan sebagai Hadir / Tidak Hadir. Kolom sesi mengikuti jumlah sesi aktual, bukan batas tetap.</div>
        <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase"><tr><th className="py-3 px-4">Pegawai</th><th className="py-3 px-4">Status</th><th className="py-3 px-4">Total Record</th>{summarySessionKeys.map((key) => <th key={key} className="py-3 px-4 whitespace-nowrap"><span className="block max-w-32 truncate" title={key}>{key}</span><span className="block text-[10px] font-normal normal-case text-slate-400">Hadir / Tidak Hadir</span></th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">{summaryQuery.data.data.map((row) => <tr key={row.nik}><td className="py-3 px-4"><div className="font-semibold">{row.namaLengkap}</div><div className="font-mono text-slate-500">{row.nik}</div></td><td className="py-3 px-4">{row.statusKaryawan}</td><td className="py-3 px-4">{row.totalRecordAbsensi}</td>{summarySessionKeys.map((key) => { const session = row.sessions.find((item) => item.key === key); return <td key={key} className="py-3 px-4 whitespace-nowrap">{session ? `${session.jumlahHadir} / ${session.jumlahTidakHadir}` : '0 / 0'}</td>; })}</tr>)}</tbody>
        </table></div><Pagination currentPage={summaryQuery.data.pagination.page} totalPages={summaryQuery.data.pagination.totalPages} totalItems={summaryQuery.data.pagination.total} limit={summaryQuery.data.pagination.limit} onPageChange={setPage} />
      </>}
    </div>}

    {tab === 'employee' && <div className="space-y-4">
      {!nik ? <EmptyState title="Cari Pegawai" description="Masukkan atau pilih NIK untuk melihat riwayat presensi per sesi." /> : historyQuery.isLoading ? <LoadingState message="Mengambil riwayat presensi..." className="h-64" /> : historyQuery.isError ? errorPanel(historyQuery.refetch) : !historyQuery.data ? <EmptyState title="Pegawai Tidak Ditemukan" description="Periksa NIK dan coba lagi." /> : <>
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 flex items-center justify-between"><div><div className="font-semibold">{historyQuery.data.employee.namaLengkap}</div><div className="font-mono text-xs text-slate-500">NIK: {historyQuery.data.employee.nik}</div></div><div className="text-xs text-slate-500">{historyQuery.data.employee.statusKaryawan}</div></div>
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
          {historyQuery.data.data.length === 0 ? <EmptyState title="Belum Ada Record Presensi" description="Tidak ada sesi tercatat pada periode yang dipilih." /> : <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase"><tr><th className="py-3 px-4">Tanggal</th><th className="py-3 px-4">Sesi</th><th className="py-3 px-4">Waktu Absensi</th><th className="py-3 px-4 text-right">Status</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{historyQuery.data.data.map((row) => <tr key={row.id}><td className="py-3 px-4 font-mono">{row.tanggal}</td><td className="py-3 px-4">{sessionLabel(row.sessionKey || row.sesi, row.sessionName)}</td><td className="py-3 px-4 font-mono">{new Date(row.waktuAbsen).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</td><td className="py-3 px-4 text-right"><StatusBadge status={row.status} /></td></tr>)}</tbody>
          </table></div>}
          {historyQuery.data.pagination.totalPages > 1 && <Pagination currentPage={historyQuery.data.pagination.page} totalPages={historyQuery.data.pagination.totalPages} totalItems={historyQuery.data.pagination.total} limit={historyQuery.data.pagination.limit} onPageChange={setPage} />}
        </div>
      </>}
    </div>}

    <Modal
      isOpen={correctionTarget !== null}
      onClose={() => {
        if (correctionMutation.isPending) return;
        setCorrectionTarget(null);
        setCorrectionReason('');
        setConfirmCorrection(false);
      }}
      title={confirmCorrection ? 'Konfirmasi Koreksi Presensi' : 'Koreksi Presensi'}
      subtitle={correctionTarget
        ? `${correctionTarget.namaLengkap} · NIK ${correctionTarget.nik} · ${sessionLabel(correctionTarget.sessionKey || correctionTarget.sesi, correctionTarget.sessionName)} · ${correctionTarget.tanggal}`
        : undefined}
      maxWidth="lg"
      footer={
        <>
          <Button
            type="button"
            variant="ghost"
            onClick={() => confirmCorrection ? setConfirmCorrection(false) : setCorrectionTarget(null)}
            disabled={correctionMutation.isPending}
          >
            {confirmCorrection ? 'Kembali' : 'Tutup'}
          </Button>
          {confirmCorrection ? (
            <Button
              type="button"
              variant="primary"
              isLoading={correctionMutation.isPending}
              disabled={correctionMutation.isPending}
              onClick={() => correctionMutation.mutate()}
            >
              Konfirmasi & Simpan
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => setConfirmCorrection(true)}
              disabled={
                !correctionReason.trim() ||
                correctionReason.trim().length > 500 ||
                correctionStatus === correctionTarget?.statusAbsensi ||
                correctionHistoryQuery.isLoading
              }
            >
              Tinjau Koreksi
            </Button>
          )}
        </>
      }
    >
      {correctionTarget && (
        <div className="space-y-5">
          <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Status saat ini</div>
              <div className="mt-1"><StatusBadge status={correctionTarget.statusAbsensi} /></div>
            </div>
            <div>
              <label htmlFor="correction-status" className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Status setelah koreksi
              </label>
              <select
                id="correction-status"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                value={correctionStatus}
                disabled={confirmCorrection || correctionMutation.isPending}
                onChange={(event) => setCorrectionStatus(event.target.value as CorrectionStatus)}
              >
                <option value="Hadir">Hadir</option>
                <option value="Tidak Hadir">Tidak Hadir</option>
              </select>
            </div>
          </div>

          {!confirmCorrection && (
            <div>
              <label htmlFor="correction-reason" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Alasan koreksi <span className="text-rose-600">*</span>
              </label>
              <textarea
                id="correction-reason"
                className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:bg-slate-50"
                value={correctionReason}
                maxLength={500}
                disabled={correctionMutation.isPending}
                placeholder="Jelaskan alasan perubahan status (maks. 500 karakter)"
                onChange={(event) => setCorrectionReason(event.target.value)}
              />
              <div className="mt-1 flex justify-between text-[11px]">
                {!correctionReason.trim()
                  ? <span className="text-rose-600">Alasan wajib diisi.</span>
                  : <span className="text-slate-500">Alasan akan tersimpan permanen dalam log koreksi.</span>}
                <span className="text-slate-400">{correctionReason.length}/500</span>
              </div>
            </div>
          )}

          {confirmCorrection && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-950">
              Simpan koreksi <strong>{correctionTarget.statusAbsensi}</strong> menjadi <strong>{correctionStatus}</strong>?
              Identitas admin diambil backend dari sesi login. Perubahan dan log audit disimpan dalam satu transaksi;
              koreksi sebelumnya tidak dihapus.
              <div className="mt-2 text-amber-800">Alasan: {correctionReason.trim()}</div>
            </div>
          )}

          <section className="border-t border-slate-100 pt-4">
            <h3 className="mb-2 text-xs font-semibold text-slate-800">Riwayat Koreksi Permanen</h3>
            {correctionHistoryQuery.isLoading ? (
              <LoadingState message="Memuat riwayat koreksi..." className="py-6" />
            ) : correctionHistoryQuery.isError ? (
              <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                Riwayat koreksi gagal dimuat: {correctionErrorMessage(correctionHistoryQuery.error)}
                <Button type="button" variant="outline" size="sm" className="ml-2" onClick={() => void correctionHistoryQuery.refetch()}>
                  Coba lagi
                </Button>
              </div>
            ) : correctionHistoryQuery.data?.data.length ? (
              <ol className="max-h-52 space-y-2 overflow-y-auto">
                {correctionHistoryQuery.data.data.map((item) => (
                  <li key={item.id} className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-slate-800">Revisi #{item.revision}</span>
                      <span className="text-slate-500">{formatCorrectionDateTime(item.correctedAt)}</span>
                    </div>
                    <div className="mt-1 text-slate-700">
                      {item.previousStatus} → <strong>{item.newStatus}</strong>
                    </div>
                    <div className="mt-1 text-slate-600">{item.reason}</div>
                    <div className="mt-1 text-[11px] text-slate-500">
                      Oleh {item.correctedByAdminUsername} (Admin #{item.correctedByAdminId})
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">Belum ada riwayat koreksi untuk presensi ini.</p>
            )}
          </section>
        </div>
      )}
    </Modal>

  </div>;
};
