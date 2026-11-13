'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, errorMessage } from '@/lib/api';
import type { Client } from '@/types';
import { btnGhost, btnPrimary, Card, Empty, ErrorBox, Field, inputCls, Modal, PageHeader } from '@/components/ui';
import { speciesIcon } from '@/lib/format';

const schema = z.object({
  name: z.string().min(2, 'Informe o nome'),
  phone: z.string().min(8, 'Informe o telefone'),
  email: z.string().email('E-mail inválido').or(z.literal('')),
  cpf: z.string(),
  address: z.string(),
  city: z.string(),
  state: z.string(),
  zipCode: z.string(),
  notes: z.string(),
});
type Form = z.infer<typeof schema>;

const empty: Form = { name: '', phone: '', email: '', cpf: '', address: '', city: '', state: '', zipCode: '', notes: '' };

// A API rejeita campos desconhecidos e e-mail vazio; manda só o que foi preenchido.
const clean = (f: Form) => Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ''));

export default function ClientesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Client | 'new' | null>(null);
  const [apiError, setApiError] = useState('');

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients', search],
    queryFn: async () => (await api.get<Client[]>('/clients', { params: { search: search || undefined, active: 'true' } })).data,
  });

  const form = useForm<Form>({ resolver: zodResolver(schema), defaultValues: empty });

  const openModal = (c: Client | 'new') => {
    setApiError('');
    setEditing(c);
    form.reset(
      c === 'new'
        ? empty
        : {
            name: c.name,
            phone: c.phone,
            email: c.email ?? '',
            cpf: c.cpf ?? '',
            address: c.address ?? '',
            city: c.city ?? '',
            state: c.state ?? '',
            zipCode: c.zipCode ?? '',
            notes: c.notes ?? '',
          },
    );
  };

  // /clientes?novo=1 abre o formulário direto; ?voltar=/vendas retorna depois de salvar.
  const router = useRouter();
  const [voltar, setVoltar] = useState<string | null>(null);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const back = p.get('voltar');
    if (back?.startsWith('/') && !back.startsWith('//')) setVoltar(back);
    if (p.get('novo') === '1') {
      openModal('new');
      window.history.replaceState(null, '', '/clientes');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = useMutation({
    mutationFn: async (f: Form) =>
      editing === 'new' || !editing
        ? api.post('/clients', clean(f))
        : api.patch(`/clients/${editing.id}`, { ...f, email: f.email || undefined, cpf: f.cpf || undefined }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      const criou = editing === 'new';
      setEditing(null);
      if (criou && voltar) router.push(`${voltar}?cliente=${res.data.id}`);
    },
    onError: (e) => setApiError(errorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/clients/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  });

  const err = form.formState.errors;

  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle="Tutores cadastrados"
        action={<button className={btnPrimary} onClick={() => openModal('new')}>+ Novo cliente</button>}
      />

      <input
        className={`${inputCls} mb-4 max-w-sm`}
        placeholder="Buscar por nome, CPF, telefone ou e-mail…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <Card className="overflow-x-auto">
        {clients.length === 0 ? (
          <Empty>{isLoading ? 'Carregando…' : 'Nenhum cliente encontrado'}</Empty>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Telefone</th>
                <th className="hidden px-4 py-3 md:table-cell">E-mail</th>
                <th className="px-4 py-3">Pets</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clients.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/clientes/${c.id}`} className="text-primary-700 hover:underline">{c.name}</Link>
                  </td>
                  <td className="px-4 py-3">{c.phone}</td>
                  <td className="hidden px-4 py-3 text-gray-500 md:table-cell">{c.email ?? '—'}</td>
                  <td className="px-4 py-3">
                    {c.pets?.filter((p) => p.active).map((p) => (
                      <span key={p.id} title={p.name} className="mr-1">{speciesIcon[p.species]}</span>
                    ))}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <button className="mr-3 text-primary-600 hover:underline" onClick={() => openModal(c)}>Editar</button>
                    <button
                      className="text-red-500 hover:underline"
                      onClick={() => confirm(`Desativar ${c.name}?`) && remove.mutate(c.id)}
                    >
                      Desativar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Novo cliente' : 'Editar cliente'}>
        <form onSubmit={form.handleSubmit((f) => save.mutate(f))} className="space-y-3">
          <ErrorBox message={apiError} />
          <Field label="Nome *" error={err.name?.message}><input className={inputCls} {...form.register('name')} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Telefone *" error={err.phone?.message}><input className={inputCls} {...form.register('phone')} /></Field>
            <Field label="CPF"><input className={inputCls} {...form.register('cpf')} /></Field>
          </div>
          <Field label="E-mail" error={err.email?.message}><input className={inputCls} {...form.register('email')} /></Field>
          <Field label="Endereço"><input className={inputCls} {...form.register('address')} /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Cidade"><input className={inputCls} {...form.register('city')} /></Field>
            <Field label="UF"><input className={inputCls} maxLength={2} {...form.register('state')} /></Field>
            <Field label="CEP"><input className={inputCls} {...form.register('zipCode')} /></Field>
          </div>
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
