'use client';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, errorMessage } from '@/lib/api';
import type { FinancialEntry, FinancialType, PaymentMethod } from '@/types';
import { btnGhost, btnPrimary, Card, Empty, ErrorBox, Field, inputCls, Modal, PageHeader } from '@/components/ui';
import { currency } from '@/lib/format';

const paymentLabel: Record<PaymentMethod, string> = {
  CASH: 'Dinheiro',
  PIX: 'Pix',
  CREDIT_CARD: 'Cartão de crédito',
  DEBIT_CARD: 'Cartão de débito',
  BANK_TRANSFER: 'Transferência',
  CHECK: 'Cheque',
};

const categories: Record<FinancialType, string[]> = {
  INCOME: ['Venda', 'Serviço', 'Outras receitas'],
  EXPENSE: ['Aluguel', 'Salários', 'Fornecedores', 'Impostos', 'Energia e água', 'Equipamentos', 'Outras despesas'],
};
// Vendas do PDV chegam com a categoria técnica "SALE"
const categoryName = (c: string) => (c === 'SALE' ? 'Venda' : c);

const schema = z.object({
  type: z.enum(['INCOME', 'EXPENSE']),
  description: z.string().min(1, 'Informe a descrição'),
  amount: z
    .string()
    .min(1, 'Informe o valor')
    .refine((v) => !isNaN(Number(v.replace(',', '.'))) && Number(v.replace(',', '.')) > 0, 'Valor inválido'),
  date: z.string().min(1, 'Informe a data'),
  category: z.string().min(1, 'Selecione a categoria'),
  paymentMethod: z.string(),
  paid: z.boolean(),
  notes: z.string(),
});
type Form = z.infer<typeof schema>;

const todayStr = () => new Date().toLocaleDateString('sv-SE'); // yyyy-MM-dd local

function toPayload(f: Form) {
  return {
    type: f.type,
    description: f.description,
    amount: Number(f.amount.replace(',', '.')),
    // meio-dia evita virar o dia anterior por causa do fuso
    date: new Date(`${f.date}T12:00:00`).toISOString(),
    category: f.category,
    paid: f.paid,
    ...(f.paymentMethod && { paymentMethod: f.paymentMethod }),
    ...(f.notes && { notes: f.notes }),
  };
}

