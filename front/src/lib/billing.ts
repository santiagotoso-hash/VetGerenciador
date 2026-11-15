// Textos e cores da situação de cobrança (vinda do servidor em "billing").

export type BillingState = 'none' | 'trial' | 'paid' | 'started' | 'trial_expired' | 'overdue';

export interface Billing {
  state: BillingState;
  paidUntil: string | null;
  trialEndsAt: string | null;
  monthlyFeeCents: number | null;
  daysLeft?: number;
  dueSoon?: boolean;
  overdueDays?: number;
  graceDaysLeft?: number;
  graceEnd?: string;
  blocked: boolean;
}

export const PAYMENT_METHODS: Record<string, string> = {
  PIX: 'Pix',
  BOLETO: 'Boleto',
  CARTAO: 'Cartão',
  TRANSFERENCIA: 'Transferência',
  DINHEIRO: 'Dinheiro',
  OUTRO: 'Outro',
};

export const formatMoney = (cents?: number | null) =>
  cents == null ? '—' : (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** "199,90" / "R$ 1.234,50" -> 19990 / 123450 (null se vazio ou inválido) */
export function parseMoney(text: string) {
  const clean = String(text ?? '').replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  if (!clean) return null;
  const value = Number(clean);
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : null;
}

export const formatCentsInput = (cents?: number | null) => (cents != null ? (cents / 100).toFixed(2).replace('.', ',') : '');
export const formatYmd = (ymd?: string | null) => (ymd ? ymd.slice(0, 10).split('-').reverse().join('/') : '—');
const days = (n: number) => `${n} dia${n === 1 ? '' : 's'}`;

export type Tone = 'ok' | 'warn' | 'danger' | 'muted';
export const toneClass: Record<Tone, string> = {
  ok: 'bg-green-100 text-green-700',
  warn: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
  muted: 'bg-gray-100 text-gray-500',
};

export function billingStatus(b?: Billing | null): { label: string; tone: Tone } {
  if (!b || b.state === 'none') return { label: 'Sem cobrança', tone: 'muted' };
  if (b.state === 'trial') {
    const left = b.daysLeft ?? 0;
    return { label: `Teste grátis · ${left === 1 ? 'último dia' : `faltam ${days(left)}`}`, tone: left <= 3 ? 'danger' : 'warn' };
  }
  if (b.state === 'paid') {
    if (b.daysLeft === 0) return { label: 'Vence hoje', tone: 'warn' };
    if (b.dueSoon) return { label: `Vence em ${days(b.daysLeft ?? 0)} (${formatYmd(b.paidUntil)})`, tone: 'warn' };
    return { label: `Em dia até ${formatYmd(b.paidUntil)}`, tone: 'ok' };
  }
  if (b.state === 'started') return { label: `Em uso · 1ª cobrança vence ${formatYmd(b.graceEnd)}`, tone: 'ok' };
  if (b.state === 'trial_expired' && !b.blocked) {
    return { label: `Teste encerrado · 1º mês liberado, 1ª cobrança vence ${formatYmd(b.graceEnd)}`, tone: 'warn' };
  }
  const what = b.state === 'trial_expired' ? 'Teste encerrado' : 'Vencida';
  if (b.blocked) return { label: `Bloqueada · ${what.toLowerCase()} há ${days(b.overdueDays ?? 0)}`, tone: 'danger' };
  return { label: `${what} há ${days(b.overdueDays ?? 0)} · bloqueia em ${days((b.graceDaysLeft ?? 0) + 1)}`, tone: 'danger' };
}

/** Aviso para o admin da empresa (faixa no topo do app). null = nada a avisar. */
export function billingNotice(b?: Billing | null): string | null {
  if (!b) return null;
  if (b.state === 'trial') {
    return b.daysLeft === 1
      ? 'Hoje é o último dia do seu teste grátis. Fale com a LitoCode para continuar.'
      : `Seu teste grátis termina em ${days(b.daysLeft ?? 0)}.`;
  }
  if (b.state === 'paid' && b.dueSoon) {
    return b.daysLeft === 0 ? 'A mensalidade vence hoje.' : `A mensalidade vence em ${days(b.daysLeft ?? 0)}.`;
  }
  if (b.state === 'trial_expired') {
    return `O teste grátis terminou. Seu primeiro mês de uso está liberado e a primeira mensalidade vence em ${formatYmd(b.graceEnd)}.`;
  }
  if (b.state === 'overdue') {
    const when = b.graceDaysLeft === 0 ? 'hoje' : `em ${days((b.graceDaysLeft ?? 0) + 1)}`;
    return `A mensalidade está vencida. O acesso será bloqueado ${when} — fale com a LitoCode para regularizar.`;
  }
  return null;
}

function addDays(ymd: string, n: number) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Período sugerido para o próximo pagamento: começa no dia seguinte ao "pago até" (ou hoje) e dura 1 mês. */
export function suggestedPeriod(b: Billing | null | undefined, todayYmd: string) {
  const start = b?.paidUntil && b.paidUntil >= todayYmd ? addDays(b.paidUntil, 1) : todayYmd;
  const [y, m, d] = start.split('-').map(Number);
  const end = new Date(Date.UTC(y, m, d - 1)).toISOString().slice(0, 10);
  return { periodStart: start, periodEnd: end };
}
