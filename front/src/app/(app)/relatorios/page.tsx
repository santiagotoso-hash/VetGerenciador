'use client';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '@/lib/api';
import type { AppointmentStatus, Species } from '@/types';
import { Card, Empty, inputCls, PageHeader } from '@/components/ui';
import { currency, speciesLabel, statusLabel } from '@/lib/format';

type Preset = '7' | '30' | 'mes' | 'custom';
interface Top { name: string; quantity: number; total: number }

const COLORS = ['#0284c7', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#14b8a6', '#ec4899', '#64748b'];
const STATUS_COLORS: Record<AppointmentStatus, string> = {
  SCHEDULED: '#3b82f6',
  CONFIRMED: '#0ea5e9',
  IN_PROGRESS: '#f59e0b',
  COMPLETED: '#22c55e',
  CANCELLED: '#9ca3af',
  NO_SHOW: '#ef4444',
};

const ymd = (d: Date) => d.toLocaleDateString('sv-SE');
const startOf = (key: string) => new Date(`${key}T00:00:00`);
const endOf = (key: string) => new Date(`${key}T23:59:59.999`);
const shortDate = (key: string) => key.slice(8, 10) + '/' + key.slice(5, 7);

export default function RelatoriosPage() {
  const [preset, setPreset] = useState<Preset>('30');
  const [customFrom, setCustomFrom] = useState(() => ymd(new Date(Date.now() - 29 * 864e5)));
  const [customTo, setCustomTo] = useState(() => ymd(new Date()));

  const { fromKey, toKey } = useMemo(() => {
    const today = new Date();
    if (preset === 'custom') return { fromKey: customFrom, toKey: customTo };
    if (preset === 'mes') return { fromKey: ymd(new Date(today.getFullYear(), today.getMonth(), 1)), toKey: ymd(today) };
    const days = Number(preset);
    return { fromKey: ymd(new Date(today.getTime() - (days - 1) * 864e5)), toKey: ymd(today) };
  }, [preset, customFrom, customTo]);

  const valid = fromKey && toKey && fromKey <= toKey;
  const params = valid ? { from: startOf(fromKey).toISOString(), to: endOf(toKey).toISOString() } : null;
  const enabled = !!params;

  const { data: revenueRaw = [], isLoading } = useQuery({
    queryKey: ['rep', 'revenue', params],
    queryFn: async () => (await api.get<{ date: string; amount: number }[]>('/reports/revenue', { params })).data,
    enabled,
  });
  const { data: apptRaw = [] } = useQuery({
    queryKey: ['rep', 'appointments', params],
    queryFn: async () => (await api.get<{ date: string; count: number }[]>('/reports/appointments', { params })).data,
    enabled,
  });
  const { data: statusData = [] } = useQuery({
    queryKey: ['rep', 'status', params],
    queryFn: async () => (await api.get<{ status: AppointmentStatus; count: number }[]>('/reports/appointments-status', { params })).data,
    enabled,
  });
  const { data: top } = useQuery({
    queryKey: ['rep', 'top', params],
    queryFn: async () => (await api.get<{ products: Top[]; services: Top[] }>('/reports/top-items', { params })).data,
    enabled,
  });
  const { data: species = [] } = useQuery({
    queryKey: ['rep', 'species'],
    queryFn: async () => (await api.get<{ species: Species; count: number }[]>('/reports/species')).data,
  });

  // Preenche os dias sem movimento com zero para o eixo ficar contínuo.
  const days = useMemo(() => {
    if (!valid) return [];
    const out: string[] = [];
    for (let d = startOf(fromKey); ymd(d) <= toKey && out.length < 366; d.setDate(d.getDate() + 1)) out.push(ymd(d));
    return out;
  }, [valid, fromKey, toKey]);

  const revenue = useMemo(() => {
    const m = new Map(revenueRaw.map((r) => [r.date, r.amount]));
    return days.map((d) => ({ date: shortDate(d), amount: m.get(d) ?? 0 }));
  }, [days, revenueRaw]);
  const appts = useMemo(() => {
    const m = new Map(apptRaw.map((r) => [r.date, r.count]));
    return days.map((d) => ({ date: shortDate(d), count: m.get(d) ?? 0 }));
  }, [days, apptRaw]);

  const totalRevenue = revenueRaw.reduce((s, r) => s + r.amount, 0);
  const totalAppts = statusData.reduce((s, r) => s + r.count, 0);
  const countOf = (s: AppointmentStatus) => statusData.find((x) => x.status === s)?.count ?? 0;
  const pct = (n: number) => (totalAppts ? `${Math.round((n / totalAppts) * 100)}%` : '—');

  const cards = [
    { label: 'Faturamento', value: currency(totalRevenue) },
    { label: 'Atendimentos', value: String(totalAppts) },
    { label: 'Concluídos', value: pct(countOf('COMPLETED')) },
    { label: 'Faltas', value: pct(countOf('NO_SHOW')) },
  ];

  const presets: { key: Preset; label: string }[] = [
    { key: '7', label: '7 dias' },
    { key: '30', label: '30 dias' },
    { key: 'mes', label: 'Este mês' },
    { key: 'custom', label: 'Personalizado' },
  ];

  return (
    <>
      <PageHeader title="Relatórios" subtitle="Desempenho da clínica" />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {presets.map((p) => (
          <button
            key={p.key}
            onClick={() => setPreset(p.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${preset === p.key ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
          >
            {p.label}
          </button>
        ))}
        {preset === 'custom' && (
          <>
            <input type="date" className={`${inputCls} max-w-[10rem]`} value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            <span className="text-gray-400">até</span>
            <input type="date" className={`${inputCls} max-w-[10rem]`} value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
          </>
        )}
      </div>

      {!valid ? (
        <Card><Empty>Período inválido: a data inicial deve ser anterior à final.</Empty></Card>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {cards.map((c) => (
              <Card key={c.label} className="p-4">
                <div className="text-xs text-gray-500">{c.label}</div>
                <div className="mt-1 text-2xl font-bold text-gray-900">{isLoading ? '…' : c.value}</div>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-4 lg:col-span-2">
              <h2 className="mb-3 font-semibold">Faturamento por dia</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={revenue}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={20} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$ ${v}`} width={64} />
                    <Tooltip formatter={(v: number) => [currency(v), 'Faturamento']} />
                    <Line type="monotone" dataKey="amount" stroke="#0284c7" strokeWidth={2} dot={revenue.length <= 31} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-4">
              <h2 className="mb-3 font-semibold">Atendimentos por dia</h2>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={appts}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={20} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={28} />
                    <Tooltip formatter={(v: number) => [v, 'Atendimentos']} />
                    <Bar dataKey="count" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-4">
              <h2 className="mb-3 font-semibold">Agendamentos por status</h2>
              {statusData.length === 0 ? (
                <Empty>Sem agendamentos no período</Empty>
              ) : (
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusData.map((s) => ({ ...s, name: statusLabel[s.status] }))} dataKey="count" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                        {statusData.map((s) => <Cell key={s.status} fill={STATUS_COLORS[s.status]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <Card className="p-4">
              <h2 className="mb-3 font-semibold">Produtos mais vendidos</h2>
              <TopList items={top?.products} />
            </Card>

            <Card className="p-4">
              <h2 className="mb-3 font-semibold">Serviços mais vendidos</h2>
              <TopList items={top?.services} />
            </Card>

            <Card className="p-4 lg:col-span-2">
              <h2 className="mb-3 font-semibold">Pets por espécie</h2>
              <p className="-mt-2 mb-2 text-xs text-gray-400">Todos os pets ativos, sem filtro de período.</p>
              {species.length === 0 ? (
                <Empty>Nenhum pet cadastrado</Empty>
              ) : (
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={species.map((s) => ({ ...s, name: speciesLabel[s.species] }))} dataKey="count" nameKey="name" outerRadius={80} label={(e) => `${e.name} (${e.count})`}>
                        {species.map((s, i) => <Cell key={s.species} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </>
  );
}

function TopList({ items }: { items?: Top[] }) {
  if (!items?.length) return <Empty>Sem vendas no período</Empty>;
  const max = Math.max(...items.map((i) => i.total));
  return (
    <ol className="space-y-3">
      {items.map((i, idx) => (
        <li key={i.name}>
          <div className="mb-1 flex justify-between gap-2 text-sm">
            <span className="truncate"><span className="mr-2 text-gray-400">{idx + 1}.</span>{i.name}</span>
            <span className="shrink-0 font-medium">{currency(i.total)} <span className="font-normal text-gray-400">· {i.quantity} un</span></span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-primary-500" style={{ width: `${(i.total / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ol>
  );
}
