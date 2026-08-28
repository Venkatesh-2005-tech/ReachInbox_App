'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchCurrentUser, redirectToGoogle } from '@/lib/auth';
import { authApi } from '@/lib/api';
import type { User } from '@/types/auth';

interface UseAuthReturn {
  user: User | null;
  loading: boolean;
  login: () => void;
  logout: () => Promise<void>;
  refetch: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const u = await fetchCurrentUser();
    setUser(u);
    setLoading(false);
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const login = () => {
    redirectToGoogle();
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      window.location.href = '/login';
    }
  };

  return { user, loading, login, logout, refetch };
}
