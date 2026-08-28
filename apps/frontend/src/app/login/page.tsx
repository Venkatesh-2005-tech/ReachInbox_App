'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { GoogleLoginButton } from '@/components/auth/GoogleLoginButton';
import { useAuth } from '@/hooks/useAuth';

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-brand-50 via-white to-indigo-50">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600">
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <span className="text-xl font-bold text-gray-900">ReachInbox</span>
        </div>
      </nav>

      {/* Hero */}
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-gray-200 bg-white p-10 shadow-xl">
            {/* Logo */}
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 shadow-lg">
                <svg className="h-9 w-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Welcome to ReachInbox</h1>
              <p className="mt-2 text-sm text-gray-500">
                Schedule and manage your email campaigns at scale
              </p>
            </div>

            {/* Features */}
            <ul className="mb-8 space-y-2 text-sm text-gray-600">
              {[
                'Schedule campaigns to thousands of recipients',
                'Automatic rate limiting & retry handling',
                'Real-time job queue with Bull Board',
                'Slack notifications when limits are reached',
              ].map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>

            <GoogleLoginButton onClick={login} loading={loading} />

            <p className="mt-6 text-center text-xs text-gray-400">
              By signing in you agree to our Terms of Service and Privacy Policy.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} ReachInbox. All rights reserved.
      </footer>
    </div>
  );
}
