'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, errorMessage } from '@/lib/api';
import type { Appointment, MedicalRecord, Pet } from '@/types';
import { btnGhost, btnPrimary, Card, Empty, ErrorBox, Field, inputCls, Modal } from '@/components/ui';
import { dateTime, speciesIcon, speciesLabel, statusColor, statusLabel, toLocalInput, typeLabel } from '@/lib/format';

type Tab = 'dados' | 'prontuario' | 'agendamentos';

const num = z.string().refine((v) => v === '' || !isNaN(Number(v.replace(',', '.'))), 'Número inválido');
const schema = z.object({
  date: z.string().min(1, 'Informe a data'),
  anamnesis: z.string(),
  diagnosis: z.string(),
  treatment: z.string(),
  prescription: z.string(),
  exams: z.string(),
  weight: num,
  temperature: num,
  heartRate: num,
  notes: z.string(),
});
type Form = z.infer<typeof schema>;

const textFields = ['anamnesis', 'diagnosis', 'treatment', 'prescription', 'exams', 'notes'] as const;
const n = (v: string) => Number(v.replace(',', '.'));

function toPayload(f: Form, editing: boolean) {
  const out: Record<string, unknown> = { date: new Date(f.date).toISOString() };
  // ao editar, manda texto vazio para permitir apagar o campo
  for (const k of textFields) if (editing || f[k]) out[k] = f[k];
  if (f.weight) out.weight = n(f.weight);
  if (f.temperature) out.temperature = n(f.temperature);
  if (f.heartRate) out.heartRate = Math.round(n(f.heartRate));
  return out;
}

const sections: { key: (typeof textFields)[number]; label: string }[] = [
  { key: 'anamnesis', label: 'Anamnese' },
  { key: 'diagnosis', label: 'Diagnóstico' },
  { key: 'treatment', label: 'Tratamento' },
  { key: 'prescription', label: 'Prescrição' },
  { key: 'exams', label: 'Exames' },
  { key: 'notes', label: 'Observações' },
];

/** Redimensiona a imagem no navegador (máx. 320px) e devolve um data URL JPEG leve. */
function resizeImage(file: File, max = 320): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Arquivo de imagem inválido'));
    };
    img.src = url;
  });
}

function age(birth?: string | null) {
  if (!birth) return null;
  const months = Math.floor((Date.now() - new Date(birth).getTime()) / (30.44 * 864e5));
  return months >= 12 ? `${Math.floor(months / 12)} ano(s)` : `${Math.max(months, 0)} mes(es)`;
}

