'use client';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '@/lib/api';
import type { Company, Payment } from '@/types';
import { btnGhost, btnPrimary, ErrorBox, inputCls } from '@/components/ui';
import {
  PAYMENT_METHODS, billingStatus, formatCentsInput, formatMoney, formatYmd, parseMoney, suggestedPeriod, toneClass,
} from '@/lib/billing';

const todayYmd = () => new Date().toLocaleDateString('sv-SE');

const Label = ({ text, children }: { text: string; children: React.ReactNode }) => (
  <label className="block text-xs font-medium text-gray-600">
    {text}
    <div className="mt-1">{children}</div>
  </label>
);

/** Cobrança de uma empresa (superadmin): mensalidade, pagamentos, teste grátis, isenção e cobrança por e-mail. */
export function BillingPanel({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const { data: company } = useQuery({
    queryKey: ['companies', companyId],
    queryFn: async () => (await api.get<Company>(`/companies/${companyId}`)).data,
    enabled: !!companyId,
  });
  const { data: payments = [] } = useQuery({
    queryKey: ['companies', companyId, 'payments'],
    queryFn: async () => (await api.get<Payment[]>(`/companies/${companyId}/payments`)).data,
    enabled: !!companyId,
  });

  const [fee, setFee] = useState('');
  const [invoice, setInvoice] = useState({ email: '', day: '5' });
  const [pay, setPay] = useState({ amount: '', paidAt: todayYmd(), method: 'PIX', note: '', periodStart: '', periodEnd: '' });

  // preenche os formulários quando a empresa carrega ou muda (depois de salvar algo)
  useEffect(() => {
    if (!company) return;
    setFee(formatCentsInput(company.billing.monthlyFeeCents));
    setInvoice({ email: company.invoice?.email ?? '', day: String(company.invoice?.day ?? 5) });
    setPay((p) => ({
      ...p,
      amount: formatCentsInput(company.billing.monthlyFeeCents),
      ...suggestedPeriod(company.billing, todayYmd()),
    }));
  }, [company]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['companies'] });
    setError('');
  };
  const run = useMutation({
    mutationFn: async (v: { call: () => Promise<unknown>; done: string }) => {
      setMessage('');
      setError('');
      await v.call();
      return v.done;
    },
    onSuccess: (done) => {
      setMessage(done);
      refresh();
    },
    onError: (e) => setError(errorMessage(e)),
  });
  const exec = (call: () => Promise<unknown>, done: string) => run.mutate({ call, done });
  const [sending, setSending] = useState(false);
  const busy = run.isPending || sending;

  if (!company) return <p className="text-sm text-gray-500">Carregando…</p>;

  const status = billingStatus(company.billing);
  const patch = (data: object, done: string) => exec(() => api.patch(`/companies/${company.id}`, data), done);

  const registerPayment = (e: React.FormEvent) => {
    e.preventDefault();
    const amountCents = parseMoney(pay.amount);
    if (!amountCents) return setError('Informe o valor pago.');
    const { paidAt, method, note, periodStart, periodEnd } = pay;
    exec(() => api.post(`/companies/${company.id}/payments`, { amountCents, paidAt, method, periodStart, periodEnd, ...(note && { note }) }), 'Pagamento registrado.');
  };

  const sendNow = async () => {
    const to = company.invoice?.email;
    if (!to || !confirm(`Enviar agora a cobrança deste mês para ${to}?`)) return;
    setMessage('');
    setError('');
    setSending(true);
    try {
      const sent = (await api.post<{ recipients: string[]; dueDate: string }>(`/companies/${company.id}/invoice/send`, {})).data;
      setMessage(`Cobrança enviada para ${sent.recipients.join(', ')} (vence em ${formatYmd(sent.dueDate)}).`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-xs ${toneClass[status.tone]}`}>{status.label}</span>
        <span className="text-xs text-gray-500">
          Pago até: <strong>{formatYmd(company.billing.paidUntil)}</strong>
          {company.billing.trialEndsAt && ` · teste até ${new Date(company.billing.trialEndsAt).toLocaleDateString('pt-BR')}`}
        </span>
      </div>

      <div className="space-y-5">
        <ErrorBox message={error} />
        {message && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>}

        {/* mensalidade */}
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            patch({ monthlyFeeCents: parseMoney(fee) ?? 0 }, 'Mensalidade salva.');
          }}
        >
          <div className="flex-1">
            <Label text="Mensalidade (R$)">
              <input className={inputCls} value={fee} onChange={(e) => setFee(e.target.value)} placeholder="Ex.: 199,90" inputMode="decimal" />
            </Label>
          </div>
          <button type="submit" className={btnGhost} disabled={busy}>Salvar mensalidade</button>
        </form>

        {/* cobrança por e-mail */}
        <form
          className="space-y-2 rounded-lg border border-gray-200 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            exec(
              () => api.put(`/companies/${company.id}/invoice`, { email: invoice.email, day: Number(invoice.day) }),
              invoice.email.trim() ? 'Cobrança por e-mail salva.' : 'Envio automático desligado.',
            );
          }}
        >
          <h3 className="text-sm font-semibold">Cobrança por e-mail</h3>
          <div className="grid gap-2 sm:grid-cols-[1fr_8rem]">
            <Label text="E-mail do financeiro (vários: separe por vírgula)">
              <input className={inputCls} value={invoice.email} onChange={(e) => setInvoice({ ...invoice, email: e.target.value })} placeholder="financeiro@empresa.com" />
            </Label>
            <Label text="Enviar todo dia">
              <input type="number" min={1} max={28} className={inputCls} value={invoice.day} onChange={(e) => setInvoice({ ...invoice, day: e.target.value })} required />
            </Label>
          </div>
          <p className="text-xs text-gray-500">
            Todo mês, nesse dia, o financeiro recebe a cobrança do mês anterior: valor, vencimento, QR Code do Pix e seus dados bancários.
            Não envia durante o teste grátis, sem mensalidade definida ou se o período já estiver pago. E-mail vazio desliga.
            {company.invoice?.next && <> Próximo envio automático: <strong>{formatYmd(company.invoice.next)}</strong>.</>}
          </p>
          {company.invoice && !company.invoice.ready && (
            <p className="text-xs text-red-600">Seus dados de recebimento ainda não estão configurados no servidor (BILLING_PIX_KEY). Sem eles o envio não funciona.</p>
          )}
          <div className="flex items-center justify-between gap-2">
            <button type="button" className={btnGhost} onClick={sendNow} disabled={busy || !company.invoice?.email}>Enviar cobrança agora</button>
            <button type="submit" className={btnPrimary} disabled={busy}>Salvar</button>
          </div>
        </form>

        {/* registrar pagamento */}
        <form className="space-y-2 rounded-lg border border-gray-200 p-3" onSubmit={registerPayment}>
          <h3 className="text-sm font-semibold">Registrar pagamento recebido</h3>
          <div className="grid gap-2 sm:grid-cols-3">
            <Label text="Valor (R$)"><input className={inputCls} value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} required inputMode="decimal" /></Label>
            <Label text="Pago em"><input type="date" className={inputCls} value={pay.paidAt} onChange={(e) => setPay({ ...pay, paidAt: e.target.value })} required /></Label>
            <Label text="Forma">
              <select className={inputCls} value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>
                {Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Label>
            <Label text="Período pago: de"><input type="date" className={inputCls} value={pay.periodStart} onChange={(e) => setPay({ ...pay, periodStart: e.target.value })} required /></Label>
            <Label text="até"><input type="date" className={inputCls} value={pay.periodEnd} onChange={(e) => setPay({ ...pay, periodEnd: e.target.value })} required /></Label>
            <Label text="Observação"><input className={inputCls} value={pay.note} onChange={(e) => setPay({ ...pay, note: e.target.value })} maxLength={300} placeholder="Opcional" /></Label>
          </div>
          <div className="flex justify-end"><button type="submit" className={btnPrimary} disabled={busy}>Registrar pagamento</button></div>
        </form>

        {/* histórico */}
        <div>
          <h3 className="mb-2 text-sm font-semibold">Histórico</h3>
          {payments.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum pagamento registrado.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-gray-500">
                <tr><th className="py-1 pr-2">Pago em</th><th className="pr-2">Valor</th><th className="pr-2">Período</th><th className="pr-2">Forma</th><th /></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payments.map((p) => (
                  <tr key={p.id} title={p.note ?? undefined}>
                    <td className="whitespace-nowrap py-1.5 pr-2">{formatYmd(p.paidAt)}</td>
                    <td className="whitespace-nowrap pr-2">{formatMoney(p.amountCents)}</td>
                    <td className="whitespace-nowrap pr-2">{formatYmd(p.periodStart)} a {formatYmd(p.periodEnd)}</td>
                    <td className="pr-2">{PAYMENT_METHODS[p.method] ?? p.method}{p.note && ' 📝'}</td>
                    <td className="text-right">
                      <button
                        className="text-red-500 hover:underline"
                        disabled={busy}
                        onClick={() =>
                          confirm(`Remover o pagamento de ${formatMoney(p.amountCents)} (${formatYmd(p.periodStart)} a ${formatYmd(p.periodEnd)})?`) &&
                          exec(() => api.delete(`/companies/payments/${p.id}`), 'Pagamento removido.')
                        }
                      >
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* teste / início / isenção */}
        <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
          <button
            type="button"
            className={btnGhost}
            disabled={busy}
            onClick={() => {
              const answer = prompt('O teste grátis termina daqui a quantos dias?', '15');
              if (answer === null) return;
              const trialDays = Number(answer);
              if (!Number.isInteger(trialDays) || trialDays < 1 || trialDays > 365) return setError('Informe um número de dias entre 1 e 365.');
              patch({ trialDays }, `Teste grátis até daqui a ${trialDays} dias.`);
            }}
          >
            {company.billing.state === 'trial' ? 'Estender teste' : 'Dar teste grátis'}
          </button>
          {company.billing.state === 'none' && (
            <button
              type="button"
              className={btnGhost}
              disabled={busy}
              onClick={() =>
                confirm(`Começar a cobrar ${company.name} hoje, sem teste grátis? O mês de hoje é cobrado no início do mês seguinte, com vencimento no dia 10.`) &&
                patch({ startBilling: true }, 'Cobrança iniciada hoje.')
              }
            >
              Começar cobrança hoje (sem teste)
            </button>
          )}
          {company.billing.state !== 'none' && (
            <button
              type="button"
              className="text-sm text-red-500 hover:underline"
              disabled={busy}
              onClick={() =>
                confirm(`Isentar ${company.name} de cobrança? A empresa deixa de ter teste e vencimento e nunca será bloqueada por pagamento.`) &&
                patch({ exempt: true }, 'Empresa isenta de cobrança.')
              }
            >
              Isentar de cobrança
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
