'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ComposeEmail } from '@/components/email/ComposeEmail';
import { ScheduledEmails } from '@/components/email/ScheduledEmails';
import { SentEmails } from '@/components/email/SentEmails';
import { SlackConnection } from '@/components/slack/SlackConnection';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/Toast';

type Tab = 'scheduled' | 'sent';

// Separated into its own component so useSearchParams is inside a Suspense boundary
function SlackRedirectHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get('slack') === 'connected') {
      toast.success('Slack connected successfully!');
      router.replace('/dashboard');
    }
  }, [searchParams, router]);

  return null;
}

function DashboardContent() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('scheduled');
  const [composeOpen, setComposeOpen] = useState(false);
  const [scheduledKey, setScheduledKey] = useState(0);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loading text="Loading your workspace..." />
      </div>
    );
  }

  const handleScheduled = () => {
    setComposeOpen(false);
    setTab('scheduled');
    setScheduledKey((k) => k + 1);
    toast.success('Emails scheduled! Check the Scheduled tab.');
  };

  return (
    <DashboardLayout user={user} onLogout={logout}>
      {/* Top bar */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-0.5 text-sm text-gray-500">Manage your email campaigns</p>
        </div>
        <div className="flex items-center gap-3">
          <SlackConnection />
          <Button size="md" onClick={() => setComposeOpen(true)}>
            <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Compose New Email
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex gap-6" aria-label="Tabs">
          {(['scheduled', 'sent'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`whitespace-nowrap border-b-2 pb-3 text-sm font-medium transition-colors capitalize ${
                tab === t
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              {t === 'scheduled' ? 'Scheduled Emails' : 'Sent Emails'}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div>
        {tab === 'scheduled' && <ScheduledEmails key={scheduledKey} />}
        {tab === 'sent' && <SentEmails />}
      </div>

      {/* Compose Modal */}
      <Modal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        title="Compose New Email Campaign"
        size="xl"
      >
        <ComposeEmail onScheduled={handleScheduled} />
      </Modal>
    </DashboardLayout>
  );
}

export default function DashboardPage() {
  return (
    <>
      <Suspense fallback={null}>
        <SlackRedirectHandler />
      </Suspense>
      <DashboardContent />
    </>
  );
}
