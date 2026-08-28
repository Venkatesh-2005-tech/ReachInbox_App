'use client';

import React from 'react';
import { Header } from './Header';
import type { User } from '@/types/auth';

interface DashboardLayoutProps {
  user: User;
  onLogout: () => void;
  children: React.ReactNode;
}

export function DashboardLayout({ user, onLogout, children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={user} onLogout={onLogout} />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
