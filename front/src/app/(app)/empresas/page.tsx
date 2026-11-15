'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, errorMessage } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import type { Company, Role } from '@/types';
import { btnGhost, btnPrimary, Card, Empty, ErrorBox, Field, inputCls, Modal, PageHeader } from '@/components/ui';
import { billingStatus, formatMoney, formatYmd, parseMoney, toneClass } from '@/lib/billing';

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
  trialDays: z.string(),
  fee: z.string(),
});
type Form = z.infer<typeof schema>;

const emptyForm: Form = {
  name: '',
  admin: { name: '', email: '', password: '' },
  withAttendant: true,
  attendant: { name: 'Atendente', email: '', password: '' },
  trialDays: '15',
  fee: '',
};

export default function EmpresasPage() {
  const me = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
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
      const trialDays = f.trialDays.trim() === '' ? undefined : Number(f.trialDays);
      const monthlyFeeCents = parseMoney(f.fee);
      return api.post('/companies', {
        name: f.name,
        admin: f.admin,
        ...(users.length && { users }),
        ...(trialDays !== undefined && Number.isInteger(trialDays) && { trialDays }),
        ...(monthlyFeeCents && { monthlyFeeCents }),
      });
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

  // Resumo financeiro: receita mensal prevista (empresas ativas com cobrança), em teste e atrasadas.
  const billed = companies.filter((c) => c.active && c.billing.state !== 'none');
  const monthlyRevenue = billed.reduce((sum, c) => sum + (c.billing.monthlyFeeCents ?? 0), 0);
  const inTrial = companies.filter((c) => c.billing.state === 'trial').length;
  const late = companies.filter((c) => c.billing.state === 'overdue' || c.billing.state === 'trial_expired').length;
  const blocked = companies.filter((c) => c.billing.blocked).length;

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

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          [formatMoney(monthlyRevenue), 'Receita mensal prevista', 'text-primary-700'],
          [String(inTrial), 'Em teste grátis', 'text-amber-600'],
          [String(late), 'Com pagamento atrasado', 'text-red-600'],
          [String(blocked), 'Bloqueadas', 'text-gray-700'],
        ].map(([value, label, color]) => (
          <Card key={label} className="p-4">
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-gray-500">{label}</div>
          </Card>
        ))}
      </div>

      <Card className="overflow-x-auto">
        {companies.length === 0 ? (
          <Empty>{isLoading ? 'Carregando…' : 'Nenhuma empresa cadastrada'}</Empty>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Empresa</th>
                <th className="hidden px-4 py-3 md:table-cell">Administrador</th>
                <th className="hidden px-4 py-3 lg:table-cell">Dados</th>
                <th className="px-4 py-3">Cobrança</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {companies.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/empresas/${c.id}`} className="flex items-center gap-2 text-primary-700 hover:underline">
                      {c.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.logo} alt="" className="h-8 w-8 rounded-md object-cover" />
                      ) : (
                        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-50 text-xs font-semibold">{c.name.charAt(0)}</span>
                      )}
                      {c.name}
                    </Link>
                  </td>
                  <td className="hidden px-4 py-3 text-gray-500 md:table-cell">
                    {c.users?.map((u) => u.email).join(', ') || '—'}
                  </td>
                  <td className="hidden px-4 py-3 text-gray-500 lg:table-cell">
                    {c.activeUsers ?? 0} usuário(s) ativo(s) · {c._count?.clients ?? 0} cliente(s) · {c._count?.pets ?? 0} pet(s)
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${toneClass[billingStatus(c.billing).tone]}`}>{billingStatus(c.billing).label}</span>
                    <div className="mt-1 text-xs text-gray-500">
                      {c.billing.monthlyFeeCents != null && <>{formatMoney(c.billing.monthlyFeeCents)}/mês</>}
                      {c.lastPayment && <> · último pagamento {formatYmd(c.lastPayment.paidAt)}</>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${c.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {c.active ? 'Ativa' : 'Suspensa'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <Link className="mr-3 text-primary-600 hover:underline" href={`/empresas/${c.id}`}>Abrir</Link>
                    <button
                      className={c.active ? 'text-red-500 hover:underline' : 'text-primary-600 hover:underline'}
                      onClick={() =>
                        (c.active
                          ? confirm(`Suspender ${c.name}? Ninguém da empresa consegue entrar até você reativar.`)
                          : true) && toggle.mutate(c)
                      }
                    >
                      {c.active ? 'Suspender' : 'Reativar'}
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

          <p className="pt-1 text-xs font-semibold uppercase text-gray-500">Cobrança</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Teste grátis (dias)"><input type="number" min={0} max={365} className={inputCls} {...form.register('trialDays')} /></Field>
            <Field label="Mensalidade (R$)"><input inputMode="decimal" placeholder="Ex.: 199,90" className={inputCls} {...form.register('fee')} /></Field>
          </div>
          <p className="text-xs text-gray-500">0 dias = sem teste (cobra desde hoje). Em branco = sem cobrança por enquanto. Depois registre os pagamentos em “Cobrança”.</p>

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

    </>
  );
}
