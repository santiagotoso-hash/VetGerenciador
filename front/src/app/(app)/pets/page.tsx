'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, errorMessage } from '@/lib/api';
import type { Client, Pet, Species } from '@/types';
import { btnGhost, btnPrimary, Card, Empty, ErrorBox, Field, inputCls, Modal, PageHeader, WhatsAppIcon } from '@/components/ui';
import { speciesIcon, speciesLabel, whatsappUrl } from '@/lib/format';

const species = Object.keys(speciesLabel) as Species[];

const schema = z.object({
  name: z.string().min(1, 'Informe o nome'),
  clientId: z.string().min(1, 'Selecione o tutor'),
  species: z.enum(species as [Species, ...Species[]]),
  breed: z.string(),
  color: z.string(),
  birthDate: z.string(),
  weight: z.string(),
  microchip: z.string(),
  allergies: z.string(),
  observations: z.string(),
});
type Form = z.infer<typeof schema>;

const empty: Form = {
  name: '', clientId: '', species: 'DOG', breed: '', color: '', birthDate: '',
  weight: '', microchip: '', allergies: '', observations: '',
};

function toPayload(f: Form) {
  const { weight, birthDate, ...rest } = f;
  const out: Record<string, unknown> = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== ''));
  if (weight) out.weight = Number(weight.replace(',', '.'));
  if (birthDate) out.birthDate = new Date(birthDate).toISOString();
  return out;
}

function age(birth?: string | null) {
  if (!birth) return '—';
  const months = Math.floor((Date.now() - new Date(birth).getTime()) / (30.44 * 864e5));
  return months >= 12 ? `${Math.floor(months / 12)} ano(s)` : `${Math.max(months, 0)} mes(es)`;
}

export default function PetsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [speciesFilter, setSpeciesFilter] = useState<Species | ''>('');
  const [editing, setEditing] = useState<Pet | 'new' | null>(null);
  const [apiError, setApiError] = useState('');

  const { data: pets = [], isLoading } = useQuery({
    queryKey: ['pets', search],
    queryFn: async () => (await api.get<Pet[]>('/pets', { params: { search: search || undefined } })).data,
  });
  const { data: clients = [] } = useQuery({
    queryKey: ['clients', '', 'active'],
    queryFn: async () => (await api.get<Client[]>('/clients', { params: { active: 'true' } })).data,
  });

  const form = useForm<Form>({ resolver: zodResolver(schema), defaultValues: empty });

  const openModal = (p: Pet | 'new') => {
    setApiError('');
    setEditing(p);
    form.reset(
      p === 'new'
        ? empty
        : {
            name: p.name, clientId: p.clientId, species: p.species, breed: p.breed ?? '', color: p.color ?? '',
            birthDate: p.birthDate?.slice(0, 10) ?? '', weight: p.weight?.toString() ?? '',
            microchip: p.microchip ?? '', allergies: p.allergies ?? '', observations: p.observations ?? '',
          },
    );
  };

  const save = useMutation({
    mutationFn: async (f: Form) =>
      editing === 'new' || !editing ? api.post('/pets', toPayload(f)) : api.patch(`/pets/${editing.id}`, toPayload(f)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pets'] });
      qc.invalidateQueries({ queryKey: ['clients'] });
      setEditing(null);
    },
    onError: (e) => setApiError(errorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/pets/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pets'] }),
  });

  const err = form.formState.errors;
  const visible = pets.filter((p) => p.active && (!speciesFilter || p.species === speciesFilter));

  return (
    <>
      <PageHeader
        title="Pets"
        subtitle="Animais cadastrados"
        action={<button className={btnPrimary} onClick={() => openModal('new')}>+ Novo pet</button>}
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          className={`${inputCls} max-w-sm`}
          placeholder="Buscar por nome ou raça…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className={`${inputCls} max-w-[11rem]`} value={speciesFilter} onChange={(e) => setSpeciesFilter(e.target.value as Species | '')}>
          <option value="">Todas as espécies</option>
          {species.map((s) => <option key={s} value={s}>{speciesIcon[s]} {speciesLabel[s]}</option>)}
        </select>
      </div>

      <Card className="overflow-x-auto">
        {visible.length === 0 ? (
          <Empty>{isLoading ? 'Carregando…' : 'Nenhum pet encontrado'}</Empty>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Pet</th>
                <th className="hidden px-4 py-3 sm:table-cell">Raça</th>
                <th className="hidden px-4 py-3 md:table-cell">Idade</th>
                <th className="px-4 py-3">Tutor</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visible.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/pets/${p.id}`} className="text-primary-700 hover:underline">
                      {speciesIcon[p.species]} {p.name}
                    </Link>
                  </td>
                  <td className="hidden px-4 py-3 text-gray-500 sm:table-cell">{p.breed ?? speciesLabel[p.species]}</td>
                  <td className="hidden px-4 py-3 text-gray-500 md:table-cell">{age(p.birthDate)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/clientes/${p.clientId}`} className="text-primary-700 hover:underline">{p.client?.name}</Link>
                    {p.client?.phone && (
                      <a
                        href={whatsappUrl(p.client.phone)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`WhatsApp: ${p.client.phone}`}
                        className="ml-2 hover:opacity-70"
                      >
                        <WhatsAppIcon className="h-5 w-5" />
                      </a>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <button className="mr-3 text-primary-600 hover:underline" onClick={() => openModal(p)}>Editar</button>
                    <button
                      className="text-red-500 hover:underline"
                      onClick={() => confirm(`Desativar ${p.name}?`) && remove.mutate(p.id)}
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

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Novo pet' : 'Editar pet'}>
        <form onSubmit={form.handleSubmit((f) => save.mutate(f))} className="space-y-3">
          <ErrorBox message={apiError} />
          <Field label="Tutor *" error={err.clientId?.message}>
            <select className={inputCls} {...form.register('clientId')}>
              <option value="">Selecione…</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome *" error={err.name?.message}><input className={inputCls} {...form.register('name')} /></Field>
            <Field label="Espécie *">
              <select className={inputCls} {...form.register('species')}>
                {species.map((s) => <option key={s} value={s}>{speciesLabel[s]}</option>)}
              </select>
            </Field>
            <Field label="Raça"><input className={inputCls} {...form.register('breed')} /></Field>
            <Field label="Cor"><input className={inputCls} {...form.register('color')} /></Field>
            <Field label="Nascimento"><input type="date" className={inputCls} {...form.register('birthDate')} /></Field>
            <Field label="Peso (kg)"><input inputMode="decimal" className={inputCls} {...form.register('weight')} /></Field>
          </div>
          <Field label="Microchip"><input className={inputCls} {...form.register('microchip')} /></Field>
          <Field label="Alergias"><input className={inputCls} {...form.register('allergies')} /></Field>
          <Field label="Observações"><textarea rows={2} className={inputCls} {...form.register('observations')} /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className={btnGhost} onClick={() => setEditing(null)}>Cancelar</button>
            <button type="submit" className={btnPrimary} disabled={save.isPending}>{save.isPending ? 'Salvando…' : 'Salvar'}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
