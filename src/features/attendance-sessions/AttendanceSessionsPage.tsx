import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  CalendarClock,
  Clock3,
  Plus,
  RefreshCw,
  Settings2,
  Trash2,
} from 'lucide-react';
import { ApiClientError, api } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';
import { LoadingState } from '../../components/ui/LoadingState';
import { Modal } from '../../components/ui/Modal';

interface DaySchedule {
  id?: number;
  versionId?: number;
  isoWeekday: number;
  isEnabled: boolean;
  startTime: string;
  endTime: string;
}

interface SessionVersion {
  id: number;
  sessionId: number;
  name: string;
  sortOrder: number;
  isActive: boolean;
  effectiveFrom: string;
  startTime: string | null;
  endTime: string | null;
  daySchedules: DaySchedule[];
}

interface AttendanceSession {
  id: number;
  key: string;
  isEnabled: boolean;
  deletedAt?: string | null;
  disabledAt?: string | null;
  enabledFrom?: string | null;
  versions: SessionVersion[];
}

interface SessionListResponse {
  success: boolean;
  data: AttendanceSession[];
}

interface SessionMutationResponse {
  success: boolean;
  data?: AttendanceSession | SessionVersion;
}

interface SessionDisableMutationResponse {
  success: boolean;
  data?: SessionVersion & {
    isEnabled: boolean;
    disabledAt: string;
  };
}

interface SessionArchiveMutationResponse {
  success: boolean;
  data?: {
    id: number;
    key: string;
    isEnabled: boolean;
    deletedAt: string;
    alreadyArchived: boolean;
  };
}

interface SessionPermanentDeleteMutationResponse {
  success: boolean;
  data?: {
    id: number;
    key: string;
    deleted: true;
    correctionsDeleted: number;
    attendancesDeleted: number;
    schedulesDeleted: number;
    versionsDeleted: number;
  };
}

interface VersionDraft {
  name: string;
  sortOrder: string;
  isActive: boolean;
  startTime: string;
  endTime: string;
}

interface SessionEditor {
  mode: 'create' | 'version';
  key: string;
  draft: VersionDraft;
}

const LEGACY_DAYS = [
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
  'Minggu',
];

function jakartaDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function dateKey(value: string): string {
  return value.slice(0, 10);
}

function isBusinessDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

