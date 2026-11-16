'use client';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '@/lib/api';
import { btnPrimary, Card, ErrorBox, Field, inputCls } from '@/components/ui';
import { providerLabel, taxRegimeLabel, type FiscalSettings, type Readiness, type TaxRegime } from '@/lib/fiscal';

type Form = Record<'cnpj' | 'stateRegistration' | 'municipalRegistration' | 'cityIbgeCode' | 'address' | 'city' | 'state' | 'zipCode' | 'taxRegime', string>;
const keys: (keyof Form)[] = ['cnpj', 'taxRegime', 'stateRegistration', 'municipalRegistration', 'cityIbgeCode', 'address', 'city', 'state', 'zipCode'];

/** Configurações > Fiscal: dados da empresa para nota fiscal e lista do que ainda falta. */
export function FiscalSettingsTab() {
  const qc = useQueryClient();
  const { data: settings } = useQuery({
    queryKey: ['fiscal', 'settings'],
    queryFn: async () => (await api.get<FiscalSettings>('/fiscal/settings')).data,
  });
  const { data: readiness } = useQuery({
    queryKey: ['fiscal', 'readiness'],
    queryFn: async () => (await api.get<Readiness>('/fiscal/readiness')).data,
  });

  const [form, setForm] = useState<Form>(() => Object.fromEntries(keys.map((k) => [k, ''])) as Form);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (settings) setForm(Object.fromEntries(keys.map((k) => [k, (settings as unknown as Record<string, string | null>)[k] ?? ''])) as Form);
  }, [settings]);

  const save = useMutation({
    mutationFn: async () => {
      const { taxRegime, ...text } = form;
      return api.patch('/fiscal/settings', { ...text, ...(taxRegime && { taxRegime }) });
    },
    onSuccess: () => {
      setError('');
      setMessage('Dados fiscais salvos.');
      qc.invalidateQueries({ queryKey: ['fiscal'] });
    },
    onError: (e) => {
      setMessage('');
      setError(errorMessage(e));
    },
  });

  const autoEmit = useMutation({
    mutationFn: async (value: boolean) => api.patch('/fiscal/settings', { fiscalAutoEmit: value }),
    onSuccess: () => {
      setError('');
      qc.invalidateQueries({ queryKey: ['fiscal'] });
    },
    onError: (e) => setError(errorMessage(e)),
  });

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setMessage('');
    setForm((f) => ({ ...f, [k]: e.target.value }));
  };

  if (!settings) return <p className="text-sm text-gray-500">Carregando…</p>;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <Card className="p-5">
        <div className={`mb-4 rounded-lg px-3 py-2 text-sm ${settings.fiscalEnabled ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-800'}`}>
          {settings.fiscalEnabled ? (
            <>
              Nota fiscal <strong>ativada</strong> · emissor: {providerLabel[settings.fiscalProvider] ?? settings.fiscalProvider} · ambiente:{' '}
              <strong>{settings.fiscalEnvironment === 'PRODUCAO' ? 'Produção' : 'Homologação (testes, sem validade fiscal)'}</strong>
            </>
          ) : (
            <>A emissão de nota fiscal ainda <strong>não está ativada</strong> para a sua empresa. Você já pode preencher os dados abaixo; a ativação é feita pelo suporte.</>
          )}
        </div>

        <label className="mb-4 flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4"
            checked={settings.fiscalAutoEmit}
            disabled={autoEmit.isPending}
            onChange={(e) => autoEmit.mutate(e.target.checked)}
          />
          <span>
            <span className="font-medium">Emitir nota ao finalizar a venda</span>
            <span className="block text-xs text-gray-500">
              Ao concluir uma venda, o sistema já prepara e emite as notas. A venda <strong>nunca</strong> é barrada: o que não puder ser emitido
              (falta algum dado fiscal, emissor manual ou erro do emissor) fica como rascunho, e a tela avisa o motivo.
              {settings.fiscalEnabled ? '' : ' Só vale depois que a nota fiscal for ativada para a sua empresa.'}
            </span>
          </span>
        </label>

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <ErrorBox message={error} />
          {message && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="CNPJ"><input className={inputCls} value={form.cnpj} onChange={set('cnpj')} placeholder="00.000.000/0000-00" /></Field>
            <Field label="Regime tributário">
              <select className={inputCls} value={form.taxRegime} onChange={set('taxRegime')}>
                <option value="">Selecione…</option>
                {(Object.keys(taxRegimeLabel) as TaxRegime[]).map((r) => <option key={r} value={r}>{taxRegimeLabel[r]}</option>)}
              </select>
            </Field>
            <Field label="Inscrição estadual (produtos)"><input className={inputCls} value={form.stateRegistration} onChange={set('stateRegistration')} /></Field>
            <Field label="Inscrição municipal (serviços)"><input className={inputCls} value={form.municipalRegistration} onChange={set('municipalRegistration')} /></Field>
          </div>
          <Field label="Endereço fiscal"><input className={inputCls} value={form.address} onChange={set('address')} placeholder="Rua, número, bairro" /></Field>
          <div className="grid gap-3 sm:grid-cols-[1fr_5rem_8rem_9rem]">
            <Field label="Cidade"><input className={inputCls} value={form.city} onChange={set('city')} /></Field>
            <Field label="UF"><input maxLength={2} className={inputCls} value={form.state} onChange={set('state')} /></Field>
            <Field label="CEP"><input className={inputCls} value={form.zipCode} onChange={set('zipCode')} /></Field>
            <Field label="Código IBGE"><input className={inputCls} value={form.cityIbgeCode} onChange={set('cityIbgeCode')} placeholder="Salvador: 2927408" /></Field>
          </div>
          <p className="text-xs text-gray-500">Confirme o regime e as inscrições com o seu contador. Esses dados vão em todas as notas.</p>
          <div className="flex justify-end">
            <button type="submit" className={btnPrimary} disabled={save.isPending}>{save.isPending ? 'Salvando…' : 'Salvar dados fiscais'}</button>
          </div>
        </form>
      </Card>

      <Card className="h-fit p-5">
        <h3 className="mb-3 text-sm font-semibold">Pronto para emitir?</h3>
        <ul className="space-y-3 text-sm">
          {readiness?.checks.map((c) => (
            <li key={c.key} className="flex gap-2">
              <span className={c.ok ? 'text-green-600' : 'text-amber-500'}>{c.ok ? '✔' : '●'}</span>
              <div>
                <div className={c.ok ? 'text-gray-700' : 'font-medium'}>
                  {c.label}
                  {!c.ok && c.count !== undefined && <span className="ml-1 text-xs font-normal text-gray-500">({c.count} de {c.total} sem dados)</span>}
                </div>
                {!c.ok && <div className="text-xs text-gray-500">{c.hint}</div>}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
