'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, errorMessage } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import type { AuthResponse } from '@/types';
import { ErrorBox, Field, btnPrimary, inputCls } from '@/components/ui';
import { whatsappUrl } from '@/lib/format';
import { LITOCODE_WHATSAPP } from '@/lib/brand';

const schema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Informe a senha'),
});
type Form = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState('');

  // motivo do bloqueio (empresa sem pagamento), guardado quando a API respondeu 402 durante o uso
  useEffect(() => {
    try {
      const notice = sessionStorage.getItem('login-notice');
      if (notice) {
        setError(notice);
        sessionStorage.removeItem('login-notice');
      }
    } catch {
      /* ignora */
    }
  }, []);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: Form) => {
    setError('');
    try {
      const res = await api.post<AuthResponse>('/auth/login', data);
      setAuth(res.data.user, res.data.accessToken);
      router.push(res.data.user.role === 'SUPER_ADMIN' ? '/empresas' : '/dashboard');
    } catch (e) {
      setError((e as any)?.response?.status === 401 ? 'E-mail ou senha incorretos' : errorMessage(e));
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-br from-primary-50 to-white p-4">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-8 shadow-lg"
      >
        <div className="text-center">
          <div className="text-4xl">🐾</div>
          <h1 className="mt-2 text-2xl font-bold text-primary-700">VetPet Manager</h1>
          <p className="text-sm text-gray-500">Entre para continuar</p>
        </div>
        <ErrorBox message={error} />
        <Field label="E-mail" error={errors.email?.message}>
          <input type="email" autoComplete="username" className={inputCls} {...register('email')} />
        </Field>
        <Field label="Senha" error={errors.password?.message}>
          <input type="password" autoComplete="current-password" className={inputCls} {...register('password')} />
        </Field>
        <button type="submit" disabled={isSubmitting} className={`${btnPrimary} w-full`}>
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </button>
      </form>

      <LitoCodeCredit />
    </div>
  );
}

function LitoCodeCredit() {
  const content = (
    <>
      <span className="text-xs text-gray-500">Criado por</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/litocode/logo.svg" alt="LitoCode" className="h-7 w-auto" />
    </>
  );
  const cls = 'flex items-center gap-2';
  if (!LITOCODE_WHATSAPP) return <div className={cls}>{content}</div>;
  return (
    <a
      href={whatsappUrl(LITOCODE_WHATSAPP, 'Olá! Vi o sistema e gostaria de falar com a LitoCode.')}
      target="_blank"
      rel="noopener noreferrer"
      title="Falar com a LitoCode no WhatsApp"
      className={`${cls} opacity-90 transition hover:opacity-100`}
    >
      {content}
    </a>
  );
}
