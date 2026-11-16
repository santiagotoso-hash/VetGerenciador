'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, errorMessage } from '@/lib/api';
import type { Product } from '@/types';
import { btnGhost, btnPrimary, Card, Empty, ErrorBox, Field, inputCls, Modal, PageHeader } from '@/components/ui';
import { currency } from '@/lib/format';
import { originOptions } from '@/lib/fiscal';

const categories: Record<string, string> = {
  FOOD: 'Ração',
  MEDICINE: 'Medicamento',
  VACCINE: 'Vacina',
  HYGIENE: 'Higiene',
  ACCESSORY: 'Acessório',
  SUPPLEMENT: 'Suplemento',
  OTHER: 'Outro',
};

const num = z.string().refine((v) => v === '' || !isNaN(Number(v.replace(',', '.'))), 'Número inválido');
const schema = z.object({
  name: z.string().min(1, 'Informe o nome'),
  category: z.string().min(1),
  brand: z.string(),
  sku: z.string(),
  price: num.refine((v) => v !== '', 'Informe o preço'),
  costPrice: num,
  stock: num,
  minStock: num,
  ncm: z.string().regex(/^(\d{8})?$/, 'NCM tem 8 números'),
  cfop: z.string().regex(/^(\d{4})?$/, 'CFOP tem 4 números'),
  taxCode: z.string().regex(/^(\d{2,3})?$/, 'CST/CSOSN tem 2 ou 3 números'),
  origin: z.string(),
});
type Form = z.infer<typeof schema>;
const empty: Form = { name: '', category: 'FOOD', brand: '', sku: '', price: '', costPrice: '', stock: '0', minStock: '5', ncm: '', cfop: '', taxCode: '', origin: '' };

const n = (v: string) => Number(v.replace(',', '.'));

function toPayload(f: Form) {
  return {
    name: f.name,
    category: f.category,
    price: n(f.price),
    stock: Math.round(n(f.stock || '0')),
    minStock: Math.round(n(f.minStock || '0')),
    ...(f.brand && { brand: f.brand }),
    ...(f.sku && { sku: f.sku }),
    ...(f.costPrice && { costPrice: n(f.costPrice) }),
    // fiscal: vazio limpa o campo
    ncm: f.ncm,
    cfop: f.cfop,
    taxCode: f.taxCode,
    ...(f.origin !== '' && { origin: Number(f.origin) }),
  };
}

