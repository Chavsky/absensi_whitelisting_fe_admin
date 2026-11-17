import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../../lib/api';
import { AttendanceStatisticsResponse } from '../../types/report';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LoadingState } from '../../components/ui/LoadingState';
import { getJakartaDate, getPastJakartaDate } from '../../lib/dateUtils';

export const StatisticsPage: React.FC = () => {
  const [startDate, setStartDate] = useState(getPastJakartaDate(6));
  const [endDate, setEndDate] = useState(getJakartaDate());
  const query = useQuery<AttendanceStatisticsResponse>({
    queryKey: ['attendanceStatistics', { startDate, endDate }],
    queryFn: () => api.get('/reports/attendance/statistics', { startDate, endDate }),
  });

  const metrics = query.data?.metrics;
  const definitions = query.data?.definition ?? {};
  const chartData = metrics
    ? metrics.recordPerSesi.map((item) => ({ sesi: item.key, record: item.count }))
    : [];

  return <div className="space-y-6">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div><h1 className="text-xl font-bold text-slate-900 tracking-tight">Statistik Presensi</h1><p className="text-xs text-slate-500 mt-1">Jumlah karyawan dan record tersimpan dalam rentang tanggal.</p></div>
      <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200/80 shadow-xs"><Input aria-label="Tanggal mulai" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-36 text-xs py-1.5" /><span className="text-xs text-slate-400">s/d</span><Input aria-label="Tanggal akhir" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-36 text-xs py-1.5" /></div>
    </div>

    {query.isLoading ? <LoadingState message="Memuat statistik presensi..." className="h-64" /> : query.isError || !metrics ? <div className="bg-white p-8 rounded-xl border border-slate-200 text-center"><p className="text-sm text-rose-600 mb-3">Statistik tidak dapat dimuat dari backend.</p><Button variant="outline" size="sm" onClick={() => void query.refetch()}>Coba Lagi</Button></div> : <>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <Metric label="Karyawan Terdaftar" value={metrics.totalKaryawanTerdaftar} />
        <Metric label="Karyawan Aktif" value={metrics.totalKaryawanAktif} />
        <Metric label="Karyawan Nonaktif" value={metrics.totalKaryawanNonaktif} />
        <Metric label="Total Record Presensi" value={metrics.totalRecordAbsensi} />
        <Metric label="Karyawan dengan Record" value={metrics.karyawanDenganRecordDalamPeriode} />
        <Metric label="Karyawan tanpa Record" value={metrics.karyawanTanpaRecordDalamPeriode} />
      </div>

      <section className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="mb-4"><h2 className="text-sm font-semibold text-slate-900">Record Presensi per Sesi</h2><p className="text-xs text-slate-500 mt-1">Jumlah record Attendance pada rentang tanggal yang dipilih.</p></div>
        <div className="h-72 w-full">{metrics.totalRecordAbsensi === 0 ? <div className="h-full flex items-center justify-center text-xs text-slate-500">Belum ada record pada rentang tanggal yang dipilih.</div> : <ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 10, right: 15, left: 0, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" /><XAxis dataKey="sesi" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} interval={0} angle={-30} textAnchor="end" height={70} /><YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} /><Tooltip /><Bar dataKey="record" name="Record tersimpan" fill="#4f46e5" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>}</div>
      </section>

      <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">“Karyawan tanpa record” berarti tidak memiliki record presensi pada rentang ini. Metrik ini bukan kesimpulan bahwa karyawan tidak hadir.</p>
      {Object.keys(definitions).length > 0 && <details className="bg-white p-4 rounded-xl border border-slate-200 text-xs"><summary className="font-semibold text-slate-700 cursor-pointer">Definisi metrik backend</summary><dl className="mt-3 space-y-2">{Object.entries(definitions).map(([key, definition]) => <div key={key}><dt className="font-medium text-slate-800">{key}</dt><dd className="text-slate-500 mt-0.5">{definition}</dd></div>)}</dl></details>}
    </>}
  </div>;
};

const Metric: React.FC<{ label: string; value: number }> = ({ label, value }) => <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs"><div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</div><div className="text-2xl font-bold text-slate-900 mt-2">{value}</div></div>;
