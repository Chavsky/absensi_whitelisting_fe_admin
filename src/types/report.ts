export type AttendanceSession = string;

export interface ReportPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  unit?: 'karyawan';
}

export interface DailyAttendanceRow {
  nik: string;
  namaLengkap: string;
  tanggal: string;
  isActive: boolean;
  statusKaryawan: string;
  sesi: AttendanceSession;
  waktuAbsen: string | null;
  statusAbsensi: string | null;
  sessionKey?: string;
  sessionName?: string;
  finalized?: boolean;
  correctionId?: number;
  attendanceId?: number;
}

export interface AttendanceRecordItem {
  id: number;
  nik: string;
  namaLengkap: string;
  tanggal: string;
  isActive: boolean;
  statusKaryawan: string;
  sesi: AttendanceSession;
  waktuAbsen: string;
  statusAbsensi: string;
  sessionKey?: string;
  sessionName?: string;
}

export interface DailyReportResponse {
  success: boolean;
  date: string;
  data: DailyAttendanceRow[];
  pagination: ReportPagination;
}

export interface PeriodReportResponse {
  success: boolean;
  periode: { startDate: string; endDate: string };
  data: AttendanceRecordItem[];
  pagination: ReportPagination;
}

export interface AttendanceSummarySession {
  key: string;
  jumlahHadir: number;
  jumlahTidakHadir: number;
}

export interface AttendanceSummaryEmployee {
  nik: string;
  namaLengkap: string;
  isActive: boolean;
  statusKaryawan: string;
  totalRecordAbsensi: number;
  sessions: AttendanceSummarySession[];
}

export interface AttendanceSummaryResponse {
  success: boolean;
  periode: { startDate: string; endDate: string };
  data: AttendanceSummaryEmployee[];
  definition: Record<string, string>;
  statusDefinition?: string;
  pagination: ReportPagination;
}

export interface EmployeeAttendanceHistoryRow {
  id: number;
  tanggal: string;
  sesi: AttendanceSession;
  waktuAbsen: string;
  status: string;
  sessionKey?: string;
  sessionName?: string;
}

export interface EmployeeAttendanceHistoryResponse {
  success: boolean;
  periode: { startDate: string; endDate: string };
  employee: {
    nik: string;
    namaLengkap: string;
    isActive: boolean;
    statusKaryawan: string;
  };
  data: EmployeeAttendanceHistoryRow[];
  pagination: ReportPagination;
}

export interface AttendanceStatisticsResponse {
  success: boolean;
  periode: { startDate: string; endDate: string };
  metrics: {
    totalKaryawanTerdaftar: number;
    totalKaryawanAktif: number;
    totalKaryawanNonaktif: number;
    totalRecordAbsensi: number;
    recordPerSesi: Array<{ key: string; count: number }>;
    karyawanDenganRecordDalamPeriode: number;
    karyawanTanpaRecordDalamPeriode: number;
  };
  definition: Record<string, string>;
}
