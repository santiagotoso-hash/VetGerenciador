'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, errorMessage } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import type { Role, Service, User } from '@/types';
import { btnGhost, btnPrimary, Card, Empty, ErrorBox, Field, inputCls, Modal, PageHeader } from '@/components/ui';
import { currency } from '@/lib/format';

const roleLabel: Record<Role, string> = {
  ADMIN: 'Administrador',
  RECEPTIONIST: 'Atendente',
  VETERINARIAN: 'Veterinário',
  GROOMER: 'Banho e tosa',
};
const roleHelp: Record<Role, string> = {
  ADMIN: 'Acesso total, inclusive financeiro e usuários',
  RECEPTIONIST: 'Clientes, pets, agenda, estoque e vendas',
  VETERINARIAN: 'Atendimentos e prontuários',
  GROOMER: 'Agenda de banho e tosa',
};
const roles = Object.keys(roleLabel) as Role[];

export default function ConfiguracoesPage() {
  const me = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<'usuarios' | 'servicos'>('usuarios');

  if (me && me.role !== 'ADMIN') {
    return (
      <>
        <PageHeader title="Configurações" />
        <Card className="p-10 text-center text-gray-500">
          <div className="mb-2 text-4xl">🔒</div>
          <p className="font-medium text-gray-700">Acesso restrito</p>
          <p className="mt-1 text-sm">Somente administradores podem alterar as configurações.</p>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Configurações" subtitle="Equipe e catálogo de serviços" />
      <div className="mb-4 flex gap-1 border-b border-gray-200">
        {([['usuarios', 'Usuários'], ['servicos', 'Serviços']] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              tab === k ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'usuarios' ? <UsersTab meId={me?.id} /> : <ServicesTab />}
    </>
  );
}

/* ----------------------------- Usuários ----------------------------- */

const userSchema = z.object({
  name: z.string().min(2, 'Informe o nome'),
  email: z.string().email('E-mail inválido'),
  role: z.enum(['ADMIN', 'RECEPTIONIST', 'VETERINARIAN', 'GROOMER']),
  phone: z.string(),
  password: z.string(),
});
type UserForm = z.infer<typeof userSchema>;

function randomPassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint32Array(10));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

function UsersTab({ meId }: { meId?: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<User | 'new' | null>(null);
  const [apiError, setApiError] = useState('');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users', 'all'],
    queryFn: async () => (await api.get<User[]>('/users')).data,
  });

  const form = useForm<UserForm>({ resolver: zodResolver(userSchema) });
  const err = form.formState.errors;
  const isNew = editing === 'new';

  const openModal = (u: User | 'new') => {
    setApiError('');
    setEditing(u);
    form.reset(
      u === 'new'
        ? { name: '', email: '', role: 'RECEPTIONIST', phone: '', password: '' }
        : { name: u.name, email: u.email, role: u.role, phone: u.phone ?? '', password: '' },
    );
  };

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['users'] });
  };

  const save = useMutation({
    mutationFn: async (f: UserForm) => {
      if (isNew) {
        return api.post('/users', { name: f.name, email: f.email, role: f.role, password: f.password, ...(f.phone && { phone: f.phone }) });
      }
      const u = editing as User;
      return api.patch(`/users/${u.id}`, {
        name: f.name,
        email: f.email,
        role: f.role,
        phone: f.phone,
        ...(f.password && { password: f.password }),
      });
    },
    onSuccess: () => {
      refresh();
      setEditing(null);
    },
    onError: (e) => setApiError(errorMessage(e)),
  });

  const submit = (f: UserForm) => {
    if (isNew && f.password.length < 6) return form.setError('password', { message: 'Mínimo de 6 caracteres' });
    if (!isNew && f.password && f.password.length < 6) return form.setError('password', { message: 'Mínimo de 6 caracteres' });
    save.mutate(f);
  };

  const toggle = useMutation({
    mutationFn: async (u: User) => api.patch(`/users/${u.id}`, { active: !u.active }),
    onSuccess: refresh,
    onError: (e) => alert(errorMessage(e)),
  });

  return (
    <>
      <div className="mb-3 flex justify-end">
        <button className={btnPrimary} onClick={() => openModal('new')}>+ Novo usuário</button>
      </div>

      <Card className="overflow-x-auto">
        {users.length === 0 ? (
          <Empty>{isLoading ? 'Carregando…' : 'Nenhum usuário'}</Empty>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="hidden px-4 py-3 sm:table-cell">E-mail</th>
                <th className="px-4 py-3">Perfil</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className={`hover:bg-gray-50 ${u.active ? '' : 'text-gray-400'}`}>
                  <td className="px-4 py-3 font-medium">
                    {u.name} {u.id === meId && <span className="ml-1 text-xs font-normal text-primary-600">(você)</span>}
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">{u.email}</td>
                  <td className="px-4 py-3">{roleLabel[u.role]}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${u.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {u.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <button className="mr-3 text-primary-600 hover:underline" onClick={() => openModal(u)}>Editar</button>
                    {u.id !== meId && (
                      <button
                        className={u.active ? 'text-red-500 hover:underline' : 'text-green-600 hover:underline'}
                        onClick={() => (!u.active || confirm(`Desativar ${u.name}? A pessoa perde o acesso imediatamente.`)) && toggle.mutate(u)}
                      >
                        {u.active ? 'Desativar' : 'Reativar'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={isNew ? 'Novo usuário' : 'Editar usuário'}>
        <form onSubmit={form.handleSubmit(submit)} className="space-y-3" autoComplete="off">
          <ErrorBox message={apiError} />
          <Field label="Nome *" error={err.name?.message}><input className={inputCls} {...form.register('name')} /></Field>
          <Field label="E-mail (usado no login) *" error={err.email?.message}>
            <input type="email" className={inputCls} autoComplete="off" {...form.register('email')} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Perfil *">
              <select className={inputCls} {...form.register('role')}>
                {roles.map((r) => <option key={r} value={r}>{roleLabel[r]}</option>)}
              </select>
            </Field>
            <Field label="Telefone"><input className={inputCls} {...form.register('phone')} /></Field>
          </div>
          <p className="-mt-1 text-xs text-gray-500">{roleHelp[form.watch('role') ?? 'RECEPTIONIST']}</p>
          <Field label={isNew ? 'Senha inicial *' : 'Nova senha (deixe em branco para manter)'} error={err.password?.message}>
            <div className="flex gap-2">
              <input className={inputCls} autoComplete="new-password" {...form.register('password')} />
              <button type="button" className={btnGhost} onClick={() => form.setValue('password', randomPassword(), { shouldValidate: true })}>
                Gerar
              </button>
            </div>
          </Field>
          {isNew && <p className="text-xs text-gray-500">Anote a senha e repasse à pessoa: ela não será exibida novamente.</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className={btnGhost} onClick={() => setEditing(null)}>Cancelar</button>
            <button type="submit" className={btnPrimary} disabled={save.isPending}>{save.isPending ? 'Salvando…' : 'Salvar'}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}

/* ----------------------------- Serviços ----------------------------- */

const num = (msg: string) => z.string().refine((v) => v !== '' && !isNaN(Number(v.replace(',', '.'))) && Number(v.replace(',', '.')) > 0, msg);
const serviceSchema = z.object({
  name: z.string().min(1, 'Informe o nome'),
  category: z.string().min(1, 'Informe a categoria'),
  price: num('Valor inválido'),
  duration: num('Duração inválida'),
  description: z.string(),
});
type ServiceForm = z.infer<typeof serviceSchema>;
const n = (v: string) => Number(v.replace(',', '.'));

function ServicesTab() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Service | 'new' | null>(null);
  const [apiError, setApiError] = useState('');

  const { data: services = [], isLoading } = useQuery({
    queryKey: ['services', 'all'],
    queryFn: async () => (await api.get<Service[]>('/services')).data,
  });

  const form = useForm<ServiceForm>({ resolver: zodResolver(serviceSchema) });
  const err = form.formState.errors;

  const openModal = (s: Service | 'new') => {
    setApiError('');
    setEditing(s);
    form.reset(
      s === 'new'
        ? { name: '', category: '', price: '', duration: '30', description: '' }
        : { name: s.name, category: s.category, price: String(s.price), duration: String(s.duration), description: s.description ?? '' },
    );
  };

  const refresh = () => qc.invalidateQueries({ queryKey: ['services'] });

  const save = useMutation({
    mutationFn: async (f: ServiceForm) => {
      const body = {
        name: f.name,
        category: f.category,
        price: n(f.price),
        duration: Math.round(n(f.duration)),
        ...(f.description && { description: f.description }),
      };
      return editing === 'new' || !editing ? api.post('/services', body) : api.patch(`/services/${editing.id}`, { ...body, description: f.description });
    },
    onSuccess: () => {
      refresh();
      setEditing(null);
    },
    onError: (e) => setApiError(errorMessage(e)),
  });

  const toggle = useMutation({
    mutationFn: async (s: Service) => api.patch(`/services/${s.id}`, { active: !s.active }),
    onSuccess: refresh,
  });

  return (
    <>
      <div className="mb-3 flex justify-end">
        <button className={btnPrimary} onClick={() => openModal('new')}>+ Novo serviço</button>
      </div>

      <Card className="overflow-x-auto">
        {services.length === 0 ? (
          <Empty>{isLoading ? 'Carregando…' : 'Nenhum serviço cadastrado'}</Empty>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Serviço</th>
                <th className="hidden px-4 py-3 sm:table-cell">Categoria</th>
                <th className="px-4 py-3">Preço</th>
                <th className="hidden px-4 py-3 md:table-cell">Duração</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {services.map((s) => (
                <tr key={s.id} className={`hover:bg-gray-50 ${s.active ? '' : 'text-gray-400'}`}>
                  <td className="px-4 py-3 font-medium">
                    {s.name} {!s.active && <span className="ml-1 text-xs font-normal">(inativo)</span>}
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">{s.category}</td>
                  <td className="px-4 py-3">{currency(s.price)}</td>
                  <td className="hidden px-4 py-3 md:table-cell">{s.duration} min</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <button className="mr-3 text-primary-600 hover:underline" onClick={() => openModal(s)}>Editar</button>
                    <button className={s.active ? 'text-red-500 hover:underline' : 'text-green-600 hover:underline'} onClick={() => toggle.mutate(s)}>
                      {s.active ? 'Desativar' : 'Reativar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Novo serviço' : 'Editar serviço'}>
        <form onSubmit={form.handleSubmit((f) => save.mutate(f))} className="space-y-3">
          <ErrorBox message={apiError} />
          <Field label="Nome *" error={err.name?.message}><input className={inputCls} {...form.register('name')} /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Categoria *" error={err.category?.message}><input className={inputCls} placeholder="Clínica, Estética…" {...form.register('category')} /></Field>
            <Field label="Preço (R$) *" error={err.price?.message}><input inputMode="decimal" className={inputCls} {...form.register('price')} /></Field>
            <Field label="Duração (min) *" error={err.duration?.message}><input inputMode="numeric" className={inputCls} {...form.register('duration')} /></Field>
          </div>
          <Field label="Descrição"><textarea rows={2} className={inputCls} {...form.register('description')} /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className={btnGhost} onClick={() => setEditing(null)}>Cancelar</button>
            <button type="submit" className={btnPrimary} disabled={save.isPending}>{save.isPending ? 'Salvando…' : 'Salvar'}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
