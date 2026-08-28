'use client';

import React from 'react';
import type { User } from '@/types/auth';
import Image from 'next/image';

interface UserMenuProps {
  user: User;
  onLogout: () => void;
}

export function UserMenu({ user, onLogout }: UserMenuProps) {
  return (
    <div className="flex items-center gap-3">
      {user.avatar ? (
        <Image src={user.avatar} alt={user.name} width={32} height={32} className="rounded-full" />
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-sm font-medium text-white">
          {user.name[0]?.toUpperCase()}
        </div>
      )}
      <span className="text-sm font-medium text-gray-700">{user.name}</span>
      <button
        onClick={onLogout}
        className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        Sign out
      </button>
    </div>
  );
}
