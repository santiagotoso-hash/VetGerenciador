'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, errorMessage } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import type { Company, Role } from '@/types';
import { btnGhost, btnPrimary, Card, Empty, ErrorBox, Field, inputCls, Modal, PageHeader } from '@/components/ui';

const roleLabel: Partial<Record<Role, string>> = {
  ADMIN: 'Administrador',
  RECEPTIONIST: 'Atendente',
  VETERINARIAN: 'Veterinário',
  GROOMER: 'Banho e tosa',
};

const person = z.object({
  name: z.string().min(2, 'Informe o nome'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Mínimo de 6 caracteres'),
});
const schema = z.object({
  name: z.string().min(2, 'Informe o nome da empresa'),
  admin: person,
  withAttendant: z.boolean(),
  attendant: z.object({ name: z.string(), email: z.string(), password: z.string() }),
});
type Form = z.infer<typeof schema>;

const emptyForm: Form = {
  name: '',
  admin: { name: '', email: '', password: '' },
  withAttendant: true,
  attendant: { name: 'Atendente', email: '', password: '' },
};

export default function EmpresasPage() {
  const me = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [managing, setManaging] = useState<string | null>(null);
  const [apiError, setApiError] = useState('');

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => (await api.get<Company[]>('/companies')).data,
    enabled: me?.role === 'SUPER_ADMIN',
  });

  const form = useForm<Form>({ resolver: zodResolver(schema), defaultValues: emptyForm });
  const withAttendant = form.watch('withAttendant');

  const create = useMutation({
    mutationFn: async (f: Form) => {
      const att = f.attendant;
      const users = f.withAttendant && att.email ? [{ ...att, role: 'RECEPTIONIST' }] : [];
      return api.post('/companies', { name: f.name, admin: f.admin, ...(users.length && { users }) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['companies'] });
      setCreating(false);
    },
    onError: (e) => setApiError(errorMessage(e)),
  });

  const toggle = useMutation({
    mutationFn: async (c: Company) => api.patch(`/companies/${c.id}`, { active: !c.active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companies'] }),
  });

  if (me && me.role !== 'SUPER_ADMIN') {
    return <Card className="p-10 text-center text-gray-500">Acesso restrito ao superadmin.</Card>;
  }

  const err = form.formState.errors;
  const openCreate = () => {
    setApiError('');
    form.reset(emptyForm);
    setCreating(true);
  };

  return (
    <>
      <PageHeader
        title="Empresas"
        subtitle="Clínicas e petshops que usam o sistema"
        action={<button className={btnPrimary} onClick={openCreate}>+ Nova empresa</button>}
      />

      <Card className="overflow-x-auto">
        {companies.length === 0 ? (
          <Empty>{isLoading ? 'Carregando…' : 'Nenhuma empresa cadastrada'}</Empty>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Empresa</th>
                <th className="hidden px-4 py-3 md:table-cell">Administrador</th>
                <th className="hidden px-4 py-3 sm:table-cell">Dados</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {companies.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="hidden px-4 py-3 text-gray-500 md:table-cell">
                    {c.users?.map((u) => u.email).join(', ') || '—'}
                  </td>
                  <td className="hidden px-4 py-3 text-gray-500 sm:table-cell">
                    {c._count?.users ?? 0} usuário(s) · {c._count?.clients ?? 0} cliente(s) · {c._count?.pets ?? 0} pet(s)
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${c.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {c.active ? 'Ativa' : 'Desativada'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <button className="mr-3 text-primary-600 hover:underline" onClick={() => setManaging(c.id)}>Usuários</button>
                    <button
                      className={c.active ? 'text-red-500 hover:underline' : 'text-primary-600 hover:underline'}
                      onClick={() =>
                        (c.active
                          ? confirm(`Desativar ${c.name}? Os usuários da empresa perdem o acesso até você reativar.`)
                          : true) && toggle.mutate(c)
                      }
                    >
                      {c.active ? 'Desativar' : 'Reativar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={creating} onClose={() => setCreating(false)} title="Nova empresa">
        <form onSubmit={form.handleSubmit((f) => create.mutate(f))} className="space-y-3">
          <ErrorBox message={apiError} />
          <Field label="Nome da empresa *" error={err.name?.message}>
            <input className={inputCls} placeholder="Ex.: VilaPet by Mary" {...form.register('name')} />
          </Field>

          <p className="pt-1 text-xs font-semibold uppercase text-gray-500">Administrador</p>
          <Field label="Nome *" error={err.admin?.name?.message}><input className={inputCls} {...form.register('admin.name')} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="E-mail (login) *" error={err.admin?.email?.message}>
              <input type="email" className={inputCls} {...form.register('admin.email')} />
            </Field>
            <Field label="Senha inicial *" error={err.admin?.password?.message}>
              <input type="text" autoComplete="off" className={inputCls} {...form.register('admin.password')} />
            </Field>
          </div>

          <label className="flex items-center gap-2 pt-1 text-sm">
            <input type="checkbox" {...form.register('withAttendant')} /> Criar também um atendente
          </label>
          {withAttendant && (
            <>
              <Field label="Nome do atendente"><input className={inputCls} {...form.register('attendant.name')} /></Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="E-mail (login)"><input type="email" className={inputCls} {...form.register('attendant.email')} /></Field>
                <Field label="Senha inicial"><input type="text" autoComplete="off" className={inputCls} {...form.register('attendant.password')} /></Field>
              </div>
              <p className="text-xs text-gray-500">Deixe o e-mail em branco para não criar o atendente agora.</p>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className={btnGhost} onClick={() => setCreating(false)}>Cancelar</button>
            <button type="submit" className={btnPrimary} disabled={create.isPending}>{create.isPending ? 'Criando…' : 'Criar empresa'}</button>
          </div>
        </form>
      </Modal>

      <UsersModal companyId={managing} onClose={() => setManaging(null)} />
    </>
  );
}

function UsersModal({ companyId, onClose }: { companyId: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const [nu, setNu] = useState({ name: '', email: '', password: '', role: 'RECEPTIONIST' });

  const { data: company } = useQuery({
    queryKey: ['companies', companyId],
    queryFn: async () => (await api.get<Company>(`/companies/${companyId}`)).data,
    enabled: !!companyId,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['companies'] });
    setError('');
  };
  const add = useMutation({
    mutationFn: async () => api.post(`/companies/${companyId}/users`, nu),
    onSuccess: () => {
      refresh();
      setNu({ name: '', email: '', password: '', role: 'RECEPTIONIST' });
    },
    onError: (e) => setError(errorMessage(e)),
  });
  const patch = useMutation({
    mutationFn: async (v: { userId: string; data: { active?: boolean; password?: string } }) =>
      api.patch(`/companies/${companyId}/users/${v.userId}`, v.data),
    onSuccess: refresh,
    onError: (e) => setError(errorMessage(e)),
  });

  return (
    <Modal open={!!companyId} onClose={onClose} title={company ? `Usuários — ${company.name}` : 'Usuários'}>
      <ErrorBox message={error} />
      <ul className="divide-y divide-gray-100 text-sm">
        {company?.users?.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center gap-2 py-2">
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{u.name} <span className="font-normal text-gray-500">· {u.role && roleLabel[u.role]}</span></div>
              <div className="truncate text-xs text-gray-500">{u.email}</div>
            </div>
            <button
              className="text-primary-600 hover:underline"
              onClick={() => {
                const password = prompt(`Nova senha para ${u.email} (mínimo 6 caracteres):`);
                if (password) patch.mutate({ userId: u.id!, data: { password } });
              }}
            >
              Redefinir senha
            </button>
            <button
              className={u.active ? 'text-red-500 hover:underline' : 'text-primary-600 hover:underline'}
              onClick={() => patch.mutate({ userId: u.id!, data: { active: !u.active } })}
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
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className={btnGhost} onClick={onClose}>Fechar</button>
          <button type="submit" className={btnPrimary} disabled={add.isPending}>{add.isPending ? 'Adicionando…' : 'Adicionar'}</button>
        </div>
      </form>
    </Modal>
  );
}
