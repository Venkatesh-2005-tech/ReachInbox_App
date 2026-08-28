'use client';

import React, { useEffect } from 'react';
import { EmailTable } from './EmailTable';
import { Loading } from '@/components/ui/Loading';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { useScheduledEmails } from '@/hooks/useEmails';

export function ScheduledEmails() {
  const { data, loading, error, refetch } = useScheduledEmails();

  useEffect(() => {
    refetch();
  }, [refetch]);

  if (loading) return <Loading text="Loading scheduled emails..." />;

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-700">{error}</p>
        <Button variant="secondary" size="sm" className="mt-3" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  const emails = data?.emails ?? [];

  if (emails.length === 0) {
    return (
      <EmptyState
        title="No scheduled emails"
        description="Use 'Compose New Email' to schedule your first campaign."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {data?.total ?? 0} email{(data?.total ?? 0) !== 1 ? 's' : ''} scheduled
        </p>
        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>
      <EmailTable emails={emails} mode="scheduled" />
      {(data?.pages ?? 0) > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: data!.pages }, (_, i) => (
            <button
              key={i}
              onClick={() => refetch(i + 1)}
              className={`h-8 w-8 rounded text-sm ${
                data!.page === i + 1
                  ? 'bg-brand-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
