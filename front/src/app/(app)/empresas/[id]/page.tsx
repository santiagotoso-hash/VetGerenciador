'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import type { Company } from '@/types';
import { btnGhost, btnPrimary, Card, Empty, ErrorBox, Field, inputCls, PasswordInput, WhatsAppIcon } from '@/components/ui';
import { BillingPanel } from '@/components/billing/BillingDialog';
import { UsersPanel } from '@/components/companies/UsersPanel';
import { OnboardingTab } from '@/components/companies/OnboardingTab';
import { billingStatus, formatMoney, toneClass } from '@/lib/billing';
import { currency, statusLabel, whatsappUrl } from '@/lib/format';
import { resizeImage } from '@/lib/image';
import { providerLabel } from '@/lib/fiscal';
import type { AppointmentStatus } from '@/types';

type Tab = 'passos' | 'uso' | 'pagamentos' | 'empresa' | 'proprietario' | 'usuarios';
const tabs: { key: Tab; label: string }[] = [
  { key: 'passos', label: 'Primeiros passos' },
  { key: 'uso', label: 'Uso do sistema' },
  { key: 'pagamentos', label: 'Pagamentos' },
  { key: 'empresa', label: 'Dados da empresa' },
  { key: 'proprietario', label: 'Proprietário' },
  { key: 'usuarios', label: 'Usuários' },
];

interface Usage {
  totals: { users: number; activeUsers: number; clients: number; pets: number; products: number; appointments: number; medicalRecords: number; sales: number; revenue: number };
  last30: { appointments: number; sales: number; revenue: number };
  appointmentsByStatus: { status: AppointmentStatus; count: number }[];
  months: { month: string; appointments: number; sales: number; revenue: number }[];
  lastActivityAt: string | null;
  lastLoginAt: string | null;
}

const when = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
const monthLabel = (m: string) => {
  const [y, mo] = m.split('-');
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
};

export default function EmpresaDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const me = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('passos');
  const [error, setError] = useState('');

  useEffect(() => {
    const aba = new URLSearchParams(window.location.search).get('aba') as Tab | null;
    if (aba && tabs.some((t) => t.key === aba)) setTab(aba);
  }, []);

  const { data: company, isLoading, error: loadError } = useQuery({
    queryKey: ['companies', id],
    queryFn: async () => (await api.get<Company>(`/companies/${id}`)).data,
    enabled: me?.role === 'SUPER_ADMIN',
  });

  const toggle = useMutation({
    mutationFn: async (c: Company) => api.patch(`/companies/${c.id}`, { active: !c.active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companies'] }),
    onError: (e) => setError(errorMessage(e)),
  });

  if (me && me.role !== 'SUPER_ADMIN') return <Card className="p-10 text-center text-gray-500">Acesso restrito ao superadmin.</Card>;
  if (loadError) {
    return (
      <Card className="p-8 text-center">
        <p className="text-gray-600">Empresa não encontrada.</p>
        <Link href="/empresas" className="mt-2 inline-block text-primary-600 hover:underline">← Voltar para Empresas</Link>
      </Card>
    );
  }
  if (isLoading || !company) return <Empty>Carregando…</Empty>;

  const status = billingStatus(company.billing);

  return (
    <>
      <Link href="/empresas" className="mb-3 inline-block text-sm text-primary-600 hover:underline">← Empresas</Link>

      <Card className="mb-4 p-5">
        <div className="flex flex-wrap items-center gap-4">
          {company.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={company.logo} alt={company.name} className="h-20 w-20 rounded-xl object-cover ring-2 ring-primary-100" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-primary-50 text-3xl font-bold text-primary-700">{company.name.charAt(0)}</div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-bold">{company.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
              <span className={`rounded-full px-2 py-0.5 text-xs ${company.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {company.active ? 'Ativa' : 'Suspensa'}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-xs ${toneClass[status.tone]}`}>{status.label}</span>
              {company.billing.monthlyFeeCents != null && <span className="text-xs text-gray-500">{formatMoney(company.billing.monthlyFeeCents)}/mês</span>}
              <span className="text-xs text-gray-400">· cliente desde {new Date(company.createdAt).toLocaleDateString('pt-BR')}</span>
            </div>
          </div>
          <button
            className={company.active ? 'text-sm text-red-500 hover:underline' : btnPrimary}
            onClick={() =>
              (!company.active || confirm(`Suspender ${company.name}? Ninguém da empresa consegue entrar até você reativar.`)) && toggle.mutate(company)
            }
          >
            {company.active ? 'Suspender empresa' : 'Reativar empresa'}
          </button>
        </div>
        <ErrorBox message={error} />
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
          </button>
        ))}
      </div>

      {tab === 'passos' && <OnboardingTab companyId={company.id} onGo={(t) => setTab(t as Tab)} />}
      {tab === 'uso' && <UsageTab companyId={company.id} />}
      {tab === 'pagamentos' && <Card className="p-5"><BillingPanel companyId={company.id} /></Card>}
      {tab === 'empresa' && <CompanyDataTab company={company} />}
      {tab === 'proprietario' && <OwnerTab company={company} />}
      {tab === 'usuarios' && <Card className="p-5"><UsersPanel companyId={company.id} /></Card>}
    </>
  );
}