export default function FinanceiroPage() {
  const qc = useQueryClient();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [typeFilter, setTypeFilter] = useState<'' | FinancialType>('');
  const [statusFilter, setStatusFilter] = useState<'' | 'paid' | 'pending'>('');
  const [editing, setEditing] = useState<FinancialEntry | 'new' | null>(null);
  const [apiError, setApiError] = useState('');

  const { from, to } = useMemo(() => {
    const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    end.setMilliseconds(-1);
    return { from: cursor.toISOString(), to: end.toISOString() };
  }, [cursor]);

  const { data: entries = [], isLoading, error } = useQuery({
    queryKey: ['financial', from],
    queryFn: async () => (await api.get<FinancialEntry[]>('/financial', { params: { from, to } })).data,
    retry: false,
  });
  const { data: summary } = useQuery({
    queryKey: ['financial', 'summary', from],
    queryFn: async () => (await api.get<{ income: number; expense: number; balance: number }>('/financial/summary', { params: { from, to } })).data,
    retry: false,
  });

  const pendingIn = entries.filter((e) => !e.paid && e.type === 'INCOME').reduce((s, e) => s + e.amount, 0);
  const pendingOut = entries.filter((e) => !e.paid && e.type === 'EXPENSE').reduce((s, e) => s + e.amount, 0);

  const list = entries
    .filter((e) => !typeFilter || e.type === typeFilter)
    .filter((e) => !statusFilter || (statusFilter === 'paid' ? e.paid : !e.paid));

  const form = useForm<Form>({ resolver: zodResolver(schema) });
  const watchType = form.watch('type');

  const openModal = (e: FinancialEntry | 'new') => {
    setApiError('');
    setEditing(e);
    form.reset(
      e === 'new'
        ? { type: 'EXPENSE', description: '', amount: '', date: todayStr(), category: '', paymentMethod: '', paid: true, notes: '' }
        : {
            type: e.type,
            description: e.description,
            amount: String(e.amount),
            date: new Date(e.date).toLocaleDateString('sv-SE'),
            category: e.category,
            paymentMethod: e.paymentMethod ?? '',
            paid: e.paid,
            notes: e.notes ?? '',
          },
    );
  };

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['financial'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const save = useMutation({
    mutationFn: async (f: Form) =>
      editing === 'new' || !editing ? api.post('/financial', toPayload(f)) : api.patch(`/financial/${editing.id}`, toPayload(f)),
    onSuccess: () => {
      refresh();
      setEditing(null);
    },
    onError: (e) => setApiError(errorMessage(e)),
  });

  const markPaid = useMutation({
    mutationFn: async (id: string) => api.patch(`/financial/${id}`, { paid: true }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/financial/${id}`),
    onSuccess: refresh,
  });

  const shift = (n: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1));
  const monthLabel = cursor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  if ((error as any)?.response?.status === 403) {
    return (
      <>
        <PageHeader title="Financeiro" />
        <Card className="p-10 text-center text-gray-500">
          <div className="mb-2 text-4xl">🔒</div>
          <p className="font-medium text-gray-700">Acesso restrito</p>
          <p className="mt-1 text-sm">Somente administradores podem ver o financeiro.</p>
        </Card>
      </>
    );
  }

  const cards = [
    { label: 'Receitas (recebidas)', value: summary?.income, color: 'text-green-600' },
    { label: 'Despesas (pagas)', value: summary?.expense, color: 'text-red-600' },
    { label: 'Saldo do mês', value: summary?.balance, color: (summary?.balance ?? 0) >= 0 ? 'text-primary-700' : 'text-red-600' },
  ];

  const cats = categories[watchType ?? 'EXPENSE'];
  const current = form.getValues('category');
  const catOptions = current && !cats.includes(current) ? [current, ...cats] : cats;

  return (
    <>
      <PageHeader
        title="Financeiro"
        subtitle="Receitas e despesas"
        action={<button className={btnPrimary} onClick={() => openModal('new')}>+ Novo lançamento</button>}
      />

      <div className="mb-4 flex items-center gap-2">
        <button className={btnGhost} onClick={() => shift(-1)} aria-label="Mês anterior">←</button>
        <h2 className="min-w-[10rem] text-center text-lg font-semibold capitalize">{monthLabel}</h2>
        <button className={btnGhost} onClick={() => shift(1)} aria-label="Próximo mês">→</button>
      </div>

      <div className="mb-2 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.label} className="p-4">
            <div className="text-xs text-gray-500">{c.label}</div>
            <div className={`mt-1 text-2xl font-bold ${c.color}`}>{c.value === undefined ? '…' : currency(c.value)}</div>
          </Card>
        ))}
      </div>
      {(pendingIn > 0 || pendingOut > 0) && (
        <p className="mb-4 text-sm text-gray-500">
          Pendente neste mês:{' '}
          {pendingIn > 0 && <span className="text-green-700">{currency(pendingIn)} a receber</span>}
          {pendingIn > 0 && pendingOut > 0 && ' · '}
          {pendingOut > 0 && <span className="text-red-600">{currency(pendingOut)} a pagar</span>}
        </p>
      )}

      <div className="mb-4 mt-4 flex flex-wrap gap-3">
        <select className={`${inputCls} max-w-[11rem]`} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as '' | FinancialType)}>
          <option value="">Receitas e despesas</option>
          <option value="INCOME">Só receitas</option>
          <option value="EXPENSE">Só despesas</option>
        </select>
        <select className={`${inputCls} max-w-[11rem]`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as '' | 'paid' | 'pending')}>
          <option value="">Pagos e pendentes</option>
          <option value="paid">Só pagos</option>
          <option value="pending">Só pendentes</option>
        </select>
      </div>

      <Card className="overflow-x-auto">
        {list.length === 0 ? (
          <Empty>{isLoading ? 'Carregando…' : 'Nenhum lançamento neste período'}</Empty>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Descrição</th>
                <th className="hidden px-4 py-3 md:table-cell">Categoria</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {list.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3">{new Date(e.date).toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-3 font-medium">
                    {e.description}
                    {e.paymentMethod && <span className="ml-2 text-xs font-normal text-gray-400">{paymentLabel[e.paymentMethod]}</span>}
                  </td>
                  <td className="hidden px-4 py-3 text-gray-500 md:table-cell">{categoryName(e.category)}</td>
                  <td className={`whitespace-nowrap px-4 py-3 text-right font-semibold ${e.type === 'INCOME' ? 'text-green-600' : 'text-red-600'}`}>
                    {e.type === 'INCOME' ? '+' : '−'} {currency(e.amount)}
                  </td>
                  <td className="px-4 py-3">
                    {e.paid ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">{e.type === 'INCOME' ? 'Recebido' : 'Pago'}</span>
                    ) : (
                      <button
                        className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 hover:bg-amber-200"
                        title="Marcar como pago"
                        onClick={() => markPaid.mutate(e.id)}
                      >
                        Pendente ✓
                      </button>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <button className="mr-3 text-primary-600 hover:underline" onClick={() => openModal(e)}>Editar</button>
                    <button
                      className="text-red-500 hover:underline"
                      onClick={() =>
                        confirm(
                          e.category === 'SALE'
                            ? 'Este lançamento veio de uma venda. Excluir remove só o lançamento financeiro, não a venda. Continuar?'
                            : `Excluir "${e.description}"?`,
                        ) && remove.mutate(e.id)
                      }
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Novo lançamento' : 'Editar lançamento'}>
        <form onSubmit={form.handleSubmit((f) => save.mutate(f))} className="space-y-3">
          <ErrorBox message={apiError} />
          <div className="grid grid-cols-2 gap-2">
            {(['EXPENSE', 'INCOME'] as const).map((t) => (
              <label
                key={t}
                className={`cursor-pointer rounded-lg border px-3 py-2 text-center text-sm font-medium ${
                  watchType === t
                    ? t === 'INCOME' ? 'border-green-500 bg-green-50 text-green-700' : 'border-red-500 bg-red-50 text-red-700'
                    : 'border-gray-200 text-gray-500'
                }`}
              >
                <input type="radio" value={t} className="sr-only" {...form.register('type', { onChange: () => form.setValue('category', '') })} />
                {t === 'INCOME' ? 'Receita' : 'Despesa'}
              </label>
            ))}
          </div>
          <Field label="Descrição *" error={form.formState.errors.description?.message}>
            <input className={inputCls} {...form.register('description')} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor (R$) *" error={form.formState.errors.amount?.message}>
              <input inputMode="decimal" className={inputCls} {...form.register('amount')} />
            </Field>
            <Field label="Data *" error={form.formState.errors.date?.message}>
              <input type="date" className={inputCls} {...form.register('date')} />
            </Field>
            <Field label="Categoria *" error={form.formState.errors.category?.message}>
              <select className={inputCls} {...form.register('category')}>
                <option value="">Selecione…</option>
                {catOptions.map((c) => <option key={c} value={c}>{categoryName(c)}</option>)}
              </select>
            </Field>
            <Field label="Forma de pagamento">
              <select className={inputCls} {...form.register('paymentMethod')}>
                <option value="">—</option>
                {Object.entries(paymentLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...form.register('paid')} />
            {watchType === 'INCOME' ? 'Já recebido' : 'Já pago'}
          </label>
          <Field label="Observações"><textarea rows={2} className={inputCls} {...form.register('notes')} /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className={btnGhost} onClick={() => setEditing(null)}>Cancelar</button>
            <button type="submit" className={btnPrimary} disabled={save.isPending}>{save.isPending ? 'Salvando…' : 'Salvar'}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
