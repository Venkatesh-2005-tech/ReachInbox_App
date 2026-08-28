'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { slackApi } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import type { SlackStatus } from '@/types/api';

export function SlackConnection() {
  const [status, setStatus] = useState<SlackStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    slackApi.status().then(setStatus).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleConnect = () => {
    window.location.href = slackApi.connectUrl();
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await slackApi.disconnect();
      setStatus({ connected: false, connection: null });
      toast.success('Slack disconnected');
    } catch {
      toast.error('Failed to disconnect Slack');
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />;
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
      {/* Slack logo */}
      <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5.042 15.165a2.528 2.528 0 01-2.52 2.523A2.528 2.528 0 010 15.165a2.527 2.527 0 012.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 012.521-2.52 2.527 2.527 0 012.521 2.52v6.313A2.528 2.528 0 018.834 24a2.528 2.528 0 01-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 01-2.521-2.52A2.528 2.528 0 018.834 0a2.528 2.528 0 012.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 012.521 2.521 2.528 2.528 0 01-2.521 2.521H2.522A2.528 2.528 0 010 8.834a2.528 2.528 0 012.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 012.522-2.521A2.528 2.528 0 0124 8.834a2.528 2.528 0 01-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 01-2.523 2.521 2.527 2.527 0 01-2.52-2.521V2.522A2.527 2.527 0 0115.165 0a2.528 2.528 0 012.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 012.523 2.522A2.528 2.528 0 0115.165 24a2.527 2.527 0 01-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 01-2.52-2.523 2.526 2.526 0 012.52-2.52h6.313A2.527 2.527 0 0124 15.165a2.528 2.528 0 01-2.522 2.523h-6.313z" fill="#E01E5A"/>
      </svg>

      {status?.connected ? (
        <>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">Slack Connected</p>
            {status.connection?.teamId && (
              <p className="text-xs text-gray-500 truncate">Team: {status.connection.teamId}</p>
            )}
          </div>
          <span className="h-2 w-2 rounded-full bg-green-400" aria-label="Connected" />
          <Button variant="ghost" size="sm" loading={disconnecting} onClick={handleDisconnect}>
            Disconnect
          </Button>
        </>
      ) : (
        <>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">Slack</p>
            <p className="text-xs text-gray-500">Not connected</p>
          </div>
          <Button variant="secondary" size="sm" onClick={handleConnect}>
            Connect Slack
          </Button>
        </>
      )}
    </div>
  );
}
