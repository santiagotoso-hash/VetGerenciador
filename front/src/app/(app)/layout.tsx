'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';

// Guarda de autenticação: sem token, volta pro login.
export default function AuthedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('accessToken')) router.replace('/login');
    else setReady(true);
  }, [router]);

  if (!ready) return null;
  return <AppLayout>{children}</AppLayout>;
}
