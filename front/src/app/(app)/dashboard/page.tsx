'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { DashboardStats } from '@/types';
import { Card, Empty, PageHeader } from '@/components/ui';
import { currency, dateTime, speciesIcon, statusColor, statusLabel, typeLabel } from '@/lib/format';

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => (await api.get<DashboardStats>('/reports/dashboard')).data,
  });

  const stats = [
    { label: 'Consultas hoje', value: data?.appointmentsToday, icon: '📅' },
    { label: 'Pets atendidos', value: data?.petsAttended, icon: '🐾' },
    { label: 'Agendamentos pendentes', value: data?.pendingAppointments, icon: '⏳' },
    { label: 'Faturamento hoje', value: data ? currency(data.revenueToday) : undefined, icon: '💰' },
    { label: 'Estoque baixo', value: data?.lowStockCount, icon: '📦' },
  ];

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Visão geral do dia" />
      {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">Não foi possível carregar os dados.</div>}

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <div className="text-2xl">{s.icon}</div>
            <div className="mt-2 text-2xl font-bold text-gray-900">{isLoading ? '…' : s.value ?? 0}</div>
            <div className="text-xs text-gray-500">{s.label}</div>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <h2 className="mb-3 font-semibold">Próximos atendimentos</h2>
        {data?.upcomingAppointments.length ? (
          <ul className="divide-y divide-gray-100">
            {data.upcomingAppointments.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="truncate font-medium">
                    {a.pet ? speciesIcon[a.pet.species] : ''} {a.pet?.name}{' '}
                    <span className="font-normal text-gray-500">· {a.pet?.client?.name}</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {dateTime(a.date)} · {a.service?.name ?? typeLabel[a.type]}
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${statusColor[a.status]}`}>
                  {statusLabel[a.status]}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>{isLoading ? 'Carregando…' : 'Nenhum atendimento agendado'}</Empty>
        )}
      </Card>
    </>
  );
}
