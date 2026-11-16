'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { btnGhost, btnPrimary, ErrorBox, inputCls, Modal } from '@/components/ui';
import { currency, dateTime } from '@/lib/format';
import {
  invoiceStatusColor, invoiceStatusLabel, invoiceTypeLabel, type FiscalSettings, type Invoice,
} from '@/lib/fiscal';

/** Notas fiscais de uma venda: preparar, emitir (ou registrar a que foi emitida no portal) e cancelar. */
export function SaleInvoicesModal({ saleId, onClose }: { saleId: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const [error, setError] = useState('');
  const [productType, setProductType] = useState<'NFCE' | 'NFE'>('NFCE');
  const [registering, setRegistering] = useState<string | null>(null);
  const [reg, setReg] = useState({ number: '', series: '', accessKey: '', issuedAt: new Date().toLocaleDateString('sv-SE'), pdfUrl: '' });

  const { data: settings } = useQuery({
    queryKey: ['fiscal', 'settings'],
    queryFn: async () => (await api.get<FiscalSettings>('/fiscal/settings')).data,
    enabled: !!saleId,
  });
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['fiscal', 'invoices', saleId],
    queryFn: async () => (await api.get<Invoice[]>('/fiscal/invoices', { params: { saleId } })).data,
    enabled: !!saleId,
  });

  const refresh = () => {
    setError('');
    qc.invalidateQueries({ queryKey: ['fiscal'] });
  };
  const run = useMutation({
    mutationFn: async (call: () => Promise<unknown>) => call(),
    onSuccess: refresh,
    onError: (e) => setError(errorMessage(e)),
  });

  if (!saleId) return null;
  const manual = settings?.providers.find((p) => p.name === settings.fiscalProvider)?.manual ?? true;
  const live = invoices.filter((i) => i.status !== 'CANCELED');
  const homolog = settings?.fiscalEnvironment !== 'PRODUCAO';

  return (
    <Modal open onClose={onClose} title="Notas fiscais da venda" wide>
      <div className="space-y-4">
        <ErrorBox message={error} />

        {settings && !settings.fiscalEnabled && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">A nota fiscal ainda não está ativada para a sua empresa. Fale com o suporte.</p>
        )}
        {settings?.fiscalEnabled && homolog && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Ambiente de <strong>homologação</strong>: as notas daqui são de teste e <strong>não têm validade fiscal</strong>.
          </p>
        )}

        {settings?.fiscalEnabled && !isLoading && live.length === 0 && (
          <div className="space-y-3 rounded-lg border border-dashed border-gray-300 p-4 text-sm">
            <p>Ainda não há notas para esta venda. Produtos viram NFC-e/NF-e e serviços viram NFS-e.</p>
            <div className="flex flex-wrap items-center gap-2">
              <select className={`${inputCls} max-w-[16rem]`} value={productType} onChange={(e) => setProductType(e.target.value as 'NFCE' | 'NFE')}>
                <option value="NFCE">Produtos em NFC-e (consumidor)</option>
                <option value="NFE">Produtos em NF-e (venda para empresa)</option>
              </select>
              <button className={btnPrimary} disabled={run.isPending} onClick={() => run.mutate(() => api.post(`/fiscal/sales/${saleId}/invoices`, { productType }))}>
                Preparar notas
              </button>
            </div>
          </div>
        )}

        {live.map((inv) => (
          <div key={inv.id} className="rounded-lg border border-gray-200 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{invoiceTypeLabel[inv.type]}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs ${invoiceStatusColor[inv.status]}`}>{invoiceStatusLabel[inv.status]}</span>
              {inv.provider === 'MOCK' && inv.status === 'AUTHORIZED' && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">teste, sem validade</span>}
              <span className="ml-auto font-semibold">{currency(inv.amount)}</span>
            </div>
            <ul className="mt-2 text-xs text-gray-500">
              {inv.items.map((i, n) => <li key={n}>{i.quantity}× {i.description}</li>)}
              {inv.discount > 0 && <li>Desconto rateado: − {currency(inv.discount)}</li>}
            </ul>

            {inv.issues.length > 0 && (
              <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                <div className="font-medium">Falta completar para emitir:</div>
                <ul className="mt-1 list-disc pl-5 text-xs">{inv.issues.map((m) => <li key={m}>{m}</li>)}</ul>
                <div className="mt-2 text-xs">
                  Complete em <Link className="underline" href="/configuracoes">Configurações → Fiscal</Link>, <Link className="underline" href="/estoque">Estoque</Link> (produtos) ou{' '}
                  <Link className="underline" href="/configuracoes">Configurações → Serviços</Link> e depois clique em “Atualizar dados”.
                </div>
              </div>
            )}
            {inv.errorMessage && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{inv.errorMessage}</p>}

            {inv.status === 'AUTHORIZED' && (
              <dl className="mt-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                <div><dt className="inline text-gray-500">Número: </dt><dd className="inline font-medium">{inv.number}{inv.series ? ` / série ${inv.series}` : ''}</dd></div>
                {inv.issuedAt && <div><dt className="inline text-gray-500">Emitida em: </dt><dd className="inline">{dateTime(inv.issuedAt)}</dd></div>}
                {inv.accessKey && <div className="sm:col-span-2"><dt className="inline text-gray-500">Chave: </dt><dd className="inline break-all font-mono text-xs">{inv.accessKey}</dd></div>}
              </dl>
            )}
            {inv.status === 'CANCELED' && inv.cancelReason && <p className="mt-2 text-xs text-gray-500">Motivo: {inv.cancelReason}</p>}

            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              {['DRAFT', 'REJECTED'].includes(inv.status) && (
                <>
                  <button className={btnGhost} disabled={run.isPending} onClick={() => run.mutate(() => api.post(`/fiscal/invoices/${inv.id}/refresh`))}>Atualizar dados</button>
                  {manual ? (
                    <button className={btnPrimary} onClick={() => setRegistering(registering === inv.id ? null : inv.id)}>Registrar nota emitida</button>
                  ) : (
                    <button className={btnPrimary} disabled={run.isPending || inv.issues.length > 0} onClick={() => run.mutate(() => api.post(`/fiscal/invoices/${inv.id}/emit`))}>Emitir nota</button>
                  )}
                </>
              )}
              {inv.status === 'AUTHORIZED' && (
                <>
                  {inv.pdfUrl && <a className="text-primary-600 hover:underline" href={inv.pdfUrl} target="_blank" rel="noopener noreferrer">PDF</a>}
                  {inv.xmlUrl && <a className="text-primary-600 hover:underline" href={inv.xmlUrl} target="_blank" rel="noopener noreferrer">XML</a>}
                  {role === 'ADMIN' && (
                    <button
                      className="text-red-500 hover:underline"
                      onClick={() => {
                        const reason = prompt('Motivo do cancelamento (mínimo 15 caracteres):');
                        if (reason) run.mutate(() => api.post(`/fiscal/invoices/${inv.id}/cancel`, { reason }));
                      }}
                    >
                      Cancelar nota
                    </button>
                  )}
                </>
              )}
            </div>

            {registering === inv.id && (
              <form
                className="mt-3 space-y-2 rounded-lg bg-gray-50 p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const body = {
                    number: reg.number,
                    ...(reg.series && { series: reg.series }),
                    ...(reg.accessKey && { accessKey: reg.accessKey.replace(/\D/g, '') }),
                    ...(reg.issuedAt && { issuedAt: reg.issuedAt }),
                    ...(reg.pdfUrl && { pdfUrl: reg.pdfUrl }),
                  };
                  run.mutate(async () => {
                    await api.post(`/fiscal/invoices/${inv.id}/register`, body);
                    setRegistering(null);
                  });
                }}
              >
                <p className="text-xs text-gray-500">Emita a nota no portal gratuito da SEFAZ ou da prefeitura e informe aqui o resultado.</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  <input required className={inputCls} placeholder="Número da nota *" value={reg.number} onChange={(e) => setReg({ ...reg, number: e.target.value })} />
                  <input className={inputCls} placeholder="Série" value={reg.series} onChange={(e) => setReg({ ...reg, series: e.target.value })} />
                  <input type="date" className={inputCls} value={reg.issuedAt} onChange={(e) => setReg({ ...reg, issuedAt: e.target.value })} />
                </div>
                <input className={inputCls} placeholder="Chave de acesso (44 números, se houver)" value={reg.accessKey} onChange={(e) => setReg({ ...reg, accessKey: e.target.value })} />
                <input type="url" className={inputCls} placeholder="Link do PDF (opcional)" value={reg.pdfUrl} onChange={(e) => setReg({ ...reg, pdfUrl: e.target.value })} />
                <div className="flex justify-end gap-2">
                  <button type="button" className={btnGhost} onClick={() => setRegistering(null)}>Cancelar</button>
                  <button type="submit" className={btnPrimary} disabled={run.isPending}>Salvar nota</button>
                </div>
              </form>
            )}
          </div>
        ))}

        {invoices.some((i) => i.status === 'CANCELED') && (
          <p className="text-xs text-gray-400">{invoices.filter((i) => i.status === 'CANCELED').length} nota(s) cancelada(s) nesta venda.</p>
        )}

        <div className="flex justify-end"><button className={btnGhost} onClick={onClose}>Fechar</button></div>
      </div>
    </Modal>
  );
}