export default function PetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('dados');
  const [editing, setEditing] = useState<MedicalRecord | 'new' | null>(null);
  const [apiError, setApiError] = useState('');

  useEffect(() => {
    const aba = new URLSearchParams(window.location.search).get('aba');
    if (aba === 'prontuario' || aba === 'agendamentos') setTab(aba);
  }, []);

  const { data: pet, isLoading, error } = useQuery({
    queryKey: ['pet', id],
    queryFn: async () => (await api.get<Pet>(`/pets/${id}`)).data,
  });
  const { data: records = [] } = useQuery({
    queryKey: ['pet', id, 'records'],
    queryFn: async () => (await api.get<MedicalRecord[]>(`/pets/${id}/medical-records`)).data,
  });
  const { data: appointments = [] } = useQuery({
    queryKey: ['pet', id, 'appointments'],
    queryFn: async () => (await api.get<Appointment[]>(`/pets/${id}/appointments`)).data,
  });

  const patchPet = useMutation({
    mutationFn: async (data: Partial<Pet>) => (await api.patch<Pet>(`/pets/${id}`, data)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pet', id] });
      qc.invalidateQueries({ queryKey: ['pets'] });
      setApiError('');
    },
    onError: (e) => setApiError(errorMessage(e)),
  });

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      patchPet.mutate({ photo: await resizeImage(file) });
    } catch (err) {
      setApiError((err as Error).message);
    }
  };

  const form = useForm<Form>({ resolver: zodResolver(schema) });

  const openModal = (r: MedicalRecord | 'new') => {
    setApiError('');
    setEditing(r);
    form.reset(
      r === 'new'
        ? {
            date: toLocalInput(new Date()), anamnesis: '', diagnosis: '', treatment: '', prescription: '',
            exams: '', weight: pet?.weight?.toString() ?? '', temperature: '', heartRate: '', notes: '',
          }
        : {
            date: toLocalInput(new Date(r.date)), anamnesis: r.anamnesis ?? '', diagnosis: r.diagnosis ?? '',
            treatment: r.treatment ?? '', prescription: r.prescription ?? '', exams: r.exams ?? '',
            weight: r.weight?.toString() ?? '', temperature: r.temperature?.toString() ?? '',
            heartRate: r.heartRate?.toString() ?? '', notes: r.notes ?? '',
          },
    );
  };

  const save = useMutation({
    mutationFn: async (f: Form) =>
      editing === 'new' || !editing
        ? api.post('/medical-records', { petId: id, ...toPayload(f, false) })
        : api.patch(`/medical-records/${editing.id}`, toPayload(f, true)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pet', id, 'records'] });
      setEditing(null);
    },
    onError: (e) => setApiError(errorMessage(e)),
  });

  if (error) {
    return (
      <Card className="p-8 text-center">
        <p className="text-gray-600">Pet não encontrado.</p>
        <Link href="/pets" className="mt-2 inline-block text-primary-600 hover:underline">← Voltar para Pets</Link>
      </Card>
    );
  }
  if (isLoading || !pet) return <Empty>Carregando…</Empty>;

  const err = form.formState.errors;
  const canBirthday = !!pet.birthDate && !!pet.client?.email?.trim();
  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'dados', label: 'Dados' },
    { key: 'prontuario', label: 'Prontuário', count: records.length },
    { key: 'agendamentos', label: 'Agendamentos', count: appointments.length },
  ];

  return (
    <>
      <Link href="/pets" className="mb-3 inline-block text-sm text-primary-600 hover:underline">← Pets</Link>

      <Card className="mb-4 p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-col items-center gap-1">
            {pet.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pet.photo} alt={pet.name} className="h-24 w-24 rounded-full object-cover ring-2 ring-primary-100" />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary-50 text-5xl">{speciesIcon[pet.species]}</div>
            )}
            <div className="flex gap-2 text-xs">
              <label className="cursor-pointer text-primary-600 hover:underline">
                {pet.photo ? 'Trocar' : 'Adicionar foto'}
                <input type="file" accept="image/*" className="hidden" onChange={onPhoto} />
              </label>
              {pet.photo && (
                <button className="text-red-500 hover:underline" onClick={() => patchPet.mutate({ photo: '' })}>Remover</button>
              )}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold">{pet.name}</h1>
            <p className="text-sm text-gray-500">
              {[speciesLabel[pet.species], pet.breed, age(pet.birthDate), pet.weight ? `${pet.weight} kg` : null]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <p className="text-sm text-gray-500">
              Tutor: <span className="font-medium text-gray-700">{pet.client?.name}</span>
              {pet.client?.phone && ` · ${pet.client.phone}`}
            </p>
          </div>
        </div>
        <ErrorBox message={apiError} />
        {pet.allergies && (
          <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">⚠️ <strong>Alergias:</strong> {pet.allergies}</div>
        )}
      </Card>

      <div className="mb-4 flex gap-1 border-b border-gray-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
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
            {[
              ['Espécie', speciesLabel[pet.species]],
              ['Raça', pet.breed],
              ['Cor', pet.color],
              ['Nascimento', pet.birthDate ? new Date(pet.birthDate).toLocaleDateString('pt-BR') : null],
              ['Peso', pet.weight ? `${pet.weight} kg` : null],
              ['Microchip', pet.microchip],
              ['Observações', pet.observations],
            ].map(([label, value]) => (
              <div key={label as string}>
                <dt className="text-xs font-medium uppercase text-gray-500">{label}</dt>
                <dd className="mt-0.5">{value || <span className="text-gray-400">—</span>}</dd>
              </div>
            ))}
          </dl>
          <label className={`mt-5 flex items-start gap-2 rounded-lg border border-gray-200 p-3 text-sm ${canBirthday ? '' : 'opacity-60'}`}>
            <input
              type="checkbox"
              className="mt-0.5"
              disabled={!canBirthday || patchPet.isPending}
              checked={!!pet.birthdayEmail && canBirthday}
              onChange={(e) => patchPet.mutate({ birthdayEmail: e.target.checked })}
            />
            <span>
              <span className="font-medium text-gray-700">🎂 Enviar e-mail de feliz aniversário ao tutor</span>
              <span className="block text-xs text-gray-500">
                {!pet.birthDate
                  ? 'Cadastre a data de nascimento do pet para ativar.'
                  : !pet.client?.email
                    ? 'O tutor não tem e-mail cadastrado.'
                    : `Enviado automaticamente todo ano, no dia do aniversário, para ${pet.client.email}.`}
              </span>
            </span>
          </label>
          <p className="mt-5 text-xs text-gray-400">Para alterar estes dados, use "Editar" na lista de Pets.</p>
        </Card>
      )}

      {tab === 'prontuario' && (
        <>
          <div className="mb-3 flex justify-end">
            <button className={btnPrimary} onClick={() => openModal('new')}>+ Novo registro</button>
          </div>
          {records.length === 0 ? (
            <Card><Empty>Nenhum registro clínico ainda</Empty></Card>
          ) : (
            <ol className="space-y-3">
              {records.map((r) => (
                <li key={r.id}>
                  <Card className="p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-semibold">{dateTime(r.date)}</div>
                        <div className="text-xs text-gray-500">{r.veterinarian?.name}</div>
                      </div>
                      <button className="text-sm text-primary-600 hover:underline" onClick={() => openModal(r)}>Editar</button>
                    </div>
                    {(r.weight || r.temperature || r.heartRate) && (
                      <div className="mb-3 flex flex-wrap gap-2 text-xs">
                        {r.weight && <span className="rounded-full bg-gray-100 px-2 py-1">⚖️ {r.weight} kg</span>}
                        {r.temperature && <span className="rounded-full bg-gray-100 px-2 py-1">🌡️ {r.temperature} °C</span>}
                        {r.heartRate && <span className="rounded-full bg-gray-100 px-2 py-1">❤️ {r.heartRate} bpm</span>}
                      </div>
                    )}
                    <div className="space-y-2 text-sm">
                      {sections.filter((s) => r[s.key]).map((s) => (
                        <div key={s.key}>
                          <div className="text-xs font-medium uppercase text-gray-500">{s.label}</div>
                          <p className="whitespace-pre-wrap">{r[s.key]}</p>
                        </div>
                      ))}
                    </div>
                  </Card>
                </li>
              ))}
            </ol>
          )}
        </>
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
                    <div className="font-medium">{dateTime(a.date)}</div>
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

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Novo registro clínico' : 'Editar registro'}>
        <form onSubmit={form.handleSubmit((f) => save.mutate(f))} className="space-y-3">
          <ErrorBox message={apiError} />
          <Field label="Data e hora *" error={err.date?.message}>
            <input type="datetime-local" className={inputCls} {...form.register('date')} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Peso (kg)" error={err.weight?.message}><input inputMode="decimal" className={inputCls} {...form.register('weight')} /></Field>
            <Field label="Temp. (°C)" error={err.temperature?.message}><input inputMode="decimal" className={inputCls} {...form.register('temperature')} /></Field>
            <Field label="FC (bpm)" error={err.heartRate?.message}><input inputMode="numeric" className={inputCls} {...form.register('heartRate')} /></Field>
          </div>
          <Field label="Anamnese"><textarea rows={3} className={inputCls} {...form.register('anamnesis')} /></Field>
          <Field label="Diagnóstico"><textarea rows={2} className={inputCls} {...form.register('diagnosis')} /></Field>
          <Field label="Tratamento"><textarea rows={2} className={inputCls} {...form.register('treatment')} /></Field>
          <Field label="Prescrição"><textarea rows={3} className={inputCls} {...form.register('prescription')} /></Field>
          <Field label="Exames"><textarea rows={2} className={inputCls} {...form.register('exams')} /></Field>
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
