import { authApi } from './api';
import type { User } from '@/types/auth';

export async function fetchCurrentUser(): Promise<User | null> {
  try {
    return await authApi.getMe();
  } catch {
    return null;
  }
}

export function redirectToGoogle(): void {
  window.location.href = authApi.googleLoginUrl();
}
