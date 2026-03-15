'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { DashboardData } from '@/types';
import { fetchDashboardData } from '@/lib/api';

interface AuthContextType {
  token: string | null;
  data: DashboardData | null;
  isLoading: boolean;
  error: string | null;
  login: (token: string) => Promise<boolean>;
  logout: () => void;
  refreshData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (tk: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchDashboardData(tk);
      setToken(tk);
      setData(result);
      setIsLoading(false);
      return true;
    } catch (e: unknown) {
      setIsLoading(false);
      if (e instanceof Error && e.message === 'UNAUTHORIZED') {
        setError('Identifiants invalides');
      } else {
        setError('Erreur de connexion au serveur');
      }
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setData(null);
    setError(null);
  }, []);

  const refreshData = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const result = await fetchDashboardData(token);
      setData(result);
    } catch (e) {
      console.error('Refresh error:', e);
    }
    setIsLoading(false);
  }, [token]);

  return (
    <AuthContext.Provider value={{ token, data, isLoading, error, login, logout, refreshData }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
