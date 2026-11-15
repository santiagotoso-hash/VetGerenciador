'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { AppLayout } from '@/components/layout/AppLayout';

// Guarda de autenticação: sem token, volta pro login.
export default function AuthedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const role = useAuthStore((s) => s.user?.role);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('accessToken')) router.replace('/login');
    else setReady(true);
  }, [router]);

  // superadmin só enxerga a gestão de empresas
  useEffect(() => {
    if (ready && role === 'SUPER_ADMIN' && !pathname.startsWith('/empresas')) router.replace('/empresas');
  }, [ready, role, pathname, router]);

  if (!ready) return null;
  return <AppLayout>{children}</AppLayout>;
}
