'use client';

import React from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import type { User } from '@/types/auth';

interface HeaderProps {
  user: User;
  onLogout: () => void;
}

export function Header({ user, onLogout }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex items-center gap-3">
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
          <span className="text-lg font-bold text-gray-900">ReachInbox</span>
        </div>

        {/* User menu */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex sm:flex-col sm:items-end">
            <span className="text-sm font-medium text-gray-900">{user.name}</span>
            <span className="text-xs text-gray-500">{user.email}</span>
          </div>
          {user.avatar ? (
            <Image
              src={user.avatar}
              alt={user.name}
              width={36}
              height={36}
              className="rounded-full ring-2 ring-brand-200"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
              {user.name[0]?.toUpperCase() ?? '?'}
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={onLogout}>
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