export default function EstoquePage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [onlyLow, setOnlyLow] = useState(false);
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const [apiError, setApiError] = useState('');

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', search],
    queryFn: async () => (await api.get<Product[]>('/products', { params: { search: search || undefined, active: 'true' } })).data,
  });

  const form = useForm<Form>({ resolver: zodResolver(schema), defaultValues: empty });

  const openModal = (p: Product | 'new') => {
    setApiError('');
    setEditing(p);
    form.reset(
      p === 'new'
        ? empty
        : {
            name: p.name, category: p.category, brand: p.brand ?? '', sku: p.sku ?? '',
            price: String(p.price), costPrice: p.costPrice?.toString() ?? '',
            stock: String(p.stock), minStock: String(p.minStock),
            ncm: p.ncm ?? '', cfop: p.cfop ?? '', taxCode: p.taxCode ?? '', origin: p.origin?.toString() ?? '',
          },
    );
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['products'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const save = useMutation({
    mutationFn: async (f: Form) =>
      editing === 'new' || !editing ? api.post('/products', toPayload(f)) : api.patch(`/products/${editing.id}`, toPayload(f)),
    onSuccess: () => {
      invalidate();
      setEditing(null);
    },
    onError: (e) => setApiError(errorMessage(e)),
  });

  const adjust = useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => api.patch(`/products/${id}/stock`, { quantity }),
    onSuccess: invalidate,
    onError: (e) => alert(errorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/products/${id}`),
    onSuccess: invalidate,
  });

  const err = form.formState.errors;
  const list = onlyLow ? products.filter((p) => p.stock <= p.minStock) : products;

  return (
    <>
      <PageHeader
        title="Estoque"
        subtitle="Produtos e níveis de estoque"
        action={<button className={btnPrimary} onClick={() => openModal('new')}>+ Novo produto</button>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <input className={`${inputCls} max-w-sm`} placeholder="Buscar por nome, SKU ou código…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} />
          Somente estoque baixo
        </label>
      </div>

      <Card className="overflow-x-auto">
        {list.length === 0 ? (
          <Empty>{isLoading ? 'Carregando…' : 'Nenhum produto encontrado'}</Empty>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Produto</th>
                <th className="hidden px-4 py-3 sm:table-cell">Categoria</th>
                <th className="px-4 py-3">Preço</th>
                <th className="px-4 py-3">Estoque</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {list.map((p) => {
                const low = p.stock <= p.minStock;
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">
                      {p.name}
                      {p.sku && <span className="ml-2 text-xs font-normal text-gray-400">{p.sku}</span>}
                    </td>
                    <td className="hidden px-4 py-3 text-gray-500 sm:table-cell">{categories[p.category] ?? p.category}</td>
                    <td className="px-4 py-3">{currency(p.price)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${low ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {p.stock} {p.unit}
                      </span>
                      <span className="ml-2 inline-flex gap-1 align-middle">
                        <button className="h-6 w-6 rounded border border-gray-200 text-gray-600 hover:bg-gray-100" aria-label="Saída de 1" onClick={() => adjust.mutate({ id: p.id, quantity: -1 })}>−</button>
                        <button className="h-6 w-6 rounded border border-gray-200 text-gray-600 hover:bg-gray-100" aria-label="Entrada de 1" onClick={() => adjust.mutate({ id: p.id, quantity: 1 })}>+</button>
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <button className="mr-3 text-primary-600 hover:underline" onClick={() => openModal(p)}>Editar</button>
                      <button className="text-red-500 hover:underline" onClick={() => confirm(`Desativar ${p.name}?`) && remove.mutate(p.id)}>Desativar</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Novo produto' : 'Editar produto'}>
        <form onSubmit={form.handleSubmit((f) => save.mutate(f))} className="space-y-3">
          <ErrorBox message={apiError} />
          <Field label="Nome *" error={err.name?.message}><input className={inputCls} {...form.register('name')} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoria">
              <select className={inputCls} {...form.register('category')}>
                {Object.entries(categories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Marca"><input className={inputCls} {...form.register('brand')} /></Field>
            <Field label="SKU"><input className={inputCls} {...form.register('sku')} /></Field>
            <Field label="Preço de venda *" error={err.price?.message}><input inputMode="decimal" className={inputCls} {...form.register('price')} /></Field>
            <Field label="Preço de custo" error={err.costPrice?.message}><input inputMode="decimal" className={inputCls} {...form.register('costPrice')} /></Field>
            <Field label="Estoque atual" error={err.stock?.message}><input inputMode="numeric" className={inputCls} {...form.register('stock')} /></Field>
            <Field label="Estoque mínimo" error={err.minStock?.message}><input inputMode="numeric" className={inputCls} {...form.register('minStock')} /></Field>
          </div>
          <details className="rounded-lg border border-gray-200 p-3" open={!!(editing && editing !== 'new' && !editing.ncm)}>
            <summary className="cursor-pointer text-sm font-medium text-gray-700">Dados fiscais (nota fiscal)</summary>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label="NCM (8 dígitos)" error={err.ncm?.message}><input inputMode="numeric" className={inputCls} placeholder="23091000" {...form.register('ncm')} /></Field>
              <Field label="CFOP (4 dígitos)" error={err.cfop?.message}><input inputMode="numeric" className={inputCls} placeholder="5102" {...form.register('cfop')} /></Field>
              <Field label="CST / CSOSN" error={err.taxCode?.message}><input inputMode="numeric" className={inputCls} placeholder="102" {...form.register('taxCode')} /></Field>
              <Field label="Origem">
                <select className={inputCls} {...form.register('origin')}>
                  <option value="">Selecione…</option>
                  {originOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
            </div>
            <p className="mt-2 text-xs text-gray-500">Quem informa esses códigos é o seu contador. Só são necessários para emitir nota de produto.</p>
          </details>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className={btnGhost} onClick={() => setEditing(null)}>Cancelar</button>
            <button type="submit" className={btnPrimary} disabled={save.isPending}>{save.isPending ? 'Salvando…' : 'Salvar'}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
