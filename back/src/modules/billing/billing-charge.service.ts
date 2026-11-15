// Cobrança da mensalidade por e-mail: no dia configurado, envia ao financeiro da empresa o valor, o vencimento,
// o Pix (QR Code e copia e cola) e os dados bancários da LitoCode. Não é boleto registrado em banco: o pagamento
// é por Pix/transferência, e quem confirma o recebimento é o superadmin ("Registrar pagamento").
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { TOLERANCE_DAY, computeBilling, ymdInTz } from './billing';
import { pixPayload, pixQrPng } from './pix';

const MONTH_NAMES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const money = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const brDate = (ymd: string) => ymd.split('-').reverse().join('/');
const esc = (s: string) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

type ChargeCompany = {
  id: string;
  name: string;
  slug: string;
  active?: boolean;
  billingEmail: string | null;
  billingDay: number | null;
  billingLastSentMonth: string | null;
  monthlyFeeCents: number | null;
  paidUntil: Date | null;
  trialEndsAt: Date | null;
  billingStartDate: Date | null;
};

export const chargeRecipients = (c: Pick<ChargeCompany, 'billingEmail'>) =>
  (c.billingEmail ?? '').split(',').map((e) => e.trim()).filter(Boolean);

/** Mês da cobrança = o mês de hoje (fuso de Brasília), como "AAAA-MM". */
export const chargeMonthKey = (now = new Date()) => ymdInTz(now).slice(0, 7);
const dayOf = (now: Date) => Number(ymdInTz(now).slice(8, 10));

/** Cobrança em mês vencido: o e-mail do mês de `now` cobra o mês anterior (já usado). */
export function referenceMonth(now = new Date()) {
  const [y, m] = ymdInTz(now).split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 2, 1));
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  return { key: `${year}-${String(month).padStart(2, '0')}`, year, month, lastDay };
}

/** Dados de quem recebe (variáveis de ambiente). Sem chave Pix e sem conta, não há como cobrar. */
export function receiverConfig() {
  const env = process.env;
  return {
    pixKey: env.BILLING_PIX_KEY?.trim() || null,
    name: env.BILLING_RECEIVER_NAME?.trim() || 'LitoCode',
    city: env.BILLING_RECEIVER_CITY?.trim() || 'Salvador',
    document: env.BILLING_RECEIVER_DOCUMENT?.trim() || null,
    bank: env.BILLING_BANK_NAME?.trim() || null,
    agency: env.BILLING_BANK_AGENCY?.trim() || null,
    account: env.BILLING_BANK_ACCOUNT?.trim() || null,
  };
}

export const receiverReady = () => {
  const r = receiverConfig();
  return Boolean(r.pixKey || (r.bank && r.agency && r.account));
};

/** Já chegou o dia e a cobrança deste mês ainda não foi enviada. */
export const chargeDue = (c: ChargeCompany, now = new Date()) =>
  Boolean(c.billingEmail && c.billingDay && (c.monthlyFeeCents ?? 0) > 0) &&
  dayOf(now) >= (c.billingDay as number) &&
  c.billingLastSentMonth !== chargeMonthKey(now);

/** Data ("AAAA-MM-DD") do próximo envio automático. */
export function nextCharge(c: ChargeCompany, now = new Date()) {
  if (!c.billingEmail || !c.billingDay || !((c.monthlyFeeCents ?? 0) > 0)) return null;
  const today = ymdInTz(now);
  if (chargeDue(c, now)) return today;
  const [y, m] = today.split('-').map(Number);
  const nextMonth = dayOf(now) < c.billingDay ? m : m + 1;
  return new Date(Date.UTC(y, nextMonth - 1, c.billingDay)).toISOString().slice(0, 10);
}

