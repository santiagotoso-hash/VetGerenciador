'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Appointment, Client, PaymentMethod, Sale } from '@/types';
import { Card, Empty } from '@/components/ui';
import { currency, dateTime, speciesIcon, speciesLabel, statusColor, statusLabel, typeLabel } from '@/lib/format';

type Tab = 'dados' | 'pets' | 'agendamentos' | 'historico';

const paymentLabel: Record<PaymentMethod, string> = {
  CASH: 'Dinheiro',
  PIX: 'Pix',
  CREDIT_CARD: 'Cartão de crédito',
  DEBIT_CARD: 'Cartão de débito',
  BANK_TRANSFER: 'Transferência',
  CHECK: 'Cheque',
};

export default function ClienteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>('dados');

  useEffect(() => {
    const aba = new URLSearchParams(window.location.search).get('aba');
    if (aba === 'pets' || aba === 'agendamentos' || aba === 'historico') setTab(aba);
  }, []);

  const { data: client, isLoading, error } = useQuery({
    queryKey: ['client', id],
    queryFn: async () => (await api.get<Client>(`/clients/${id}`)).data,
  });
  const { data: appointments = [] } = useQuery({
    queryKey: ['client', id, 'appointments'],
    queryFn: async () => {
      const list = (await api.get<Appointment[]>('/appointments', { params: { clientId: id } })).data;
      return [...list].sort((a, b) => b.date.localeCompare(a.date)); // mais recentes primeiro
    },
  });
  const { data: sales = [] } = useQuery({
    queryKey: ['client', id, 'sales'],
    queryFn: async () => (await api.get<Sale[]>('/sales', { params: { clientId: id } })).data,
  });

  if (error) {
    return (
      <Card className="p-8 text-center">
        <p className="text-gray-600">Cliente não encontrado.</p>
        <Link href="/clientes" className="mt-2 inline-block text-primary-600 hover:underline">← Voltar para Clientes</Link>
      </Card>
    );
  }
  if (isLoading || !client) return <Empty>Carregando…</Empty>;

  const pets = (client.pets ?? []).filter((p) => p.active);
  const totalSpent = sales.reduce((s, x) => s + x.total, 0);
  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'dados', label: 'Dados' },
    { key: 'pets', label: 'Pets', count: pets.length },
    { key: 'agendamentos', label: 'Agendamentos', count: appointments.length },
    { key: 'historico', label: 'Histórico', count: sales.length },
  ];

  const fields: [string, string | null | undefined][] = [
    ['Telefone', client.phone],
    ['E-mail', client.email],
    ['CPF', client.cpf],
    ['Endereço', [client.address, client.city, client.state].filter(Boolean).join(', ')],
    ['CEP', client.zipCode],
    ['Cliente desde', new Date(client.createdAt).toLocaleDateString('pt-BR')],
    ['Observações', client.notes],
  ];

  return (
    <>
      <Link href="/clientes" className="mb-3 inline-block text-sm text-primary-600 hover:underline">← Clientes</Link>

      <Card className="mb-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{client.name}</h1>
            <p className="text-sm text-gray-500">{[client.phone, client.email].filter(Boolean).join(' · ')}</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500">Total em compras</div>
            <div className="text-xl font-bold text-primary-700">{currency(totalSpent)}</div>
          </div>
        </div>
        {!client.active && <div className="mt-3 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-600">Cliente desativado</div>}
      </Card>

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-gray-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${
              tab === t.key ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
            {t.count !== undefined && <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 text-xs text-gray-600">{t.count}</span>}
          </button>
        ))}
      </div>

      {tab === 'dados' && (
        <Card className="p-5">
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            {fields.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs font-medium uppercase text-gray-500">{label}</dt>
                <dd className="mt-0.5">{value || <span className="text-gray-400">—</span>}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 text-xs text-gray-400">Para alterar estes dados, use "Editar" na lista de Clientes.</p>
        </Card>
      )}

      {tab === 'pets' && (
        <Card>
          {pets.length === 0 ? (
            <Empty>Nenhum pet cadastrado</Empty>
          ) : (
            <ul className="divide-y divide-gray-100">
              {pets.map((p) => (
                <li key={p.id}>
                  <Link href={`/pets/${p.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-gray-50">
                    <span className="font-medium">{speciesIcon[p.species]} {p.name}</span>
                    <span className="text-sm text-gray-500">{p.breed ?? speciesLabel[p.species]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === 'agendamentos' && (
        <Card>
          {appointments.length === 0 ? (
            <Empty>Nenhum agendamento</Empty>
          ) : (
            <ul className="divide-y divide-gray-100">
              {appointments.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                  <div>
                    <div className="font-medium">
                      {dateTime(a.date)} ·{' '}
                      <Link href={`/pets/${a.petId}`} className="text-primary-700 hover:underline">
                        {a.pet && speciesIcon[a.pet.species]} {a.pet?.name}
                      </Link>
                    </div>
                    <div className="text-xs text-gray-500">
                      {a.service?.name ?? typeLabel[a.type]}
                      {a.service && ` · ${a.service.name}`}
                      {a.scheduledBy && ` · agendado por ${a.scheduledBy.name}`}
                    </div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${statusColor[a.status]}`}>{statusLabel[a.status]}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === 'historico' && (
        <Card>
          {sales.length === 0 ? (
            <Empty>Nenhuma compra registrada</Empty>
          ) : (
            <ul className="divide-y divide-gray-100">
              {sales.map((s) => (
                <li key={s.id} className="p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium">
                      {dateTime(s.date)} <span className="font-normal text-gray-500">· {paymentLabel[s.paymentMethod]}</span>
                    </div>
                    <div className="font-semibold">{currency(s.total)}</div>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {s.items.map((i) => `${i.quantity}× ${i.product?.name ?? i.service?.name}`).join(', ')}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </>
  );
}
