import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { CurrentAdmin, LoginResponse, MeResponse } from '../types/auth';
import { ApiClientError } from '../lib/api';

interface AuthContextType {
  admin: CurrentAdmin | null;
  isLoading: boolean;
  backendUnavailable: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearAdmin: () => void;
  refreshAdmin: () => Promise<void>;
  retrySession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [admin, setAdmin] = useState<CurrentAdmin | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [backendUnavailable, setBackendUnavailable] = useState(false);

  // Checks session through official backend endpoint GET /api/auth/me using HttpOnly cookie
  const checkSession = useCallback(async () => {
    try {
      const res = await api.get<MeResponse>('/auth/me');
      if (res?.success && res.data?.admin) setAdmin(res.data.admin);
      else setAdmin(null);
      setBackendUnavailable(false);
    } catch (error) {
      if (error instanceof ApiClientError && error.statusCode === 401) {
        setAdmin(null);
        setBackendUnavailable(false);
      } else {
        setBackendUnavailable(true);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();

    const handleUnauthorized = () => {
      setAdmin(null);
    };

    window.addEventListener('app:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('app:unauthorized', handleUnauthorized);
    };
  }, [checkSession]);

  const login = async (username: string, password: string) => {
    try {
      const res = await api.post<LoginResponse>('/auth/login', { username, password });
      if (!res?.success) throw new Error('Login gagal. Periksa username dan password.');
      const profile = await api.get<MeResponse>('/auth/me');
      if (!profile?.success || !profile.data?.admin) throw new Error('Sesi belum dapat dikonfirmasi.');
      setAdmin(profile.data.admin);
      setBackendUnavailable(false);
    } catch (err: any) {
      if (!(err instanceof ApiClientError) || err.statusCode !== 0) setAdmin(null);
      throw err;
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
      setAdmin(null);
      setBackendUnavailable(false);
    } catch (err) {
      if (err instanceof ApiClientError && err.statusCode === 401) {
        setAdmin(null);
        setBackendUnavailable(false);
        return;
      }
      throw err;
    }
  };

  const refreshAdmin = async () => {
    try {
      const res = await api.get<MeResponse>('/auth/me');
      if (res && res.success && res.data?.admin) {
        setAdmin(res.data.admin);
      }
    } catch {
      console.warn('Failed to refresh admin session');
    }
  };

  const clearAdmin = () => {
    setAdmin(null);
    setBackendUnavailable(false);
  };

  return (
    <AuthContext.Provider value={{ admin, isLoading, backendUnavailable, login, logout, clearAdmin, refreshAdmin, retrySession: checkSession }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
