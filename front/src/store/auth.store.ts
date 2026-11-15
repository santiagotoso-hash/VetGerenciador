import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { Billing } from '@/lib/billing';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  companyId?: string | null;
  company?: { id: string; name: string; logo?: string | null; billing?: Billing | null } | null;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  setAuth: (user: AuthUser, token: string) => void;
  logout: () => void;
}

// O interceptor do axios (lib/api.ts) lê o token direto do localStorage.
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      setAuth: (user, accessToken) => {
        localStorage.setItem('accessToken', accessToken);
        set({ user, accessToken });
      },
      logout: () => {
        localStorage.removeItem('accessToken');
        set({ user: null, accessToken: null });
      },
    }),
    { name: 'auth-storage' },
  ),
);
