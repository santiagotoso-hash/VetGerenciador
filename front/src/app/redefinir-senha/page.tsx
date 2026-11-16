'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, errorMessage } from '@/lib/api';
import { ErrorBox, Field, PasswordInput, btnPrimary } from '@/components/ui';

export default function RedefinirSenhaPage() {
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get('token') ?? '');
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      return setError('A senha deve ter pelo menos 8 caracteres, com letras e números.');
    }
    if (password !== confirm) return setError('As senhas não conferem.');
    setBusy(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
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
          <h1 className="mt-2 text-2xl font-bold text-primary-700">Nova senha</h1>
        </div>
        {token === null ? null : done ? (
          <>
            <p className="rounded-lg bg-green-50 px-3 py-3 text-sm text-green-700">Senha alterada com sucesso! Entre com a nova senha.</p>
            <Link href="/login" className={`${btnPrimary} w-full`}>Ir para o login</Link>
          </>
        ) : !token ? (
          <>
            <p className="rounded-lg bg-red-50 px-3 py-3 text-sm text-red-700">Link inválido. Peça um novo em “Esqueci minha senha”.</p>
            <Link href="/esqueci-senha" className={`${btnPrimary} w-full`}>Pedir novo link</Link>
          </>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <ErrorBox message={error} />
            <Field label="Nova senha">
              <PasswordInput autoComplete="new-password" autoFocus required value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <Field label="Repita a nova senha">
              <PasswordInput autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </Field>
            <p className="text-xs text-gray-500">Mínimo de 8 caracteres, com letras e números.</p>
            <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>{busy ? 'Salvando…' : 'Salvar nova senha'}</button>
            <div className="text-center"><Link href="/login" className="text-sm text-primary-600 hover:underline">Voltar para o login</Link></div>
          </form>
        )}
      </div>
    </div>
  );
}
