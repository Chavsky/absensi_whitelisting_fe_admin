import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Users } from 'lucide-react';
import { api } from '../../lib/api';
import { AttendanceStatisticsResponse, AttendanceSummaryResponse, DailyReportResponse } from '../../types/report';
import { Button } from '../../components/ui/Button';
import { LoadingState } from '../../components/ui/LoadingState';
import { EmptyState } from '../../components/ui/EmptyState';
import { StatusBadge } from '../../components/ui/Badge';
import { getJakartaDate, getPastJakartaDate } from '../../lib/dateUtils';

export const DashboardPage: React.FC = () => {
  const today = getJakartaDate();
  const startDate = getPastJakartaDate(6);
  const query = useQuery({
    queryKey: ['dashboardData', { today, startDate }],
    queryFn: async () => {
      const [summary, statistics, daily] = await Promise.all([
        api.get<AttendanceSummaryResponse>('/reports/attendance/summary', { startDate: today, endDate: today, page: 1, limit: 10 }),
        api.get<AttendanceStatisticsResponse>('/reports/attendance/statistics', { startDate, endDate: today }),
        api.get<DailyReportResponse>('/reports/attendance/daily', { date: today, page: 1, limit: 10 }),
      ]);
      return { summary, statistics, daily };
    },
  });

  if (query.isLoading) return <LoadingState message="Memuat ringkasan operasional dashboard..." className="h-96" />;
  if (query.isError || !query.data) return <div className="bg-white p-8 rounded-xl border border-slate-200 text-center">
    <p className="text-sm text-rose-600 mb-3">Data dashboard tidak dapat dimuat dari backend.</p>
    <Button variant="outline" size="sm" onClick={() => void query.refetch()}>Coba Lagi</Button>
  </div>;

  const { summary, statistics, daily } = query.data;
  const metrics = statistics.metrics;
  const sessionMetrics = metrics.recordPerSesi.map((item) => ({ label: item.key, value: item.count }));
  const summarySessions = Array.from(new Set(
    summary.data.flatMap((employee) => employee.sessions.map((session) => session.key)),
  )).sort();
  const recordedDailyRows = daily.data.filter((row) => row.attendanceId !== undefined);

  return <div className="space-y-6">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200/80 shadow-xs">
      <div><div className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-1">Sistem Presensi Kantor · WIB</div><h1 className="text-xl font-bold text-slate-900 tracking-tight">Ringkasan Operasional ({today})</h1><p className="text-xs text-slate-500 mt-1">Statistik record untuk {startDate} sampai {today}; ringkasan sesi hari ini.</p></div>
      <div className="flex items-center gap-2"><Link to="/reports" className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg"><Calendar className="w-4 h-4" />Laporan</Link><Link to="/employees" className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg"><Users className="w-4 h-4" />Karyawan</Link></div>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <MetricCard label="Karyawan Terdaftar" value={metrics.totalKaryawanTerdaftar} detail={`${metrics.totalKaryawanAktif} aktif · ${metrics.totalKaryawanNonaktif} nonaktif`} />
      <MetricCard label="Record Presensi" value={metrics.totalRecordAbsensi} detail="Rentang tanggal yang ditampilkan" />
      <MetricCard label="Karyawan dengan Record" value={metrics.karyawanDenganRecordDalamPeriode} detail="Sedikitnya satu record dalam periode" />
      <MetricCard label="Karyawan tanpa Record" value={metrics.karyawanTanpaRecordDalamPeriode} detail="Tanpa record periode ini; bukan berarti tidak hadir" />
    </div>

    <section className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
      <h2 className="text-sm font-semibold text-slate-900">Record per Sesi</h2><p className="text-xs text-slate-500 mt-1">Jumlah record tersimpan per sesi selama rentang tanggal di atas. Semua sesi dari backend ditampilkan tanpa batas jumlah tetap.</p>
      {sessionMetrics.length === 0 ? <EmptyState title="Belum Ada Sesi" description="Backend belum mengembalikan konfigurasi sesi." /> : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mt-4">{sessionMetrics.map((item) => <div key={item.label} className="p-4 rounded-lg border border-slate-100 bg-slate-50/60"><div className="text-xs text-slate-500 break-all">{item.label}</div><div className="text-xl font-bold text-slate-900 mt-1">{item.value}</div></div>)}</div>}
    </section>

    <section className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex items-center justify-between"><div><h2 className="text-sm font-semibold text-slate-900">Ringkasan Karyawan Hari Ini</h2><p className="text-xs text-slate-500 mt-1">Jumlah Hadir / Tidak Hadir per sesi, per karyawan.</p></div><Link to="/reports" className="text-xs text-indigo-600">Lihat laporan</Link></div>
      {!summary.data.length ? <EmptyState title="Belum Ada Ringkasan" description="Tidak ada karyawan pada hasil ringkasan." /> : <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-slate-50 text-slate-500 uppercase"><tr><th className="py-3 px-4">Pegawai</th><th className="py-3 px-4">Status</th><th className="py-3 px-4">Total Record</th>{summarySessions.map((key) => <th key={key} className="py-3 px-4 whitespace-nowrap"><span className="block max-w-32 truncate" title={key}>{key}</span><span className="block text-[10px] font-normal normal-case text-slate-400">Hadir / Tidak Hadir</span></th>)}</tr></thead><tbody className="divide-y divide-slate-100">{summary.data.map((employee) => <tr key={employee.nik}><td className="py-3 px-4"><div className="font-semibold">{employee.namaLengkap}</div><div className="font-mono text-slate-500">{employee.nik}</div></td><td className="py-3 px-4">{employee.statusKaryawan}</td><td className="py-3 px-4">{employee.totalRecordAbsensi}</td>{summarySessions.map((key) => { const session = employee.sessions.find((item) => item.key === key); return <td key={key} className="py-3 px-4 whitespace-nowrap">{session ? `${session.jumlahHadir} / ${session.jumlahTidakHadir}` : '0 / 0'}</td>; })}</tr>)}</tbody></table></div>}
    </section>

    <section className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
      <div className="p-5 border-b border-slate-100"><h2 className="text-sm font-semibold text-slate-900">Catatan Sesi Hari Ini</h2><p className="text-xs text-slate-500 mt-1">Baris merupakan record sesi terpisah; seluruh record pada halaman pertama ditampilkan tanpa batas jumlah sesi.</p></div>
      {!recordedDailyRows.length ? <EmptyState title="Belum Ada Record Sesi" description="Tidak ada record presensi tersimpan pada karyawan yang tercantum di halaman pertama." /> : <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-slate-50 text-slate-500 uppercase"><tr><th className="py-3 px-4">Pegawai</th><th className="py-3 px-4">Sesi</th><th className="py-3 px-4">Waktu</th><th className="py-3 px-4 text-right">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{recordedDailyRows.map((row) => <tr key={`${row.nik}:${row.sesi}`}><td className="py-3 px-4"><div className="font-semibold">{row.namaLengkap}</div><div className="font-mono text-slate-500">{row.nik}</div></td><td className="py-3 px-4">{sessionLabel(row.sesi, row.sessionName)}</td><td className="py-3 px-4 font-mono">{row.waktuAbsen ? new Date(row.waktuAbsen).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false }) : '—'}</td><td className="py-3 px-4 text-right"><StatusBadge status={row.statusAbsensi} /></td></tr>)}</tbody></table></div>}
    </section>
  </div>;
};

const MetricCard: React.FC<{ label: string; value: number; detail: string }> = ({ label, value, detail }) => <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs"><div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</div><div className="text-2xl font-bold text-slate-900 mt-2">{value}</div><div className="text-xs text-slate-500 mt-1">{detail}</div></div>;

function sessionLabel(session: string, name?: string) {
  return name || session;
}