function formatDate(value: string): string {
  const key = dateKey(value);
  const date = new Date(`${key}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function legacyUniformTime(version?: SessionVersion): { startTime: string; endTime: string } | null {
  const weekdays = version?.daySchedules
    .filter((schedule) => schedule.isoWeekday >= 1 && schedule.isoWeekday <= 5)
    .sort((first, second) => first.isoWeekday - second.isoWeekday);
  if (
    !weekdays ||
    weekdays.length !== 5 ||
    weekdays.some((schedule) => !schedule.isEnabled) ||
    weekdays.some((schedule) =>
      schedule.startTime !== weekdays[0].startTime || schedule.endTime !== weekdays[0].endTime
    )
  ) return null;
  return { startTime: weekdays[0].startTime, endTime: weekdays[0].endTime };
}

function versionTimeRanges(version: SessionVersion): Array<{ startTime: string; endTime: string }> {
  if (version.startTime && version.endTime) {
    return [{ startTime: version.startTime, endTime: version.endTime }];
  }
  return version.daySchedules
    .filter((schedule) => schedule.isoWeekday >= 1 && schedule.isoWeekday <= 5 && schedule.isEnabled)
    .map(({ startTime, endTime }) => ({ startTime, endTime }));
}

function latestVersion(session: AttendanceSession): SessionVersion | undefined {
  return [...session.versions].sort(
    (first, second) => dateKey(second.effectiveFrom).localeCompare(dateKey(first.effectiveFrom)) ||
      second.id - first.id,
  )[0];
}

function validClock(value: unknown): value is string {
  return typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function hasValidLegacySchedules(value: unknown): value is DaySchedule[] {
  return Array.isArray(value) && value.every((schedule: DaySchedule) =>
    Number.isInteger(schedule?.isoWeekday) &&
    schedule.isoWeekday >= 1 &&
    schedule.isoWeekday <= 7 &&
    typeof schedule.isEnabled === 'boolean' &&
    validClock(schedule.startTime) &&
    validClock(schedule.endTime) &&
    schedule.startTime < schedule.endTime
  );
}

function currentVersion(session: AttendanceSession, today: string): SessionVersion | undefined {
  return [...session.versions]
    .filter((version) => dateKey(version.effectiveFrom) <= today)
    .sort((first, second) => dateKey(second.effectiveFrom).localeCompare(dateKey(first.effectiveFrom)) ||
      second.id - first.id)[0];
}

function isDefinitionEnabled(session: AttendanceSession, today: string): boolean {
  if (!session.disabledAt) return true;
  return Boolean(session.enabledFrom && dateKey(session.enabledFrom) <= today);
}

function isValidSessionVersion(version: SessionVersion): boolean {
  return typeof version?.name === 'string' &&
    typeof version.isActive === 'boolean' &&
    Number.isInteger(version.sortOrder) &&
    typeof version.effectiveFrom === 'string' &&
    hasValidLegacySchedules(version.daySchedules) &&
    ((version.startTime == null && version.endTime == null) ||
      (validClock(version.startTime) && validClock(version.endTime) && version.startTime < version.endTime));
}

function isValidSessionList(response: SessionListResponse | undefined): response is SessionListResponse {
  return response?.success === true &&
    Array.isArray(response.data) &&
    response.data.every((session) =>
      Number.isSafeInteger(session?.id) &&
      session.id > 0 &&
      typeof session.key === 'string' &&
      typeof session.isEnabled === 'boolean' &&
      Array.isArray(session.versions) &&
      session.versions.every(isValidSessionVersion)
    );
}

function backendErrorMessage(error: unknown): string {
  if (!(error instanceof ApiClientError)) {
    return error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui.';
  }

  const message = typeof error.data?.message === 'string' ? error.data.message : '';
  const knownMessages: Record<string, string> = {
    SESSION_KEY_EXISTS: 'Backend tidak dapat membuat identitas sesi yang unik. Silakan coba kembali.',
    SESSION_NAME_INVALID: 'Nama sesi wajib diisi dan maksimal 100 karakter.',
    SESSION_SORT_ORDER_INVALID: 'Urutan harus berupa bilangan bulat dari 0 sampai 1.000.000.',
    SESSION_ACTIVE_INVALID: 'Status aktif tidak valid.',
    SESSION_TIME_INVALID: 'Waktu mulai dan berakhir harus menggunakan format HH:mm.',
    SESSION_TIME_RANGE_INVALID: 'Waktu mulai harus lebih awal daripada waktu berakhir.',
    SESSION_SCHEDULE_OVERLAP: 'Jam sesi bertumpang tindih dengan sesi lain pada periode yang berlaku.',
    SESSION_PENDING_REFERENCED: 'Penyimpanan dihentikan karena versi jadwal yang belum berlaku masih direferensikan data absensi atau koreksi; tidak ada data yang diubah.',
    SESSION_NOT_FOUND: 'Sesi tidak ditemukan.',
    SESSION_ACTIVE: 'Sesi aktif harus dinonaktifkan terlebih dahulu sebelum dihapus permanen atau diarsipkan.',
    SESSION_ARCHIVED: 'Sesi sudah diarsipkan dan tidak dapat diubah.',
    SESSION_DELETE_CONFLICT: 'Sesi belum dapat dihapus permanen karena masih ada data terkait yang gagal dihapus. Tidak ada data yang dihapus sebagian; silakan coba lagi.',
  };
  if (message === 'SESSION_SCHEDULE_OVERLAP') {
    const detail = (error.data?.data ?? null) as
      | { sessionName?: string; startTime?: string; endTime?: string }
      | null;
    if (detail?.sessionName && detail.startTime && detail.endTime) {
      return `Jam sesi bertumpang tindih dengan sesi "${detail.sessionName}" (${detail.startTime}–${detail.endTime}). Pilih rentang jam yang tidak bertabrakan.`;
    }
    return knownMessages.SESSION_SCHEDULE_OVERLAP;
  }
  if (message && knownMessages[message]) return knownMessages[message];
  if (error.statusCode === 400) return message || 'Data sesi atau jadwal tidak valid.';
  if (error.statusCode === 401) return 'Sesi Admin tidak valid atau telah berakhir. Silakan login kembali.';
  if (error.statusCode === 403) return 'Anda tidak memiliki izin untuk mengelola sesi absensi.';
  if (error.statusCode === 404) return message || 'Sesi atau layanan yang diminta tidak ditemukan.';
  if (error.statusCode === 409) return knownMessages[message] || message || 'Konfigurasi bertentangan dengan sesi atau versi yang sudah ada.';
  if (error.statusCode >= 500) return 'Backend mengalami gangguan. Periksa kembali status sebelum mengirim perubahan baru.';
  return message || error.message;
}

export function validateDraft(
  editor: SessionEditor,
  sessions: AttendanceSession[],
  today: string,
): string | null {
  const { draft, key } = editor;
  if (!draft.name.trim() || draft.name.trim().length > 100) {
    return 'Nama sesi wajib diisi dan maksimal 100 karakter.';
  }
  const sortOrder = Number(draft.sortOrder);
  if (!/^\d+$/.test(draft.sortOrder) || !Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 1_000_000) {
    return 'Urutan harus berupa bilangan bulat dari 0 sampai 1.000.000.';
  }
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(draft.startTime) ||
      !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(draft.endTime)) {
    return 'Jam mulai dan jam berakhir wajib diisi dengan format HH:mm.';
  }
  if (draft.startTime >= draft.endTime) {
    return 'Waktu mulai harus lebih awal daripada waktu berakhir; sesi tidak boleh melintasi tengah malam.';
  }
  if (!draft.isActive) return null;

  // Realtime rule: a saved schedule always takes effect on today's Jakarta
  // business date, so the pre-check compares against sessions enabled today.
  const candidateEffectiveFrom = today;

  for (const session of sessions) {
    if (session.key === key) continue;
    if (!isDefinitionEnabled(session, today)) continue;
    const versions = [...session.versions]
      .sort((first, second) => dateKey(first.effectiveFrom).localeCompare(dateKey(second.effectiveFrom)));
    for (let index = 0; index < versions.length; index += 1) {
      const version = versions[index];
      if (!version.isActive) continue;
      const versionEnd = versions[index + 1]
        ? dateKey(versions[index + 1].effectiveFrom)
        : null;
      const endsAfterCandidateStarts = versionEnd === null || versionEnd > candidateEffectiveFrom;
      if (!endsAfterCandidateStarts) continue;
      const overlaps = versionTimeRanges(version).some((range) =>
        draft.startTime < range.endTime && range.startTime < draft.endTime
      );
      if (version.isActive && overlaps) {
        return `Jam sesi bertumpang tindih dengan sesi "${version.name}" yang aktif pada periode tersebut.`;
      }
    }
  }
  return null;
}

function legacySchedule(schedules: DaySchedule[]) {
  return LEGACY_DAYS.map((day, index) => {
    const schedule = schedules.find((item) => item.isoWeekday === index + 1);
    return (
      <div key={day} className="flex items-center justify-between gap-2 text-xs">
        <span className="text-slate-500">{day}</span>
        {schedule?.isEnabled ? (
          <span className="font-mono font-medium text-slate-800">
            {schedule.startTime}–{schedule.endTime}
          </span>
        ) : (
          <span className="text-slate-400">Nonaktif</span>
        )}
      </div>
    );
  });
}

export const AttendanceSessionsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();
  const today = useMemo(() => jakartaDateKey(), []);
  const [editor, setEditor] = useState<SessionEditor | null>(null);
  const [deactivationTarget, setDeactivationTarget] = useState<AttendanceSession | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<AttendanceSession | null>(null);
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<AttendanceSession | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const sessionsQuery = useQuery<SessionListResponse>({
    queryKey: ['attendanceSessions'],
    queryFn: async () => {
      const response = await api.get<SessionListResponse>('/admins/attendance-sessions');
      if (!isValidSessionList(response)) {
        throw new Error('Backend tidak mengembalikan daftar sesi dan versi jadwal yang valid.');
      }
      return response;
    },
  });
  const archivedSessionsQuery = useQuery<SessionListResponse>({
    queryKey: ['attendanceSessions', 'archived'],
    queryFn: async () => {
      const response = await api.get<SessionListResponse>('/admins/attendance-sessions/archived');
      if (!isValidSessionList(response)) {
        throw new Error('Backend tidak mengembalikan daftar sesi terarsip yang valid.');
      }
      return response;
    },
    enabled: showArchived,
  });
  const sessions = sessionsQuery.data?.data ?? [];
  const archivedSessions = archivedSessionsQuery.data?.data ?? [];
  const displaySessions = [...sessions].sort((first, second) => {
    const firstVersion = currentVersion(first, today) ?? latestVersion(first);
    const secondVersion = currentVersion(second, today) ?? latestVersion(second);
    return (firstVersion?.sortOrder ?? 0) - (secondVersion?.sortOrder ?? 0) ||
      first.key.localeCompare(second.key);
  });

  const saveMutation = useMutation({
    retry: false,
    mutationFn: async (input: SessionEditor) => {
      const payload = {
        name: input.draft.name.trim(),
        sortOrder: Number(input.draft.sortOrder),
        isActive: input.draft.isActive,
        startTime: input.draft.startTime,
        endTime: input.draft.endTime,
      };
      const response = input.mode === 'create'
        ? await api.post<SessionMutationResponse>('/admins/attendance-sessions', {
          ...payload,
        })
        : await api.post<SessionMutationResponse>(
          `/admins/attendance-sessions/${encodeURIComponent(input.key)}/versions`,
          payload,
        );
      if (response?.success !== true || !response.data) {
        throw new Error('Backend tidak mengembalikan konfirmasi sesi yang valid.');
      }
      if (input.mode === 'create') {
        const created = response.data as AttendanceSession;
        const createdVersion = created.versions?.[0];
        if (
          !Number.isSafeInteger(created.id) ||
          created.id <= 0 ||
          !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(created.key) ||
          !createdVersion ||
          createdVersion.name !== payload.name ||
          createdVersion.startTime !== payload.startTime ||
          createdVersion.endTime !== payload.endTime ||
          createdVersion.isActive !== payload.isActive ||
          !isBusinessDate(dateKey(createdVersion.effectiveFrom))
        ) {
          throw new Error('Response pembuatan sesi tidak dapat diverifikasi.');
        }
      } else {
        const version = response.data as SessionVersion;
        if (
          !Number.isSafeInteger(version.id) ||
          version.name !== payload.name ||
          version.startTime !== payload.startTime ||
          version.endTime !== payload.endTime ||
          version.isActive !== payload.isActive ||
          !isBusinessDate(dateKey(version.effectiveFrom)) ||
          !hasValidLegacySchedules(version.daySchedules)
        ) {
          throw new Error('Response versi sesi tidak dapat diverifikasi.');
        }
      }
      const savedVersion = input.mode === 'create'
        ? (response.data as AttendanceSession).versions[0]
        : response.data as SessionVersion;
      return {
        input,
        effectiveFrom: savedVersion.effectiveFrom,
        sessionKey: input.mode === 'create' ? (response.data as AttendanceSession).key : null,
      };
    },
    onSuccess: async ({ input, effectiveFrom, sessionKey }) => {
      success(
        input.mode === 'create' ? 'Sesi Berhasil Dibuat' : 'Perubahan Jadwal Berlaku',
        input.mode === 'create'
          ? `Identitas ${sessionKey} dibuat otomatis. Sesi berlaku mulai ${formatDate(effectiveFrom)}.`
          : `Nama, status, dan jam sesi berlaku langsung pada tanggal bisnis ${formatDate(effectiveFrom)}.`,
      );
      setEditor(null);
      await queryClient.invalidateQueries({ queryKey: ['attendanceSessions'] });
    },
    onError: async (error: unknown) => {
      toastError('Gagal Menyimpan Sesi', backendErrorMessage(error));
      // Refetch so the next attempt validates against fresh session data
      // instead of a cache that may miss newly created or updated sessions.
      await queryClient.invalidateQueries({ queryKey: ['attendanceSessions'] });
    },
  });

  const deactivateMutation = useMutation({
    retry: false,
    mutationFn: async (session: AttendanceSession) => {
      const response = await api.delete<SessionDisableMutationResponse>(
        `/admins/attendance-sessions/${encodeURIComponent(session.key)}`,
      );
      const disabledSession = response?.data;
      if (
        response?.success !== true ||
        !disabledSession ||
        !Number.isSafeInteger(disabledSession.id) ||
        disabledSession.isEnabled !== false ||
        !isBusinessDate(dateKey(disabledSession.effectiveFrom)) ||
        !hasValidLegacySchedules(disabledSession.daySchedules) ||
        Number.isNaN(Date.parse(disabledSession.disabledAt))
      ) {
        throw new Error('Backend tidak mengonfirmasi penonaktifan sesi.');
      }
      return disabledSession.disabledAt;
    },
    onSuccess: async () => {
      success(
        'Sesi Dinonaktifkan',
        'Sesi langsung dinonaktifkan setelah transaksi backend berhasil. Versi dan presensi historis tetap tersimpan.',
      );
      setDeactivationTarget(null);
      await queryClient.invalidateQueries({ queryKey: ['attendanceSessions'] });
    },
    onError: (error: unknown) => {
      toastError('Gagal Menonaktifkan Sesi', backendErrorMessage(error));
    },
  });

  const archiveMutation = useMutation({
    retry: false,
    mutationFn: async (session: AttendanceSession) => {
      const response = await api.delete<SessionArchiveMutationResponse>(
        `/admins/attendance-sessions/${encodeURIComponent(session.key)}/archive`,
      );
      const archivedSession = response?.data;
      if (
        response?.success !== true ||
        !archivedSession ||
        archivedSession.key !== session.key ||
        !Number.isSafeInteger(archivedSession.id) ||
        archivedSession.isEnabled !== false ||
        typeof archivedSession.alreadyArchived !== 'boolean' ||
        Number.isNaN(Date.parse(archivedSession.deletedAt))
      ) {
        throw new Error('Backend tidak mengonfirmasi pengarsipan sesi.');
      }
      return archivedSession;
    },
    onSuccess: async () => {
      success(
        'Sesi Diarsipkan',
        'Sesi dihapus dari daftar utama. Riwayat absensi, koreksi, dan versi jadwal tetap tersimpan.',
      );
      setArchiveTarget(null);
      await queryClient.invalidateQueries({ queryKey: ['attendanceSessions'] });
    },
    onError: (error: unknown) => {
      toastError('Gagal Mengarsipkan Sesi', backendErrorMessage(error));
    },
  });

  const permanentDeleteMutation = useMutation({
    retry: false,
    mutationFn: async (session: AttendanceSession) => {
      const response = await api.delete<SessionPermanentDeleteMutationResponse>(
        `/admins/attendance-sessions/${encodeURIComponent(session.key)}/permanent`,
      );
      const result = response?.data;
      if (
        response?.success !== true ||
        !result ||
        result.key !== session.key ||
        result.id !== session.id ||
        result.deleted !== true ||
        !Number.isSafeInteger(result.attendancesDeleted) ||
        !Number.isSafeInteger(result.correctionsDeleted) ||
        !Number.isSafeInteger(result.schedulesDeleted) ||
        !Number.isSafeInteger(result.versionsDeleted)
      ) {
        throw new Error('Backend tidak mengonfirmasi penghapusan permanen sesi.');
      }
      return result;
    },
    onSuccess: async (result) => {
      success(
        'Sesi Dihapus Permanen',
        `Sesi ${result.key} dihapus dari database beserta ${result.attendancesDeleted} presensi, ${result.correctionsDeleted} koreksi, ${result.schedulesDeleted} jadwal harian, dan ${result.versionsDeleted} versi. Key tidak akan digunakan kembali.`,
      );
      setPermanentDeleteTarget(null);
      // Remove from local caches immediately, then let the backend refresh
      // every cached view (sessions, dashboard, statistics, reports).
      queryClient.setQueryData<SessionListResponse>(['attendanceSessions'], (current) =>
        current ? { ...current, data: current.data.filter((session) => session.key !== result.key) } : current,
      );
      queryClient.setQueryData<SessionListResponse>(['attendanceSessions', 'archived'], (current) =>
        current ? { ...current, data: current.data.filter((session) => session.key !== result.key) } : current,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['attendanceSessions'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboardData'] }),
        queryClient.invalidateQueries({ queryKey: ['attendanceStatistics'] }),
        queryClient.invalidateQueries({ queryKey: ['dailyReport'] }),
        queryClient.invalidateQueries({ queryKey: ['periodReport'] }),
        queryClient.invalidateQueries({ queryKey: ['summaryReport'] }),
        queryClient.invalidateQueries({ queryKey: ['employeeHistory'] }),
      ]);
    },
    onError: (error: unknown) => {
      toastError('Gagal Menghapus Sesi Permanen', backendErrorMessage(error));
    },
  });

  const openCreateEditor = () => {
    setEditor({
      mode: 'create',
      key: '',
      draft: {
        name: '',
        sortOrder: String((sessions.length + 1) * 10),
        isActive: true,
        startTime: '',
        endTime: '',
      },
    });
  };

  const openVersionEditor = (session: AttendanceSession) => {
    const latest = latestVersion(session);
    const legacyTime = legacyUniformTime(latest);
    setEditor({
      mode: 'version',
      key: session.key,
      draft: {
        name: latest?.name ?? '',
        sortOrder: String(latest?.sortOrder ?? 0),
        isActive: latest?.isActive ?? true,
        startTime: latest?.startTime ?? legacyTime?.startTime ?? '',
        endTime: latest?.endTime ?? legacyTime?.endTime ?? '',
      },
    });
  };

  const updateDraft = (changes: Partial<VersionDraft>) => {
    setEditor((current) => current
      ? { ...current, draft: { ...current.draft, ...changes } }
      : current);
  };

  const validationError = editor ? validateDraft(editor, sessions, today) : null;
  const errorMessage = sessionsQuery.error
    ? backendErrorMessage(sessionsQuery.error)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Sesi & Jadwal Absensi</h1>
          <p className="mt-1 text-xs text-slate-500">
            Kelola sesi absensi dan jam operasionalnya.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            icon={<RefreshCw className="h-4 w-4" />}
            onClick={() => void sessionsQuery.refetch()}
            isLoading={sessionsQuery.isFetching}
          >
            Muat Ulang
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={openCreateEditor}
          >
            Tambah Sesi
          </Button>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 text-xs text-indigo-900">
        <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Jam sesi berlaku otomatis setiap hari kerja (Senin–Jumat). Sabtu dan Minggu tidak memiliki
          sesi absensi. Zona waktu <strong>Asia/Jakarta</strong>; jam mulai inklusif dan jam berakhir
          eksklusif. Sesi tidak boleh melintasi tengah malam, dan jam sesi aktif tidak boleh bertumpang
          tindih. Perubahan disimpan sebagai versi baru; histori tidak ditimpa.
        </p>
      </div>

      {sessionsQuery.isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white">
          <LoadingState message="Memuat konfigurasi sesi..." className="h-64" />
        </div>
      ) : sessionsQuery.isError ? (
        <div className="rounded-xl border border-rose-200 bg-white p-8 text-center">
          <p className="text-sm font-semibold text-rose-700">Data sesi gagal dimuat</p>
          <p className="mx-auto mt-2 max-w-xl text-xs text-slate-600">{errorMessage}</p>
          <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => void sessionsQuery.refetch()}>
            Coba Lagi
          </Button>
        </div>
      ) : sessions.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white">
          <EmptyState
            icon={<CalendarClock className="h-6 w-6" />}
            title="Belum Ada Sesi Absensi"
            description="Backend belum mengembalikan sesi. Tambahkan sesi untuk memulai konfigurasi."
            action={<Button type="button" size="sm" onClick={openCreateEditor}>Tambah Sesi</Button>}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {displaySessions.map((session) => {
            const activeVersion = currentVersion(session, today);
            const latest = latestVersion(session);
            const displayVersion = activeVersion ?? latest;
            const isFutureOnly = !activeVersion && Boolean(latest);
            return (
              <section key={session.key} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                <div className="flex flex-col gap-3 border-b border-slate-100 p-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-bold text-slate-900">{displayVersion?.name ?? session.key}</h2>
                      {activeVersion ? (
                        activeVersion.isActive && session.isEnabled
                          ? <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Aktif</span>
                          : <span className="rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">Nonaktif</span>
                      ) : (
                        <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                          {isFutureOnly ? 'Belum berlaku' : 'Belum dikonfigurasi'}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                      <span className="font-mono">Key: {session.key}</span>
                      <span>Urutan: {displayVersion?.sortOrder ?? '—'}</span>
                      {activeVersion && <span>Berlaku sejak {formatDate(activeVersion.effectiveFrom)}</span>}
                      {!activeVersion && latest && <span>Versi berikutnya {formatDate(latest.effectiveFrom)}</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {activeVersion?.isActive && session.isEnabled && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setDeactivationTarget(session)}
                      >
                        Nonaktifkan Sesi
                      </Button>
                    )}
                    {!session.isEnabled && (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          icon={<Archive className="h-4 w-4" />}
                          onClick={() => setArchiveTarget(session)}
                        >
                          Arsipkan
                        </Button>
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          icon={<Trash2 className="h-4 w-4" />}
                          onClick={() => setPermanentDeleteTarget(session)}
                        >
                          Hapus Permanen
                        </Button>
                      </>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      icon={<Settings2 className="h-4 w-4" />}
                      onClick={() => openVersionEditor(session)}
                    >
                      Buat Versi Baru
                    </Button>
                  </div>
                </div>

                {displayVersion ? (
                  <div className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div className="min-w-0">
                      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-700">
                        <Clock3 className="h-4 w-4 text-slate-500" />
                        Jam absensi
                      </div>
                      {displayVersion.startTime && displayVersion.endTime ? (
                        <div className="rounded-lg bg-slate-50 p-3">
                          <span className="font-mono text-sm font-semibold text-slate-800">
                            {displayVersion.startTime}–{displayVersion.endTime}
                          </span>
                          <span className="ml-2 text-xs text-slate-500">Senin–Jumat</span>
                        </div>
                      ) : (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                          Konfigurasi versi lama masih menggunakan jam per hari. Data aslinya tetap
                          dipertahankan; buat versi baru untuk menetapkan satu rentang jam hari kerja.
                          <div className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
                            {legacySchedule(displayVersion.daySchedules)}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 text-xs text-slate-600 sm:min-w-48">
                      <span className="block font-semibold text-slate-700">Hari kerja</span>
                      Senin–Jumat
                    </div>
                  </div>
                ) : (
                  <div className="p-4 text-xs text-slate-500">Sesi belum memiliki konfigurasi jadwal.</div>
                )}
              </section>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={deactivationTarget !== null}
        onClose={() => {
          if (!deactivateMutation.isPending) setDeactivationTarget(null);
        }}
        title="Nonaktifkan sesi absensi?"
        subtitle="Sesi langsung berhenti menerima presensi baru setelah perubahan berhasil disimpan."
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeactivationTarget(null)}
              disabled={deactivateMutation.isPending}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="danger"
              isLoading={deactivateMutation.isPending}
              disabled={!deactivationTarget}
              onClick={() => {
                if (deactivationTarget) deactivateMutation.mutate(deactivationTarget);
              }}
            >
              Nonaktifkan Sekarang
            </Button>
          </>
        }
      >
        {deactivationTarget && (
          <div className="space-y-3">
            <p className="text-sm text-slate-700">
              <strong>{latestVersion(deactivationTarget)?.name ?? deactivationTarget.key}</strong> akan
              langsung tidak tersedia untuk presensi baru setelah transaksi backend berhasil.
            </p>
            <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
              Status sesi diperbarui saat itu juga. Versi jadwal dan presensi yang sudah tersimpan
              tidak diubah atau dihapus.
            </p>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={archiveTarget !== null}
        onClose={() => {
          if (!archiveMutation.isPending) setArchiveTarget(null);
        }}
        title="Arsipkan sesi absensi?"
        subtitle="Sesi nonaktif akan dihapus dari daftar utama, tanpa menghapus riwayatnya."
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setArchiveTarget(null)}
              disabled={archiveMutation.isPending}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="danger"
              isLoading={archiveMutation.isPending}
              disabled={!archiveTarget}
              onClick={() => {
                if (archiveTarget) archiveMutation.mutate(archiveTarget);
              }}
            >
              Arsipkan Sekarang
            </Button>
          </>
        }
      >
        {archiveTarget && (
          <div className="space-y-3">
            <p className="text-sm text-slate-700">
              Sesi <strong>{latestVersion(archiveTarget)?.name ?? archiveTarget.key}</strong> akan
              diarsipkan dan tidak muncul lagi di daftar utama Admin atau Employee PWA.
            </p>
            <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
              Ini bukan penghapusan permanen: riwayat absensi, koreksi, dan seluruh versi jadwal tetap
              tersimpan. Sesi terarsip dapat dihapus permanen satu per satu melalui bagian
              “Sesi Terarsip” di bawah.
            </p>
          </div>
        )}
      </Modal>

      <section className="rounded-xl border border-slate-200 bg-slate-50/60">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 p-4 text-left"
          onClick={() => setShowArchived((current) => !current)}
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Archive className="h-4 w-4 text-slate-500" />
            Sesi Terarsip
            <span className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600">
              Penghapusan permanen tersedia satu per satu
            </span>
          </span>
          <span className="text-xs font-semibold text-indigo-600">
            {showArchived ? 'Sembunyikan' : 'Tampilkan'}
          </span>
        </button>
        {showArchived && (
          <div className="border-t border-slate-200 p-4">
            {archivedSessionsQuery.isLoading ? (
              <LoadingState message="Memuat sesi terarsip..." className="h-24" />
            ) : archivedSessionsQuery.isError ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                Sesi terarsip gagal dimuat: {backendErrorMessage(archivedSessionsQuery.error)}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="ml-2"
                  onClick={() => void archivedSessionsQuery.refetch()}
                >
                  Coba Lagi
                </Button>
              </div>
            ) : archivedSessions.length === 0 ? (
              <p className="text-xs text-slate-500">Tidak ada sesi terarsip.</p>
            ) : (
              <ul className="space-y-2">
                {archivedSessions.map((session) => {
                  const latest = latestVersion(session);
                  return (
                    <li
                      key={session.key}
                      className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900">{latest?.name ?? session.key}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                          <span className="font-mono">Key: {session.key}</span>
                          {session.deletedAt && <span>Diarsipkan {formatDate(session.deletedAt)}</span>}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        icon={<Trash2 className="h-4 w-4" />}
                        onClick={() => setPermanentDeleteTarget(session)}
                      >
                        Hapus Permanen
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </section>

      <Modal
        isOpen={permanentDeleteTarget !== null}
        onClose={() => {
          if (!permanentDeleteMutation.isPending) setPermanentDeleteTarget(null);
        }}
        title="Hapus permanen sesi absensi?"
        subtitle="Tindakan ini menghapus data dari database dan tidak dapat dibatalkan."
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setPermanentDeleteTarget(null)}
              disabled={permanentDeleteMutation.isPending}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="danger"
              isLoading={permanentDeleteMutation.isPending}
              disabled={!permanentDeleteTarget}
              onClick={() => {
                if (permanentDeleteTarget) permanentDeleteMutation.mutate(permanentDeleteTarget);
              }}
            >
              Hapus Permanen Sekarang
            </Button>
          </>
        }
      >
        {permanentDeleteTarget && (
          <div className="space-y-3">
            <p className="text-sm text-slate-700">
              Sesi <strong>{latestVersion(permanentDeleteTarget)?.name ?? permanentDeleteTarget.key}</strong>{' '}
              ({permanentDeleteTarget.key}) akan dihapus permanen dari database, termasuk:
            </p>
            <ul className="list-inside list-disc rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
              <li>Seluruh riwayat koreksi absensi sesi ini.</li>
              <li>Seluruh data absensi karyawan pada sesi ini.</li>
              <li>Seluruh jadwal harian dan versi jadwal sesi ini.</li>
              <li>Definisi sesi itu sendiri; key tidak akan digunakan kembali.</li>
            </ul>
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-700">
              Data yang dihapus tidak dapat dikembalikan. Rentang waktu sesi ini akan tersedia untuk
              sesi baru. Karyawan, admin, perangkat, sesi login, dan sesi lain tidak terpengaruh.
            </p>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={editor !== null}
        onClose={() => {
          if (!saveMutation.isPending) setEditor(null);
        }}
        title={editor?.mode === 'create' ? 'Tambah Sesi Absensi' : 'Buat Versi Sesi Baru'}
        subtitle={editor?.mode === 'create'
          ? 'Identitas sesi dibuat otomatis oleh backend dan tidak bergantung pada nama.'
          : `Perubahan untuk ${editor?.key} berlaku langsung pada tanggal bisnis hari ini; versi sebelum hari ini tetap tersimpan.`}
        maxWidth="2xl"
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setEditor(null)} disabled={saveMutation.isPending}>
              Batal
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (editor && !validationError) saveMutation.mutate(editor);
              }}
              isLoading={saveMutation.isPending}
              disabled={!editor || Boolean(validationError)}
            >
              {editor?.mode === 'create' ? 'Simpan Sesi' : 'Simpan Versi Baru'}
            </Button>
          </>
        }
      >
        {editor && (
          <div className="space-y-5">
            {editor.mode === 'create' && (
              <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
                Backend akan membuat ID dan session key baru secara otomatis. Identitas sesi tetap
                sama meskipun nama sesi diubah.
              </p>
            )}
            {editor.mode === 'version' && !editor.draft.isActive && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
                Perubahan ini menonaktifkan sesi langsung pada tanggal bisnis hari ini (Asia/Jakarta).
                Versi dan presensi historis tetap dipertahankan.
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Nama tampilan sesi"
                value={editor.draft.name}
                onChange={(event) => updateDraft({ name: event.target.value })}
                maxLength={100}
                required
                placeholder="Nama yang ditampilkan"
              />
              <Input
                label="Urutan tampilan"
                type="number"
                min={0}
                max={1_000_000}
                step={1}
                value={editor.draft.sortOrder}
                onChange={(event) => updateDraft({ sortOrder: event.target.value })}
                required
              />
              <Input
                label="Jam mulai"
                type="time"
                value={editor.draft.startTime}
                onChange={(event) => updateDraft({ startTime: event.target.value })}
                required
              />
              <Input
                label="Jam berakhir"
                type="time"
                value={editor.draft.endTime}
                onChange={(event) => updateDraft({ endTime: event.target.value })}
                required
              />
              <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-slate-900"
                  checked={editor.draft.isActive}
                  onChange={(event) => updateDraft({ isActive: event.target.checked })}
                />
                <span>
                  <span className="block text-xs font-semibold">Sesi aktif</span>
                  <span className="block text-[11px] text-slate-500">Penonaktifan langsung tersedia melalui tombol Nonaktifkan Sesi.</span>
                </span>
              </label>
            </div>

            {editor.mode === 'version' && (() => {
              const session = sessions.find((item) => item.key === editor.key);
              const previous = session ? latestVersion(session) : undefined;
              return previous && !previous.startTime && !legacyUniformTime(previous) ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
                  Versi terakhir masih menyimpan jam berbeda per hari. Masukkan satu rentang jam untuk
                  menerapkan konfigurasi global Senin–Jumat; data versi lama tidak akan diubah.
                </div>
              ) : null;
            })()}

            <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
              Jam sesi berlaku otomatis setiap hari kerja (Senin–Jumat). Sabtu dan Minggu tidak
              memiliki sesi absensi. Zona waktu Asia/Jakarta; mulai inklusif, berakhir eksklusif,
              dan sesi tidak dapat melintasi tengah malam.
            </p>
            <p className="text-[11px] text-slate-500">
              Perubahan berlaku langsung pada tanggal bisnis hari ini ({formatDate(today)}) setelah
              berhasil disimpan; penyimpanan berikutnya pada hari yang sama menggantikan jadwal hari
              ini. Versi sebelum hari ini tetap tersimpan.
            </p>

            {validationError && (
              <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-700">
                {validationError}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