/** Vencimento: o dia da tolerância (padrão 10) do mês do envio; se já passou (envio manual tardio), hoje. */
function dueDateOf(now: Date) {
  const today = ymdInTz(now);
  const due = `${today.slice(0, 8)}${String(TOLERANCE_DAY).padStart(2, '0')}`;
  return due < today ? today : due;
}

type Receiver = ReturnType<typeof receiverConfig>;

function chargeEmail(o: { company: ChargeCompany; amountCents: number; dueYmd: string; monthLabel: string; pix: string | null; receiver: Receiver }) {
  const { company, amountCents, dueYmd, monthLabel, pix, receiver } = o;
  const rows: [string, string][] = [
    ['Empresa', company.name],
    ['Referência', monthLabel],
    ['Valor', money(amountCents)],
    ['Vencimento', brDate(dueYmd)],
  ];
  const bankRows = ([
    receiver.name && ['Favorecido', receiver.name],
    receiver.document && ['CPF/CNPJ', receiver.document],
    receiver.bank && ['Banco', receiver.bank],
    receiver.agency && ['Agência', receiver.agency],
    receiver.account && ['Conta', receiver.account],
    receiver.pixKey && ['Chave Pix', receiver.pixKey],
  ].filter(Boolean)) as [string, string][];

  const table = (list: [string, string][]) =>
    list
      .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;font-size:14px">${esc(k)}</td><td style="padding:4px 0;font-size:14px"><strong>${esc(v)}</strong></td></tr>`)
      .join('');

  const html = `<!doctype html>
<html lang="pt-BR"><body style="margin:0;background:#f4f5f7;font-family:Segoe UI,Arial,sans-serif;color:#1d2330">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e2e5ea;border-radius:12px;padding:32px">
        <tr><td>
          <p style="margin:0 0 24px;font-size:18px;font-weight:700;color:#0d9488">🐾 VetPet</p>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.5">Olá! Segue a cobrança da mensalidade do VetPet referente a <strong>${esc(monthLabel)}</strong>.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px">${table(rows)}</table>
          ${pix ? `<p style="margin:0 0 8px;font-size:15px"><strong>Pagar com Pix</strong></p>
          <p style="margin:0 0 8px;font-size:14px;line-height:1.5">Leia o QR Code da imagem <strong>pix-qrcode.png</strong> (em anexo) no app do seu banco, ou use o Pix copia e cola:</p>
          <p style="margin:0 0 20px;font-size:12px;word-break:break-all;background:#f4f5f7;border-radius:8px;padding:10px 12px;font-family:Consolas,monospace">${esc(pix)}</p>` : ''}
          <p style="margin:0 0 8px;font-size:15px"><strong>Dados para transferência</strong></p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px">${table(bankRows)}</table>
          <p style="margin:0 0 8px;font-size:13px;color:#6b7280">Depois de pagar, responda este e-mail com o comprovante para agilizarmos a baixa.</p>
          <p style="margin:0;font-size:13px;color:#6b7280">Dúvidas? Fale com a LitoCode.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    `Olá! Segue a cobrança da mensalidade do VetPet referente a ${monthLabel}.`,
    '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    ...(pix ? ['', 'Pix copia e cola (o QR Code está no anexo pix-qrcode.png):', pix] : []),
    '',
    'Dados para transferência:',
    ...bankRows.map(([k, v]) => `${k}: ${v}`),
    '',
    'Depois de pagar, responda este e-mail com o comprovante.',
  ].join('\n');

  return { subject: `Mensalidade VetPet — ${company.name} — ${monthLabel}`, html, text };
}

@Injectable()
export class BillingChargeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BillingChargeService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private prisma: PrismaService,
    private mail: MailService,
  ) {}

  // Servidor próprio: confere de hora em hora. Na Vercel (serverless) quem chama é o cron diário (/api/cron/billing).
  onModuleInit() {
    this.timer = setInterval(() => this.runDueCharges().catch((e) => this.logger.error(e.message)), 60 * 60 * 1000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Envia a cobrança do mês de `now`. `recipients` troca os destinatários cadastrados (teste/envio manual). */
  async sendCompanyCharge(company: ChargeCompany, opts: { now?: Date; recipients?: string[] } = {}) {
    const now = opts.now ?? new Date();
    const to = opts.recipients ?? chargeRecipients(company);
    if (!to.length) throw new Error('Informe o e-mail do financeiro');
    if (!((company.monthlyFeeCents ?? 0) > 0)) throw new Error('Defina o valor da mensalidade');
    const receiver = receiverConfig();
    if (!receiverReady()) throw new Error('Configure seus dados de recebimento (BILLING_PIX_KEY ou banco/agência/conta) no servidor');

    const ref = referenceMonth(now);
    const monthLabel = `${MONTH_NAMES[ref.month - 1]} de ${ref.year}`;
    const dueYmd = dueDateOf(now);
    const amountCents = company.monthlyFeeCents as number;

    const pix = receiver.pixKey
      ? pixPayload({ key: receiver.pixKey, name: receiver.name, city: receiver.city, amountCents, txid: `VP${company.id.slice(-10)}M${ref.key.replace('-', '')}` })
      : null;
    const attachments = pix ? [{ filename: 'pix-qrcode.png', content: await pixQrPng(pix) }] : [];

    await this.mail.sendStrict({ to, attachments, ...chargeEmail({ company, amountCents, dueYmd, monthLabel, pix, receiver }) });
    return { recipients: to, month: ref.key, dueDate: dueYmd };
  }

  /**
   * Envia as cobranças do dia. Cobra o mês anterior (mês vencido). Não cobra empresa suspensa, isenta (sem cobrança),
   * em teste grátis ou já paga até o fim do mês cobrado.
   */
  async runDueCharges(opts: { now?: Date; budgetMs?: number } = {}) {
    const now = opts.now ?? new Date();
    const budgetMs = opts.budgetMs ?? 20_000;
    const started = Date.now();
    const key = chargeMonthKey(now);
    const ref = referenceMonth(now);
    const companies = await PrismaService.raw.company.findMany({
      where: {
        active: true,
        billingEmail: { not: null },
        billingDay: { lte: dayOf(now) },
        monthlyFeeCents: { gt: 0 },
        OR: [{ billingLastSentMonth: null }, { billingLastSentMonth: { not: key } }],
      },
    });
    const result = { sent: [] as any[], failed: [] as any[], pending: 0 };
    for (const company of companies) {
      if (!chargeDue(company, now)) continue;
      const billing = computeBilling(company, now);
      if (billing.state === 'none' || billing.state === 'trial') continue;
      // Depois do teste, o primeiro mês cobrado é o primeiro mês cheio depois dele.
      if (!billing.paidUntil && billing.trialEndsAt && ref.key <= ymdInTz(billing.trialEndsAt).slice(0, 7)) continue;
      // Sem teste: o primeiro mês cobrado é o mês em que a empresa começou.
      if (!billing.paidUntil && company.billingStartDate && ref.key < company.billingStartDate.toISOString().slice(0, 7)) continue;
      // Já pago: o período pago cobre o fim do mês cobrado.
      if (billing.paidUntil && billing.paidUntil >= ref.lastDay) continue;
      if (Date.now() - started > budgetMs) {
        result.pending++;
        continue;
      }
      try {
        const sent = await this.sendCompanyCharge(company, { now });
        await PrismaService.raw.company.update({ where: { id: company.id }, data: { billingLastSentMonth: key } });
        result.sent.push({ company: company.slug, ...sent });
        this.logger.log(`${company.name}: cobrança de ${key} enviada para ${sent.recipients.join(', ')}`);
      } catch (err) {
        result.failed.push({ company: company.slug, error: (err as Error).message });
        this.logger.error(`${company.name}: falha ao enviar ${key}: ${(err as Error).message}`);
      }
    }
    return result;
  }
}
