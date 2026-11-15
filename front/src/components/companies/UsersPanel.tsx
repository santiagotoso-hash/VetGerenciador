'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '@/lib/api';
import type { Role } from '@/types';
import { btnPrimary, ErrorBox, inputCls } from '@/components/ui';

const roleLabel: Partial<Record<Role, string>> = {
  ADMIN: 'Administrador',
  RECEPTIONIST: 'Atendente',
  VETERINARIAN: 'Veterinário',
  GROOMER: 'Banho e tosa',
};

interface CompanyUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  lastLoginAt?: string | null;
}

const when = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'nunca entrou';

/** Usuários de uma empresa (superadmin): redefinir senha, ativar/desativar e adicionar. */
export function UsersPanel({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [nu, setNu] = useState({ name: '', email: '', password: '', role: 'RECEPTIONIST' });

  const { data: usage } = useQuery({
    queryKey: ['companies', companyId, 'usage'],
    queryFn: async () => (await api.get<{ users: CompanyUser[] }>(`/companies/${companyId}/usage`)).data,
  });
  const users = usage?.users ?? [];

  const refresh = (done: string) => {
    qc.invalidateQueries({ queryKey: ['companies'] });
    setError('');
    setMessage(done);
  };
  const add = useMutation({
    mutationFn: async () => api.post(`/companies/${companyId}/users`, nu),
    onSuccess: () => {
      refresh('Usuário adicionado.');
      setNu({ name: '', email: '', password: '', role: 'RECEPTIONIST' });
    },
    onError: (e) => setError(errorMessage(e)),
  });
  const patch = useMutation({
    mutationFn: async (v: { userId: string; data: { active?: boolean; password?: string }; done: string }) => {
      await api.patch(`/companies/${companyId}/users/${v.userId}`, v.data);
      return v.done;
    },
    onSuccess: refresh,
    onError: (e) => setError(errorMessage(e)),
  });

  return (
    <div>
      <ErrorBox message={error} />
      {message && <p className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>}
      <ul className="divide-y divide-gray-100 text-sm">
        {users.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center gap-2 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">
                {u.name} <span className="font-normal text-gray-500">· {roleLabel[u.role]}</span>
                {!u.active && <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">Desativado</span>}
              </div>
              <div className="truncate text-xs text-gray-500">{u.email} · último acesso: {when(u.lastLoginAt)}</div>
            </div>
            <button
              className="text-primary-600 hover:underline"
              onClick={() => {
                const password = prompt(`Nova senha para ${u.email} (mínimo 6 caracteres):`);
                if (password) patch.mutate({ userId: u.id, data: { password }, done: `Senha de ${u.email} redefinida.` });
              }}
            >
              Redefinir senha
            </button>
            <button
              className={u.active ? 'text-red-500 hover:underline' : 'text-primary-600 hover:underline'}
              onClick={() =>
                (!u.active || confirm(`Desativar ${u.email}? Esta pessoa perde o acesso na hora.`)) &&
                patch.mutate({ userId: u.id, data: { active: !u.active }, done: u.active ? 'Usuário desativado.' : 'Usuário ativado.' })
              }
            >
              {u.active ? 'Desativar' : 'Ativar'}
            </button>
          </li>
        ))}
      </ul>

      <form
        className="mt-4 space-y-2 border-t border-gray-100 pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate();
        }}
      >
        <p className="text-xs font-semibold uppercase text-gray-500">Adicionar usuário</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <input required className={inputCls} placeholder="Nome" value={nu.name} onChange={(e) => setNu({ ...nu, name: e.target.value })} />
          <select className={inputCls} value={nu.role} onChange={(e) => setNu({ ...nu, role: e.target.value })}>
            {Object.entries(roleLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input required type="email" className={inputCls} placeholder="E-mail" value={nu.email} onChange={(e) => setNu({ ...nu, email: e.target.value })} />
          <input required minLength={6} className={inputCls} placeholder="Senha inicial" value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} />
        </div>
        <div className="flex justify-end pt-1">
          <button type="submit" className={btnPrimary} disabled={add.isPending}>{add.isPending ? 'Adicionando…' : 'Adicionar'}</button>
        </div>
      </form>
    </div>
  );
}
