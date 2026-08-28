'use client';

import React from 'react';
import { Table } from '@/components/ui/Table';
import { formatDate, formatRelative } from '@/lib/utils';
import type { Email, EmailStatus } from '@/types/email';

interface EmailTableProps {
  emails: Email[];
  mode: 'scheduled' | 'sent';
}

const statusColors: Record<EmailStatus, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-700',
  PROCESSING: 'bg-yellow-100 text-yellow-700',
  SENT: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
};

function StatusBadge({ status }: { status: EmailStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[status]}`}>
      {status.toLowerCase()}
    </span>
  );
}

export function EmailTable({ emails, mode }: EmailTableProps) {
  const columns =
    mode === 'scheduled'
      ? [
          {
            key: 'recipient',
            header: 'Email',
            render: (row: Email) => <span className="font-medium">{row.recipient}</span>,
          },
          { key: 'subject', header: 'Subject', render: (row: Email) => row.subject },
          {
            key: 'scheduledAt',
            header: 'Scheduled Time',
            render: (row: Email) => (
              <span title={formatDate(row.scheduledAt)}>{formatRelative(row.scheduledAt)}</span>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            render: (row: Email) => <StatusBadge status={row.status} />,
          },
        ]
      : [
          {
            key: 'recipient',
            header: 'Email',
            render: (row: Email) => <span className="font-medium">{row.recipient}</span>,
          },
          { key: 'subject', header: 'Subject', render: (row: Email) => row.subject },
          {
            key: 'sentAt',
            header: 'Sent Time',
            render: (row: Email) =>
              row.sentAt ? (
                <span title={formatDate(row.sentAt)}>{formatRelative(row.sentAt)}</span>
              ) : (
                <span className="text-gray-400">—</span>
              ),
          },
          {
            key: 'status',
            header: 'Status',
            render: (row: Email) => (
              <div>
                <StatusBadge status={row.status} />
                {row.errorMessage && (
                  <p className="mt-1 text-xs text-red-500 truncate max-w-xs" title={row.errorMessage}>
                    {row.errorMessage}
                  </p>
                )}
              </div>
            ),
          },
        ];

  return <Table columns={columns} data={emails} keyExtractor={(row) => row.id} />;
}
