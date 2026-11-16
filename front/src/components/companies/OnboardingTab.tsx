'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '@/lib/api';
import { Card, Empty, ErrorBox } from '@/components/ui';

export interface OnboardingItem {
  key: string;
  label: string;
  done: boolean;
  auto: boolean;
  optional?: boolean;
  hint?: string;
  tab?: string;
}
export interface OnboardingSection {
  key: string;
  title: string;
  active: boolean;
  note?: string;
  items: OnboardingItem[];
}
export interface Onboarding {
  sections: OnboardingSection[];
  progress: { done: number; total: number; percent: number };
}

/** Barra de progresso (usada também na lista de empresas). */
export function ProgressBar({ percent, className = '' }: { percent: number; className?: string }) {
  const color = percent >= 100 ? 'bg-green-500' : percent >= 50 ? 'bg-primary-500' : 'bg-amber-400';
  return (
    <div className={`h-2 overflow-hidden rounded-full bg-gray-100 ${className}`} role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-2 rounded-full ${color}`} style={{ width: `${percent}%` }} />
    </div>
  );
}

/** Checklist de implantação: o que já foi entregue e o que falta para esta empresa. */
export function OnboardingTab({ companyId, onGo }: { companyId: string; onGo: (tab: string) => void }) {
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['companies', companyId, 'onboarding'],
    queryFn: async () => (await api.get<Onboarding>(`/companies/${companyId}/onboarding`)).data,
  });

  const toggle = useMutation({
    mutationFn: async (v: { key: string; done: boolean }) => api.put(`/companies/${companyId}/onboarding/${v.key}`, { done: v.done }),
    onSuccess: () => {
      setError('');
      qc.invalidateQueries({ queryKey: ['companies'] });
    },
    onError: (e) => setError(errorMessage(e)),
  });

  if (isLoading || !data) return <Empty>Carregando…</Empty>;
  const { progress } = data;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="mb-2 flex items-end justify-between">
          <div>
            <div className="text-sm font-semibold">Implantação</div>
            <div className="text-xs text-gray-500">{progress.done} de {progress.total} itens concluídos</div>
          </div>
          <div className="text-2xl font-bold text-primary-700">{progress.percent}%</div>
        </div>
        <ProgressBar percent={progress.percent} />
        <p className="mt-3 text-xs text-gray-500">
          Os itens com <span className="font-medium">✔ automático</span> são marcados pelo sistema a partir dos dados reais da empresa.
          Os demais você confirma à mão.
        </p>
      </Card>

      <ErrorBox message={error} />

      {data.sections.map((s) => {
        const counted = s.items.filter((i) => !i.optional);
        const done = counted.filter((i) => i.done).length;
        return (
          <Card key={s.key} className={`p-5 ${s.active ? '' : 'opacity-70'}`}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">{s.title}</h3>
              {s.active && <span className="text-xs text-gray-500">{done}/{counted.length}</span>}
            </div>
            {s.note && <p className="text-xs text-gray-500">{s.note}</p>}
            <ul className="space-y-2.5">
              {s.items.map((i) => (
                <li key={i.key} className="flex items-start gap-3 text-sm">
                  {i.auto ? (
                    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${i.done ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-300'}`} aria-hidden="true">
                      {i.done ? '✔' : '○'}
                    </span>
                  ) : (
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 shrink-0"
                      checked={i.done}
                      disabled={toggle.isPending}
                      onChange={(e) => toggle.mutate({ key: i.key, done: e.target.checked })}
                      aria-label={i.label}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className={i.done ? 'text-gray-500 line-through decoration-gray-300' : 'font-medium'}>
                      {i.label}
                      {i.optional && <span className="ml-1 text-xs font-normal text-gray-400">(opcional)</span>}
                      {!i.auto && <span className="ml-1 text-xs font-normal text-gray-400">(manual)</span>}
                    </div>
                    {!i.done && i.hint && <div className="text-xs text-gray-500">{i.hint}</div>}
                  </div>
                  {!i.done && i.tab && (
                    <button className="shrink-0 text-xs text-primary-600 hover:underline" onClick={() => onGo(i.tab!)}>Ir para →</button>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}
