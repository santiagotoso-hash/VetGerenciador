'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, errorMessage } from '@/lib/api';
import type { Appointment, AppointmentStatus, AppointmentType, Pet, Service, User } from '@/types';
import { btnGhost, btnPrimary, Card, Empty, ErrorBox, Field, inputCls, Modal, PageHeader } from '@/components/ui';
import { statusColor, statusLabel, toLocalInput, typeLabel } from '@/lib/format';

const types = Object.keys(typeLabel) as AppointmentType[];

const schema = z.object({
  petId: z.string().min(1, 'Selecione o pet'),
  type: z.enum(types as [AppointmentType, ...AppointmentType[]]),
  date: z.string().min(1, 'Informe data e hora'),
  scheduledById: z.string(),
  serviceId: z.string(),
  notes: z.string(),
  notifyClient: z.boolean(),
});
type Form = z.infer<typeof schema>;

const nextStatus: Partial<Record<AppointmentStatus, { to: AppointmentStatus; label: string }>> = {
  SCHEDULED: { to: 'CONFIRMED', label: 'Confirmar' },
  CONFIRMED: { to: 'IN_PROGRESS', label: 'Iniciar' },
  IN_PROGRESS: { to: 'COMPLETED', label: 'Concluir' },
};

const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const dayKey = (d: Date) => toLocalInput(d).slice(0, 10);
const parseDay = (key: string) => new Date(`${key}T00:00:00`);
const time = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export default function AgendaPage() {
  const qc = useQueryClient();
  const todayKey = dayKey(new Date());
  const [selected, setSelected] = useState(todayKey);
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [apiError, setApiError] = useState('');

  // 42 células (6 semanas) começando no domingo anterior ao dia 1
  const cells = useMemo(() => {
    const start = new Date(cursor);
    start.setDate(1 - start.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [cursor]);

  const from = cells[0].toISOString();
  const to = useMemo(() => {
    const t = new Date(cells[41]);
    t.setDate(t.getDate() + 1);
    return t.toISOString();
  }, [cells]);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['appointments', from],
    queryFn: async () => (await api.get<Appointment[]>('/appointments', { params: { from, to } })).data,
  });
  const { data: pets = [] } = useQuery({ queryKey: ['pets', ''], queryFn: async () => (await api.get<Pet[]>('/pets')).data });
  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: async () => (await api.get<Service[]>('/services', { params: { active: 'true' } })).data,
  });
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await api.get<User[]>('/users', { params: { active: 'true' } })).data,
    retry: false,
  });
  const attendants = users.filter((u) => u.role === 'RECEPTIONIST');

  const byDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of items) {
      const k = dayKey(new Date(a.date));
      map.set(k, [...(map.get(k) ?? []), a]);
    }
    return map;
  }, [items]);

  const dayItems = byDay.get(selected) ?? [];

  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { petId: '', type: 'CONSULTATION', date: '', scheduledById: '', serviceId: '', notes: '', notifyClient: false },
  });

  const selectedPet = pets.find((p) => p.id === form.watch('petId'));
  const clientEmail = selectedPet?.client?.email?.trim() || '';

  const openNew = (key = selected) => {
    setApiError('');
    setEditing(null);
    const d = parseDay(key);
    d.setHours(9, 0);
    form.reset({ petId: '', type: 'CONSULTATION', date: toLocalInput(d), scheduledById: '', serviceId: '', notes: '', notifyClient: false });
    setOpen(true);
  };

  const openEdit = (a: Appointment) => {
    setApiError('');
    setEditing(a);
    form.reset({
      petId: a.petId,
      type: a.type,
      date: toLocalInput(new Date(a.date)),
      scheduledById: a.scheduledBy?.id ?? '',
      serviceId: a.serviceId ?? '',
      notes: a.notes ?? '',
      notifyClient: !!a.notifyClient,
    });
    setOpen(true);
  };

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['appointments'] });
    qc.invalidateQueries({ queryKey: ['pet'] });
    qc.invalidateQueries({ queryKey: ['client'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const save = useMutation({
    mutationFn: async (f: Form) => {
      const body = {
        petId: f.petId,
        type: f.type,
        date: new Date(f.date).toISOString(),
        ...(f.scheduledById && { scheduledById: f.scheduledById }),
        ...(f.serviceId && { serviceId: f.serviceId }),
        ...(f.notes && { notes: f.notes }),
        notifyClient: f.notifyClient && !!clientEmail,
      };
      return editing
        ? api.patch(`/appointments/${editing.id}`, { ...body, serviceId: f.serviceId || undefined, notes: f.notes })
        : api.post('/appointments', body);
    },
    onSuccess: () => {
      refresh();
      setOpen(false);
    },
    onError: (e) => setApiError(errorMessage(e)),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AppointmentStatus }) =>
      api.patch(`/appointments/${id}/status`, { status }),
    onSuccess: refresh,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/appointments/${id}`),
    onSuccess: refresh,
    onError: (e) => alert(errorMessage(e)),
  });

  const goMonth = (offset: number) => {
    const c = new Date(cursor.getFullYear(), cursor.getMonth() + offset, 1);
    setCursor(c);
    setSelected(dayKey(c));
  };
  const goToday = () => {
    const n = new Date();
    setCursor(new Date(n.getFullYear(), n.getMonth(), 1));
    setSelected(dayKey(n));
  };

  const monthLabel = cursor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const selectedLabel = parseDay(selected).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <>
      <PageHeader
        title="Agenda"
        subtitle="Calendário de atendimentos"
        action={<button className={btnPrimary} onClick={() => openNew()}>+ Novo agendamento</button>}
      />

      <div className="mb-3 flex items-center gap-2">
        <button className={btnGhost} onClick={() => goMonth(-1)} aria-label="Mês anterior">←</button>
        <h2 className="min-w-[10rem] text-center text-lg font-semibold capitalize">{monthLabel}</h2>
        <button className={btnGhost} onClick={() => goMonth(1)} aria-label="Próximo mês">→</button>
        <button className={btnGhost} onClick={goToday}>Hoje</button>
        {isLoading && <span className="text-xs text-gray-400">Carregando…</span>}
      </div>

      <Card className="mb-6 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50 text-center text-xs font-medium uppercase text-gray-500">
          {weekdays.map((w) => <div key={w} className="py-2">{w}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((d) => {
            const k = dayKey(d);
            const inMonth = d.getMonth() === cursor.getMonth();
            const list = byDay.get(k) ?? [];
            const active = list.filter((a) => a.status !== 'CANCELLED');
            const isSel = k === selected;
            const isToday = k === todayKey;
            return (
              <button
                key={k}
                onClick={() => setSelected(k)}
                onDoubleClick={() => openNew(k)}
                className={`min-h-[3.5rem] border-b border-r border-gray-100 p-1 text-left align-top transition-colors sm:min-h-[6.5rem] sm:p-1.5 ${
                  inMonth ? 'bg-white' : 'bg-gray-50 text-gray-400'
                } ${isSel ? 'ring-2 ring-inset ring-primary-500' : 'hover:bg-primary-50/40'}`}
              >
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                    isToday ? 'bg-primary-600 text-white' : ''
                  }`}
                >
                  {d.getDate()}
                </span>

                {/* celular: só um contador */}
                {active.length > 0 && (
                  <span className="mt-1 block rounded bg-primary-100 px-1 text-center text-[10px] font-semibold text-primary-700 sm:hidden">
                    {active.length}
                  </span>
                )}

                {/* telas maiores: até 3 compromissos */}
                <div className="mt-1 hidden space-y-0.5 sm:block">
                  {active.slice(0, 3).map((a) => (
                    <div key={a.id} className={`truncate rounded px-1 py-0.5 text-[11px] ${statusColor[a.status]}`}>
                      {time(a.date)} {a.pet?.name}
                    </div>
                  ))}
                  {active.length > 3 && <div className="px-1 text-[11px] text-gray-500">+{active.length - 3} mais</div>}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold capitalize">{selectedLabel}</h2>
        <button className="text-sm text-primary-600 hover:underline" onClick={() => openNew()}>+ Agendar neste dia</button>
      </div>

      <Card>
        {dayItems.length === 0 ? (
          <Empty>Nenhum agendamento neste dia</Empty>
        ) : (
          <ul className="divide-y divide-gray-100">
            {dayItems.map((a) => {
              const next = nextStatus[a.status];
              const closed = a.status === 'CANCELLED' || a.status === 'COMPLETED' || a.status === 'NO_SHOW';
              return (
                <li key={a.id} className="flex flex-wrap items-center gap-3 p-4">
                  <div className="w-14 shrink-0 text-lg font-semibold text-primary-700">{time(a.date)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">
                      {a.pet?.name} <span className="font-normal text-gray-500">· {a.pet?.client?.name}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {a.service?.name ?? typeLabel[a.type]}
                      {a.service && ` · ${a.service.name}`}
                      {a.scheduledBy && ` · agendado por ${a.scheduledBy.name}`}
                    </div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${statusColor[a.status]}`}>{statusLabel[a.status]}</span>
                  <Link href={`/pets/${a.petId}?aba=prontuario`} className="text-sm text-gray-600 hover:underline">
                    📋 Prontuário
                  </Link>
                  <div className="flex gap-3 text-sm">
                    {a.status !== 'CANCELLED' && (
                      <button className="text-gray-600 hover:underline" onClick={() => openEdit(a)}>Editar</button>
                    )}
                    <button
                      className="text-red-600 hover:underline"
                      onClick={() =>
                        confirm(`Excluir este agendamento de ${a.pet?.name}? Esta ação não pode ser desfeita.`) && remove.mutate(a.id)
                      }
                    >
                      Excluir
                    </button>
                  </div>
                  {!closed && (
                    <div className="flex gap-2 text-sm">
                      {next && (
                        <button className="text-primary-600 hover:underline" onClick={() => setStatus.mutate({ id: a.id, status: next.to })}>
                          {next.label}
                        </button>
                      )}
                      <button
                        className="text-red-500 hover:underline"
                        onClick={() => confirm('Cancelar este agendamento?') && setStatus.mutate({ id: a.id, status: 'CANCELLED' })}
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Editar agendamento' : 'Novo agendamento'}>
        <form onSubmit={form.handleSubmit((f) => save.mutate(f))} className="space-y-3">
          <ErrorBox message={apiError} />
          <Field label="Pet *" error={form.formState.errors.petId?.message}>
            <select className={inputCls} {...form.register('petId')}>
              <option value="">Selecione…</option>
              {pets.filter((p) => p.active).map((p) => (
                <option key={p.id} value={p.id}>{p.name} — {p.client?.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Serviço">
            <select className={inputCls} {...form.register('serviceId')}>
              <option value="">Consulta (sem serviço específico)</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Data e hora *" error={form.formState.errors.date?.message}>
            <input type="datetime-local" className={inputCls} {...form.register('date')} />
          </Field>
          {attendants.length > 0 && (
            <Field label="Agendado por">
              <select className={inputCls} {...form.register('scheduledById')}>
                <option value="">—</option>
                {attendants.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </Field>
          )}
          <Field label="Observações"><textarea rows={2} className={inputCls} {...form.register('notes')} /></Field>
          <label className={`flex items-start gap-2 rounded-lg border border-gray-200 p-3 text-sm ${clientEmail ? '' : 'opacity-60'}`}>
            <input type="checkbox" className="mt-0.5" disabled={!clientEmail} {...form.register('notifyClient')} />
            <span>
              <span className="font-medium text-gray-700">Enviar e-mail ao cliente</span>
              <span className="block text-xs text-gray-500">
                {selectedPet
                  ? clientEmail
                    ? editing
                      ? `Avisa as mudanças (e cancelamento) por e-mail para ${clientEmail}.`
                      : `Confirmação agora e lembrete 1 dia antes, para ${clientEmail}.`
                    : 'Este cliente não tem e-mail cadastrado.'
                  : 'Confirmação agora e lembrete 1 dia antes. Selecione o pet primeiro.'}
              </span>
            </span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className={btnGhost} onClick={() => setOpen(false)}>Cancelar</button>
            <button type="submit" className={btnPrimary} disabled={save.isPending}>{save.isPending ? 'Salvando…' : editing ? 'Salvar alterações' : 'Agendar'}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
