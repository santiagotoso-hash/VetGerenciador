'use client';
import { useState } from 'react';
import Link from 'next/link';
import { api, errorMessage } from '@/lib/api';
import { ErrorBox, Field, btnPrimary, inputCls } from '@/components/ui';

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch (err) {
      setError((err as any)?.response?.status === 429 ? 'Muitas tentativas. Aguarde um minuto e tente de novo.' : errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-50 to-white p-4">
      <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-8 shadow-lg">
        <div className="text-center">
          <div className="text-4xl">🔑</div>
          <h1 className="mt-2 text-2xl font-bold text-primary-700">Esqueci minha senha</h1>
        </div>
        {sent ? (
          <>
            <p className="rounded-lg bg-green-50 px-3 py-3 text-sm text-green-700">
              Se o e-mail <strong>{email}</strong> estiver cadastrado, enviamos um link para redefinir a senha. Ele vale por 1 hora. Confira também a caixa de spam.
            </p>
            <Link href="/login" className={`${btnPrimary} w-full`}>Voltar para o login</Link>
          </>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <p className="text-sm text-gray-500">Informe o e-mail da sua conta e enviaremos um link para você criar uma nova senha.</p>
            <ErrorBox message={error} />
            <Field label="E-mail">
              <input type="email" required autoComplete="username" autoFocus className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>{busy ? 'Enviando…' : 'Enviar link'}</button>
            <div className="text-center"><Link href="/login" className="text-sm text-primary-600 hover:underline">Voltar para o login</Link></div>
          </form>
        )}
      </div>
    </div>
  );
}
