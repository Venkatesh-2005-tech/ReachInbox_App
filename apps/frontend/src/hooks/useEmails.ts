'use client';

import { useState, useCallback } from 'react';
import { emailsApi } from '@/lib/api';
import type { Email } from '@/types/email';
import type { PaginatedResponse } from '@/types/api';

interface UseEmailsReturn {
  data: PaginatedResponse<Email> | null;
  loading: boolean;
  error: string | null;
  refetch: (page?: number) => Promise<void>;
}

export function useScheduledEmails(initialPage = 1): UseEmailsReturn {
  const [data, setData] = useState<PaginatedResponse<Email> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async (page = initialPage) => {
    setLoading(true);
    setError(null);
    try {
      const result = await emailsApi.scheduled(page);
      setData(result);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to load scheduled emails';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [initialPage]);

  return { data, loading, error, refetch };
}

export function useSentEmails(initialPage = 1): UseEmailsReturn {
  const [data, setData] = useState<PaginatedResponse<Email> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async (page = initialPage) => {
    setLoading(true);
    setError(null);
    try {
      const result = await emailsApi.sent(page);
      setData(result);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to load sent emails';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [initialPage]);

  return { data, loading, error, refetch };
}
