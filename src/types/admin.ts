export interface AdminAccount {
  id: number;
  username: string;
  namaLengkap: string;
  isActive: boolean;
  createdAt: string;
}

export interface AdminListResponse {
  success: boolean;
  data: AdminAccount[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface AdminDetailResponse {
  success: boolean;
  data: AdminAccount;
}