// ---------- uso do sistema ----------

function UsageTab({ companyId }: { companyId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['companies', companyId, 'usage'],
    queryFn: async () => (await api.get<Usage>(`/companies/${companyId}/usage`)).data,
  });
  if (isLoading || !data) return <Empty>Carregando…</Empty>;

  const t = data.totals;
  const stats: [string, string, string?][] = [
    ['Agendamentos (30 dias)', String(data.last30.appointments), `${t.appointments} no total`],
    ['Vendas (30 dias)', String(data.last30.sales), `${t.sales} no total`],
    ['Faturamento (30 dias)', currency(data.last30.revenue), `${currency(t.revenue)} no total`],
    ['Clientes', String(t.clients), `${t.pets} pets`],
    ['Usuários ativos', `${t.activeUsers}`, `${t.users} cadastrados`],
    ['Prontuários', String(t.medicalRecords), `${t.products} produtos no estoque`],
  ];
  const maxAppt = Math.max(1, ...data.months.map((m) => m.appointments));
  const maxRev = Math.max(1, ...data.months.map((m) => m.revenue));
  const totalStatus = data.appointmentsByStatus.reduce((s, g) => s + g.count, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {stats.map(([label, value, sub]) => (
          <Card key={label} className="p-4">
            <div className="text-xs text-gray-500">{label}</div>
            <div className="mt-1 text-2xl font-bold text-primary-700">{value}</div>
            {sub && <div className="text-xs text-gray-400">{sub}</div>}
          </Card>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <div className="text-xs text-gray-500">Último acesso de um usuário</div>
          <div className="mt-1 font-medium">{when(data.lastLoginAt)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-gray-500">Última atividade (agendamento, venda, cliente ou prontuário)</div>
          <div className="mt-1 font-medium">{when(data.lastActivityAt)}</div>
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="mb-3 text-sm font-semibold">Últimos 6 meses</h3>
        <div className="grid grid-cols-6 gap-2">
          {data.months.map((m) => (
            <div key={m.month} className="flex flex-col items-center gap-1 text-center">
              <div className="flex h-32 w-full items-end justify-center gap-1">
                <div className="w-1/2 rounded-t bg-primary-500" style={{ height: `${(m.appointments / maxAppt) * 100}%` }} title={`${m.appointments} agendamentos`} />
                <div className="w-1/2 rounded-t bg-amber-400" style={{ height: `${(m.revenue / maxRev) * 100}%` }} title={currency(m.revenue)} />
              </div>
              <div className="text-xs font-medium capitalize">{monthLabel(m.month)}</div>
              <div className="text-[10px] leading-tight text-gray-500">{m.appointments} agend.<br />{currency(m.revenue)}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-4 text-xs text-gray-500">
          <span><span className="mr-1 inline-block h-2 w-2 rounded bg-primary-500" />Agendamentos</span>
          <span><span className="mr-1 inline-block h-2 w-2 rounded bg-amber-400" />Faturamento</span>
        </div>
      </Card>

      {totalStatus > 0 && (
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold">Agendamentos por situação</h3>
          <ul className="space-y-2 text-sm">
            {data.appointmentsByStatus.map((g) => (
              <li key={g.status} className="flex items-center gap-3">
                <span className="w-32 shrink-0 text-gray-600">{statusLabel[g.status] ?? g.status}</span>
                <div className="h-2 flex-1 rounded bg-gray-100"><div className="h-2 rounded bg-primary-500" style={{ width: `${(g.count / totalStatus) * 100}%` }} /></div>
                <span className="w-10 text-right text-gray-500">{g.count}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

// ---------- formulários de cadastro ----------

type Fields = Record<string, string>;

function useProfileForm(company: Company, keys: string[]) {
  const qc = useQueryClient();
  const initial = (): Fields => Object.fromEntries(keys.map((k) => [k, ((company as unknown as Fields)[k] as string | null) ?? '']));
  const [form, setForm] = useState<Fields>(initial);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  // recarrega quando a empresa muda no servidor (ex.: depois de salvar)
  useEffect(() => setForm(initial()), [company]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = useMutation({
    mutationFn: async (extra?: Fields) => api.patch(`/companies/${company.id}`, { ...form, ...extra }),
    onSuccess: () => {
      setError('');
      setMessage('Dados salvos.');
      qc.invalidateQueries({ queryKey: ['companies'] });
    },
    onError: (e) => {
      setMessage('');
      setError(errorMessage(e));
    },
  });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setMessage('');
    setForm((f) => ({ ...f, [k]: e.target.value }));
  };
  return { form, set, save, message, error, setError, setMessage };
}

function CompanyDataTab({ company }: { company: Company }) {
  const { form, set, save, message, error, setError, setMessage } = useProfileForm(company, [
    'name', 'cnpj', 'phone', 'email', 'address', 'city', 'state', 'zipCode', 'notes',
  ]);
  const qc = useQueryClient();

  const setLogo = useMutation({
    mutationFn: async (logo: string) => api.patch(`/companies/${company.id}`, { logo }),
    onSuccess: () => {
      setError('');
      setMessage('Logomarca atualizada.');
      qc.invalidateQueries({ queryKey: ['companies'] });
    },
    onError: (e) => setError(errorMessage(e)),
  });

  const onLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      let dataUrl = await resizeImage(file, 400);
      if (dataUrl.length > 600_000) dataUrl = await resizeImage(file, 256);
      setLogo.mutate(dataUrl);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
      <div className="space-y-4">
      <Card className="h-fit p-5 text-center">
        <h3 className="mb-3 text-sm font-semibold">Logomarca</h3>
        {company.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={company.logo} alt={company.name} className="mx-auto h-40 w-40 rounded-xl object-cover ring-2 ring-primary-100" />
        ) : (
          <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-xl bg-primary-50 text-5xl font-bold text-primary-700">{company.name.charAt(0)}</div>
        )}
        <div className="mt-3 flex flex-col items-center gap-1 text-sm">
          <label className={`${btnGhost} cursor-pointer`}>
            {company.logo ? 'Trocar logomarca' : 'Enviar logomarca'}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onLogo} />
          </label>
          {company.logo && (
            <button className="text-xs text-red-500 hover:underline" onClick={() => confirm('Remover a logomarca?') && setLogo.mutate('')}>Remover</button>
          )}
          <p className="mt-1 text-xs text-gray-400">PNG, JPG ou WebP. Aparece no menu da empresa.</p>
        </div>
      </Card>
      <FiscalAdminCard company={company} />
      </div>

      <Card className="p-5">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(undefined);
          }}
        >
          <ErrorBox message={error} />
          {message && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>}
          <Field label="Nome da empresa *"><input required minLength={2} className={inputCls} value={form.name} onChange={set('name')} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="CNPJ"><input className={inputCls} value={form.cnpj} onChange={set('cnpj')} /></Field>
            <Field label="Telefone / WhatsApp"><input className={inputCls} value={form.phone} onChange={set('phone')} /></Field>
          </div>
          <Field label="E-mail da empresa"><input type="email" className={inputCls} value={form.email} onChange={set('email')} /></Field>
          <Field label="Endereço"><input className={inputCls} value={form.address} onChange={set('address')} /></Field>
          <div className="grid gap-3 sm:grid-cols-[1fr_5rem_8rem]">
            <Field label="Cidade"><input className={inputCls} value={form.city} onChange={set('city')} /></Field>
            <Field label="UF"><input maxLength={2} className={inputCls} value={form.state} onChange={set('state')} /></Field>
            <Field label="CEP"><input className={inputCls} value={form.zipCode} onChange={set('zipCode')} /></Field>
          </div>
          <Field label="Observações internas (só você vê)"><textarea rows={3} className={inputCls} value={form.notes} onChange={set('notes')} /></Field>
          <div className="flex justify-end">
            <button type="submit" className={btnPrimary} disabled={save.isPending}>{save.isPending ? 'Salvando…' : 'Salvar dados'}</button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function OwnerTab({ company }: { company: Company }) {
  const { form, set, save, message, error } = useProfileForm(company, ['ownerName', 'ownerDocument', 'ownerPhone', 'ownerEmail']);
  return (
    <Card className="max-w-2xl p-5">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(undefined);
        }}
      >
        <ErrorBox message={error} />
        {message && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>}
        <Field label="Nome do proprietário"><input className={inputCls} value={form.ownerName} onChange={set('ownerName')} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="CPF / CNPJ"><input className={inputCls} value={form.ownerDocument} onChange={set('ownerDocument')} /></Field>
          <Field label="Telefone / WhatsApp"><input className={inputCls} value={form.ownerPhone} onChange={set('ownerPhone')} /></Field>
        </div>
        <Field label="E-mail"><input type="email" className={inputCls} value={form.ownerEmail} onChange={set('ownerEmail')} /></Field>
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex gap-4 text-sm">
            {company.ownerPhone && (
              <a href={whatsappUrl(company.ownerPhone)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-green-700 hover:underline">
                <WhatsAppIcon /> Chamar no WhatsApp
              </a>
            )}
            {company.ownerEmail && <a href={`mailto:${company.ownerEmail}`} className="text-primary-700 hover:underline">Enviar e-mail</a>}
          </div>
          <button type="submit" className={btnPrimary} disabled={save.isPending}>{save.isPending ? 'Salvando…' : 'Salvar proprietário'}</button>
        </div>
      </form>
    </Card>
  );
}

/** Liga a nota fiscal da empresa e escolhe o emissor e o ambiente (só o superadmin). */
function FiscalAdminCard({ company }: { company: Company }) {
  const qc = useQueryClient();
  const [enabled, setEnabled] = useState(!!company.fiscalEnabled);
  const [provider, setProvider] = useState(company.fiscalProvider ?? 'MANUAL');
  const [env, setEnv] = useState(company.fiscalEnvironment ?? 'HOMOLOGACAO');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setEnabled(!!company.fiscalEnabled);
    setProvider(company.fiscalProvider ?? 'MANUAL');
    setEnv(company.fiscalEnvironment ?? 'HOMOLOGACAO');
  }, [company]);

  const save = useMutation({
    mutationFn: async () => api.patch(`/companies/${company.id}`, { fiscalEnabled: enabled, fiscalProvider: provider, fiscalEnvironment: env }),
    onSuccess: () => {
      setError('');
      setMessage('Salvo.');
      qc.invalidateQueries({ queryKey: ['companies'] });
    },
    onError: (e) => {
      setMessage('');
      setError(errorMessage(e));
    },
  });

  return (
    <Card className="h-fit p-5">
      <h3 className="mb-3 text-sm font-semibold">Nota fiscal</h3>
      <ErrorBox message={error} />
      {message && <p className="mb-2 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700">{message}</p>}
      <label className="mb-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={enabled} onChange={(e) => { setMessage(''); setEnabled(e.target.checked); }} /> Ativada para esta empresa
      </label>
      <Field label="Emissor">
        <select className={inputCls} value={provider} onChange={(e) => { setMessage(''); setProvider(e.target.value); }}>
          {Object.entries(providerLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </Field>
      <div className="mt-3">
        <Field label="Ambiente">
          <select className={inputCls} value={env} onChange={(e) => { setMessage(''); setEnv(e.target.value); }}>
            <option value="HOMOLOGACAO">Homologação (testes)</option>
            <option value="PRODUCAO">Produção (valor fiscal)</option>
          </select>
        </Field>
      </div>
      <p className="mt-2 text-xs text-gray-500">O emissor de teste só funciona em homologação. Produção só depois de configurar um emissor real.</p>
      <div className="mt-3 flex justify-end">
        <button className={btnPrimary} onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? 'Salvando…' : 'Salvar'}</button>
      </div>
      <FiscalCredentials company={company} />
    </Card>
  );
}

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(new Error('Não foi possível ler o arquivo'));
    r.readAsDataURL(file);
  });

/** Certificado digital A1 e CSC da empresa. Ficam cifrados no servidor e nunca voltam para a tela. */
function FiscalCredentials({ company }: { company: Company }) {
  const qc = useQueryClient();
  const s = company.fiscalSecrets;
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [csc, setCsc] = useState({ id: '', code: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const done = (msg: string) => {
    setError('');
    setMessage(msg);
    qc.invalidateQueries({ queryKey: ['companies'] });
  };
  const fail = (e: unknown) => {
    setMessage('');
    setError(errorMessage(e));
  };
  const upload = useMutation({
    mutationFn: async () => api.put(`/companies/${company.id}/fiscal/certificate`, { fileName: file!.name, contentBase64: await fileToBase64(file!), password }),
    onSuccess: () => {
      setFile(null);
      setPassword('');
      done('Certificado guardado.');
    },
    onError: fail,
  });
  const removeCert = useMutation({ mutationFn: async () => api.delete(`/companies/${company.id}/fiscal/certificate`), onSuccess: () => done('Certificado removido.'), onError: fail });
  const saveCsc = useMutation({
    mutationFn: async () => api.put(`/companies/${company.id}/fiscal/csc`, { cscId: csc.id, csc: csc.code }),
    onSuccess: () => {
      setCsc({ id: '', code: '' });
      done('CSC guardado.');
    },
    onError: fail,
  });
  const removeCsc = useMutation({ mutationFn: async () => api.delete(`/companies/${company.id}/fiscal/csc`), onSuccess: () => done('CSC removido.'), onError: fail });

  const expires = s?.certificateExpiresAt ? new Date(s.certificateExpiresAt) : null;
  const daysLeft = expires ? Math.ceil((expires.getTime() - Date.now()) / 86_400_000) : null;

  return (
    <div className="mt-5 space-y-4 border-t border-gray-100 pt-4">
      <h4 className="text-sm font-semibold">Credenciais do emissor</h4>
      <ErrorBox message={error} />
      {message && <p className="rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700">{message}</p>}
      {s && !s.encryptionReady && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Para guardar certificado ou CSC, configure <code>FISCAL_ENCRYPTION_KEY</code> no servidor (guia em <code>back/src/modules/fiscal/README.md</code>).
        </p>
      )}

      <div className="space-y-2">
        <div className="text-xs font-medium text-gray-600">Certificado digital A1</div>
        {s?.hasCertificate ? (
          <div className="rounded-lg bg-gray-50 p-3 text-xs">
            <div className="break-words font-medium">{s.certificateName}</div>
            <div className={daysLeft !== null && daysLeft < 30 ? 'text-red-600' : 'text-gray-500'}>
              Vence em {expires?.toLocaleDateString('pt-BR')} ({daysLeft !== null && daysLeft < 0 ? 'vencido' : `${daysLeft} dias`})
            </div>
            <button className="mt-1 text-red-500 hover:underline" onClick={() => confirm('Remover o certificado desta empresa?') && removeCert.mutate()}>Remover</button>
          </div>
        ) : (
          <p className="text-xs text-gray-400">Nenhum certificado guardado.</p>
        )}
        <input type="file" accept=".pfx,.p12" className="block w-full text-xs" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <PasswordInput placeholder="Senha do certificado" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className={btnGhost} disabled={!file || !password || upload.isPending || !s?.encryptionReady} onClick={() => upload.mutate()}>
          {upload.isPending ? 'Enviando…' : s?.hasCertificate ? 'Trocar certificado' : 'Guardar certificado'}
        </button>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium text-gray-600">CSC (NFC-e)</div>
        {s?.hasCsc ? (
          <p className="text-xs text-gray-500">
            Guardado (ID {s.cscId}). <button className="text-red-500 hover:underline" onClick={() => confirm('Remover o CSC?') && removeCsc.mutate()}>Remover</button>
          </p>
        ) : (
          <p className="text-xs text-gray-400">Nenhum CSC guardado.</p>
        )}
        <div className="grid grid-cols-[4rem_1fr] gap-2">
          <input className={inputCls} placeholder="ID" value={csc.id} onChange={(e) => setCsc({ ...csc, id: e.target.value })} />
          <input className={inputCls} placeholder="Código CSC" autoComplete="off" value={csc.code} onChange={(e) => setCsc({ ...csc, code: e.target.value })} />
        </div>
        <button className={btnGhost} disabled={!csc.id || csc.code.length < 6 || saveCsc.isPending || !s?.encryptionReady} onClick={() => saveCsc.mutate()}>
          Guardar CSC
        </button>
      </div>
      <p className="text-xs text-gray-400">Ficam cifrados no servidor e nunca aparecem de novo na tela. Só são usados quando houver um emissor real configurado.</p>
    </div>
  );
}
