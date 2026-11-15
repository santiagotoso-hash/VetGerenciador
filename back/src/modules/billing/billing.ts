// Situação de cobrança de uma empresa (teste grátis, mensalidade em dia, vencida, bloqueada).
// Datas comparadas no fuso de Brasília, para o "vence hoje" bater com o dia do cliente.

const TIMEZONE = process.env.BILLING_TIMEZONE ?? 'America/Sao_Paulo';
/** Dias de tolerância depois do fim do teste, antes de bloquear. */
export const GRACE_DAYS = Number(process.env.BILLING_GRACE_DAYS ?? 3);
/** Dia do mês em que vence a mensalidade (vencida até esse dia, depois bloqueia). */
export const TOLERANCE_DAY = Number(process.env.BILLING_TOLERANCE_DAY ?? 10);
const DUE_SOON_DAYS = 5;
const DAY_MS = 86_400_000;

export interface BillingFields {
  paidUntil?: Date | null;
  trialEndsAt?: Date | null;
  monthlyFeeCents?: number | null;
  billingStartDate?: Date | null;
}

export type BillingState = 'none' | 'trial' | 'paid' | 'started' | 'trial_expired' | 'overdue';

export interface BillingView {
  state: BillingState;
  paidUntil: string | null;
  trialEndsAt: Date | null;
  monthlyFeeCents: number | null;
  graceDays: number;
  daysLeft?: number;
  dueSoon?: boolean;
  overdueDays?: number;
  graceDaysLeft?: number;
  graceEnd?: string;
  blocked: boolean;
}

/** "AAAA-MM-DD" do instante no fuso da cobrança. */
export const ymdInTz = (date: Date) => new Intl.DateTimeFormat('sv-SE', { timeZone: TIMEZONE }).format(date);
const ymdOfDate = (date: Date) => date.toISOString().slice(0, 10);
const daysBetween = (fromYmd: string, toYmd: string) =>
  Math.round((Date.parse(`${toYmd}T00:00:00Z`) - Date.parse(`${fromYmd}T00:00:00Z`)) / DAY_MS);

/** Primeiro dia `day` do mês depois de `ymd` (ex.: 31/10 -> 10/11; 04/12 -> 10/12). */
export function nextDayOfMonth(ymd: string, day: number) {
  const [y, m, d] = ymd.split('-').map(Number);
  const month = d < day ? m : m + 1;
  return new Date(Date.UTC(y, month - 1, day)).toISOString().slice(0, 10);
}

/** Vencimento da 1ª mensalidade de quem saiu do teste em `trialEndYmd` (1º mês cheio depois do teste, cobrado no seguinte). */
export function firstBillDue(trialEndYmd: string) {
  const [y, m] = trialEndYmd.split('-').map(Number);
  return new Date(Date.UTC(y, m + 1, TOLERANCE_DAY)).toISOString().slice(0, 10);
}

/** Vencimento da 1ª mensalidade de quem começou em `startYmd` sem teste (mês de início cobrado no mês seguinte). */
export function firstUsageDue(startYmd: string) {
  const [y, m] = startYmd.split('-').map(Number);
  return new Date(Date.UTC(y, m, TOLERANCE_DAY)).toISOString().slice(0, 10);
}

/**
 * state: 'none' (sem cobrança: nunca bloqueia) | 'trial' | 'paid' | 'started' | 'trial_expired' | 'overdue'.
 * blocked: passou da tolerância — o acesso da empresa é bloqueado (exceto para o superadmin).
 */
export function computeBilling(company: BillingFields, now = new Date()): BillingView {
  const today = ymdInTz(now);
  const paidUntil = company.paidUntil ? ymdOfDate(company.paidUntil) : null;
  const trialEndsAt = company.trialEndsAt ?? null;
  const base = { paidUntil, trialEndsAt, monthlyFeeCents: company.monthlyFeeCents ?? null, graceDays: GRACE_DAYS };

  if (paidUntil && paidUntil >= today) {
    const daysLeft = daysBetween(today, paidUntil);
    return { ...base, state: 'paid', daysLeft, dueSoon: daysLeft <= DUE_SOON_DAYS, blocked: false };
  }
  if (trialEndsAt && trialEndsAt > now) {
    return { ...base, state: 'trial', daysLeft: Math.ceil((trialEndsAt.getTime() - now.getTime()) / DAY_MS), blocked: false };
  }
  if (!paidUntil && !trialEndsAt) {
    if (!company.billingStartDate) return { ...base, state: 'none', blocked: false };
    const graceEnd = firstUsageDue(ymdOfDate(company.billingStartDate));
    if (today <= graceEnd) {
      return { ...base, state: 'started', graceEnd, graceDaysLeft: daysBetween(today, graceEnd), blocked: false };
    }
    return { ...base, state: 'overdue', overdueDays: daysBetween(graceEnd, today), graceDaysLeft: 0, graceEnd, blocked: true };
  }

  const trialEnd = trialEndsAt ? ymdInTz(trialEndsAt) : null;
  const overdue = Boolean(paidUntil);
  const endedOn = [paidUntil, trialEnd].filter(Boolean).sort().at(-1) as string;
  const overdueDays = Math.max(daysBetween(endedOn, today), overdue ? 1 : 0);
  const graceEnd = overdue && endedOn === paidUntil ? nextDayOfMonth(paidUntil as string, TOLERANCE_DAY) : firstBillDue(trialEnd as string);
  const graceDaysLeft = Math.max(daysBetween(today, graceEnd), 0);
  return {
    ...base,
    state: overdue ? 'overdue' : 'trial_expired',
    overdueDays,
    graceDaysLeft,
    graceEnd,
    blocked: today > graceEnd,
  };
}

export function blockedMessage(billing: BillingView) {
  return billing.state === 'trial_expired'
    ? 'O período de teste grátis desta empresa terminou. Fale com a LitoCode para continuar usando o sistema.'
    : 'O acesso desta empresa está bloqueado por mensalidade em atraso. Fale com a LitoCode para regularizar.';
}
