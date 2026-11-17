const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export class ApiClientError extends Error {
  statusCode: number;
  data: any;

  constructor(message: string, statusCode: number, data?: any) {
    super(message);
    this.name = 'ApiClientError';
    this.statusCode = statusCode;
    this.data = data;
  }
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined | null>;
}

export async function apiClient<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { params, headers, ...customConfig } = options;

  let url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  const defaultHeaders: HeadersInit = {
    'Accept': 'application/json',
  };

  if (!(customConfig.body instanceof FormData)) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  // Pure HttpOnly cookie credentials - NO Bearer tokens, NO X-Admin-Session header, NO storage tokens
  const config: RequestInit = {
    method: 'GET',
    credentials: 'include',
    headers: {
      ...defaultHeaders,
      ...headers,
    },
    ...customConfig,
  };

  let response: Response;
  try {
    response = await fetch(url, config);
  } catch (err: any) {
    throw new ApiClientError(
      `Tidak dapat terhubung ke server backend di ${API_BASE_URL}. Pastikan backend absensi (Express/PostgreSQL) sudah berjalan.`,
      0,
      err
    );
  }

  let data: any;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorMessage = response.status === 400 ? 'Data yang dikirim tidak valid.'
      : response.status === 401 ? 'Sesi tidak valid atau kredensial tidak cocok.'
      : response.status === 403 ? 'Anda tidak memiliki izin untuk melakukan tindakan ini.'
      : response.status === 404 ? 'Data atau layanan yang diminta tidak ditemukan.'
      : response.status === 409 ? 'Terjadi konflik data. Periksa username atau status akun.'
      : response.status >= 500 ? 'Server mengalami gangguan. Coba lagi nanti.'
      : `Permintaan gagal (HTTP ${response.status}).`;

    // Handle 401 unauthorized notifications globally
    if (response.status === 401 && !endpoint.includes('/auth/login')) {
      window.dispatchEvent(new CustomEvent('app:unauthorized'));
    }

    throw new ApiClientError(errorMessage, response.status, data);
  }

  return data as T;
}

export const api = {
  get: <T = any>(endpoint: string, params?: Record<string, any>) =>
    apiClient<T>(endpoint, { method: 'GET', params }),

  post: <T = any>(endpoint: string, body?: any) =>
    apiClient<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T = any>(endpoint: string, body?: any) =>
    apiClient<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T = any>(endpoint: string) =>
    apiClient<T>(endpoint, { method: 'DELETE' }),

  downloadFile: async (endpoint: string, params?: Record<string, any>, defaultFilename = 'laporan-absensi.csv'): Promise<void> => {
    let url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += (url.includes('?') ? '&' : '?') + queryString;
      }
    }

    let response: Response;
    try {
      response = await fetch(url, { method: 'GET', credentials: 'include' });
    } catch {
      throw new ApiClientError('Tidak dapat terhubung ke server backend. Periksa koneksi lalu coba lagi.', 0);
    }

    if (!response.ok) {
      const errMessage = response.status === 401 ? 'Sesi tidak valid atau telah berakhir.'
        : response.status === 403 ? 'Anda tidak memiliki izin untuk mengunduh laporan.'
        : response.status === 409 ? 'Permintaan ekspor mengalami konflik.'
        : response.status >= 500 ? 'Server mengalami gangguan. Coba lagi nanti.'
        : `Ekspor gagal (HTTP ${response.status}).`;
      if (response.status === 401) window.dispatchEvent(new CustomEvent('app:unauthorized'));
      throw new ApiClientError(errMessage, response.status);
    }

    const blob = await response.blob();
    const contentDisposition = response.headers.get('content-disposition');
    let filename = defaultFilename;
    if (contentDisposition) {
      const match = contentDisposition.match(/filename=["']?([^"';]+)["']?/i);
      if (match && match[1]) {
        filename = match[1];
      }
    }

    const objectUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(objectUrl);
  },
};

