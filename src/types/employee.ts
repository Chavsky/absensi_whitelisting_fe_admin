export interface EmployeeDevice {
  status: string;
  deviceName?: string | null;
  activatedAt?: string | null;
  lastUsedAt?: string | null;
  revokedAt?: string | null;
}

export interface Employee {
  nik: string;
  namaLengkap: string;
  isActive: boolean;
  device?: EmployeeDevice | null;
  createdAt: string;
}

export interface EmployeeListResponse {
  success: boolean;
  data: Employee[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface EmployeeDetailResponse {
  success: boolean;
  data: Employee;
}
