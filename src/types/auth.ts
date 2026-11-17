export interface CurrentAdmin {
  id: number;
  username: string;
  namaLengkap: string;
  isActive: boolean;
  createdAt?: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  data?: { admin: Pick<CurrentAdmin, 'id' | 'username' | 'namaLengkap'> };
}

export interface MeResponse {
  success: boolean;
  data: { admin: CurrentAdmin };
}

export interface ApiError {
  success: false;
  message: string;
  statusCode?: number;
}
