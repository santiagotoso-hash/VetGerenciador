import {
  BadGatewayException, BadRequestException, ConflictException, Injectable, NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { computeBilling, ymdInTz } from '../billing/billing';
import {
  BillingChargeService, chargeDue, chargeMonthKey, nextCharge, receiverReady,
} from '../billing/billing-charge.service';
import {
  CompanyUserDto, CreateCompanyDto, CreatePaymentDto, InvoiceSettingsDto, UpdateCompanyDto, UpdateCompanyUserDto,
} from './dto';

const DAY_MS = 86_400_000;

const TEXT_FIELDS = [
  'cnpj', 'phone', 'email', 'address', 'city', 'state', 'zipCode', 'notes',
  'ownerName', 'ownerEmail', 'ownerPhone', 'ownerDocument',
] as const;

const slugify = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'empresa';

const publicUser = {
  id: true, name: true, email: true, role: true, phone: true, active: true, createdAt: true,
};

const toDay = (ymd: string) => new Date(`${ymd}T00:00:00Z`);
const today = () => toDay(ymdInTz(new Date()));

/** Vários e-mails separados por vírgula/espaço/ponto e vírgula -> "a@x.com, b@y.com" (ou null se vazio). */
function parseEmails(text: string) {
  const list = text.split(/[\s,;]+/).filter(Boolean).map((e) => e.toLowerCase());
  if (list.length > 5) throw new BadRequestException('Informe no máximo 5 e-mails');
  for (const e of list) if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new BadRequestException(`E-mail inválido: ${e}`);
  return list.length ? [...new Set(list)].join(', ') : null;
}

/**
 * Gestão das empresas (clínicas/petshops) e do financeiro delas. Usa o cliente SEM filtro de
 * empresa (PrismaService.raw): só o SUPER_ADMIN chega aqui.
 */
@Injectable()
export class CompaniesService {
  constructor(private charges: BillingChargeService) {}

  private get db() {
    return PrismaService.raw;
  }

  /** Empresa + situação de cobrança + dados do envio por e-mail. */
  private view(c: any) {
    const { payments, ...company } = c;
    return {
      ...company,
      billing: computeBilling(c),
      invoice: {
        email: c.billingEmail ?? null,
        day: c.billingDay ?? null,
        lastSentMonth: c.billingLastSentMonth ?? null,
        next: nextCharge(c),
        ready: receiverReady(),
      },
      lastPayment: payments?.[0] ? { ...payments[0], paidAt: payments[0].paidAt.toISOString().slice(0, 10) } : null,
    };
  }

  private async uniqueSlug(name: string) {
    const base = slugify(name);
    let slug = base;
    for (let i = 2; await this.db.company.findUnique({ where: { slug } }); i++) slug = `${base}-${i}`;
    return slug;
  }

  private async assertEmailsFree(emails: string[]) {
    const lower = emails.map((e) => e.trim().toLowerCase());
    if (new Set(lower).size !== lower.length) throw new ConflictException('E-mail repetido na lista de usuários');
    const taken = await this.db.user.findMany({ where: { email: { in: lower } }, select: { email: true } });
    if (taken.length) throw new ConflictException(`E-mail já cadastrado: ${taken.map((t) => t.email).join(', ')}`);
  }

  private async userData(u: CompanyUserDto, defaultRole: 'ADMIN' | 'RECEPTIONIST') {
    return {
      name: u.name.trim(),
      email: u.email.trim().toLowerCase(),
      password: await bcrypt.hash(u.password, 10),
      role: (u.role ?? defaultRole) as any,
      phone: u.phone,
    };
  }

  async create(dto: CreateCompanyDto) {
    const extra = dto.users ?? [];
    await this.assertEmailsFree([dto.admin.email, ...extra.map((u) => u.email)]);
    const users = [
      await this.userData({ ...dto.admin, role: 'ADMIN' as any }, 'ADMIN'),
      ...(await Promise.all(extra.map((u) => this.userData(u, 'RECEPTIONIST')))),
    ];
    // trialDays > 0: teste grátis; 0: sem teste, começa a cobrar hoje; omitido: sem cobrança.
    const billing: Record<string, unknown> = {};
    if (dto.trialDays) billing.trialEndsAt = new Date(Date.now() + dto.trialDays * DAY_MS);
    else if (dto.trialDays === 0) billing.billingStartDate = today();
    if (dto.monthlyFeeCents) billing.monthlyFeeCents = dto.monthlyFeeCents;

    const created = await this.db.company.create({
      data: { name: dto.name.trim(), slug: await this.uniqueSlug(dto.name), ...billing, users: { create: users } },
      include: { users: { select: publicUser, orderBy: { createdAt: 'asc' } } },
    });
    return this.view(created);
  }

  async findAll() {
    const list = await this.db.company.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { users: true, clients: true, pets: true, appointments: true } },
        users: { where: { role: 'ADMIN' }, select: { name: true, email: true, active: true }, orderBy: { createdAt: 'asc' } },
        payments: { orderBy: { paidAt: 'desc' }, take: 1, select: { paidAt: true, amountCents: true } },
      },
    });
    const active = await this.db.user.groupBy({ by: ['companyId'], where: { active: true, companyId: { not: null } }, _count: true });
    const activeOf = new Map(active.map((u) => [u.companyId, u._count]));
    return list.map((c) => ({ ...this.view(c), activeUsers: activeOf.get(c.id) ?? 0 }));
  }

  async findOne(id: string) {
    const c = await this.db.company.findUnique({
      where: { id },
      include: {
        _count: { select: { clients: true, pets: true, appointments: true } },
        users: { select: publicUser, orderBy: { createdAt: 'asc' } },
        payments: { orderBy: { paidAt: 'desc' }, take: 1, select: { paidAt: true, amountCents: true } },
      },
    });
    if (!c) throw new NotFoundException('Empresa não encontrada');
    return this.view(c);
  }

  private async getRaw(id: string) {
    const c = await this.db.company.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Empresa não encontrada');
    return c;
  }

  async update(id: string, dto: UpdateCompanyDto) {
    await this.getRaw(id);
    const data: Record<string, unknown> = {
      ...(dto.name && { name: dto.name.trim() }),
      active: dto.active,
      monthlyFeeCents: dto.monthlyFeeCents,
    };
    // campos de texto opcionais: vazio limpa (null), ausente não mexe
    for (const k of TEXT_FIELDS) {
      const v = dto[k];
      if (v !== undefined) data[k] = v.trim() || null;
    }
    for (const k of ['email', 'ownerEmail'] as const) {
      const v = data[k];
      if (typeof v === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new BadRequestException('E-mail inválido');
    }
    if (dto.logo !== undefined) {
      const logo = dto.logo.trim();
      if (logo && !/^(data:image\/(png|jpe?g|webp);base64,|\/assets\/)/.test(logo)) {
        throw new BadRequestException('Logomarca inválida: envie uma imagem PNG, JPG ou WebP');
      }
      data.logo = logo || null;
    }
    if (typeof data.state === 'string') data.state = (data.state as string).toUpperCase();
    if (dto.trialDays) data.trialEndsAt = new Date(Date.now() + dto.trialDays * DAY_MS);
    if (dto.startBilling) Object.assign(data, { trialEndsAt: null, billingStartDate: today() });
    if (dto.exempt) Object.assign(data, { trialEndsAt: null, paidUntil: null, billingStartDate: null });
    await this.db.company.update({ where: { id }, data });
    return this.findOne(id);
  }

  // ---------- relatório de uso ----------

  /** Quanto a empresa usa o sistema: totais, últimos 30 dias, série de 6 meses e último acesso dos usuários. */
  async usage(id: string) {
    await this.getRaw(id);
    const db = this.db;
    const now = new Date();
    const since30 = new Date(now.getTime() - 30 * DAY_MS);
    const firstMonth = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const last = (model: 'appointment' | 'sale' | 'client' | 'medicalRecord') =>
      (db[model] as any).findFirst({ where: { companyId: id }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } });

    const [
      usersTotal, usersActive, clients, pets, products, appointments, records, sales,
      appts30, sales30, revenue30, revenueTotal, byStatus, apptRows, saleRows, users,
      lastAppt, lastSale, lastClient, lastRecord,
    ] = await Promise.all([
      db.user.count({ where: { companyId: id } }),
      db.user.count({ where: { companyId: id, active: true } }),
      db.client.count({ where: { companyId: id, active: true } }),
      db.pet.count({ where: { companyId: id, active: true } }),
      db.product.count({ where: { companyId: id, active: true } }),
      db.appointment.count({ where: { companyId: id } }),
      db.medicalRecord.count({ where: { companyId: id } }),
      db.sale.count({ where: { companyId: id } }),
      db.appointment.count({ where: { companyId: id, date: { gte: since30 } } }),
      db.sale.count({ where: { companyId: id, date: { gte: since30 } } }),
      db.sale.aggregate({ where: { companyId: id, date: { gte: since30 } }, _sum: { total: true } }),
      db.sale.aggregate({ where: { companyId: id }, _sum: { total: true } }),
      db.appointment.groupBy({ by: ['status'], where: { companyId: id }, _count: { _all: true } }),
      db.appointment.findMany({ where: { companyId: id, date: { gte: firstMonth } }, select: { date: true } }),
      db.sale.findMany({ where: { companyId: id, date: { gte: firstMonth } }, select: { date: true, total: true } }),
      db.user.findMany({
        where: { companyId: id },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, email: true, role: true, active: true, lastLoginAt: true },
      }),
      last('appointment'), last('sale'), last('client'), last('medicalRecord'),
    ]);

    const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      return { month: key(d), appointments: 0, sales: 0, revenue: 0 };
    });
    const byMonth = new Map(months.map((m) => [m.month, m]));
    for (const a of apptRows) {
      const m = byMonth.get(key(a.date));
      if (m) m.appointments++;
    }
    for (const s of saleRows) {
      const m = byMonth.get(key(s.date));
      if (m) {
        m.sales++;
        m.revenue += s.total;
      }
    }

    const activity = [lastAppt, lastSale, lastClient, lastRecord].map((r) => r?.createdAt as Date | undefined).filter(Boolean) as Date[];
    const logins = users.map((u) => u.lastLoginAt).filter(Boolean) as Date[];
    const latest = (list: Date[]) => (list.length ? new Date(Math.max(...list.map((d) => d.getTime()))) : null);

    return {
      totals: { users: usersTotal, activeUsers: usersActive, clients, pets, products, appointments, medicalRecords: records, sales, revenue: revenueTotal._sum.total ?? 0 },
      last30: { appointments: appts30, sales: sales30, revenue: revenue30._sum.total ?? 0 },
      appointmentsByStatus: byStatus.map((g) => ({ status: g.status, count: g._count._all })),
      months,
      lastActivityAt: latest(activity),
      lastLoginAt: latest(logins),
      users,
    };
  }

  // ---------- usuários ----------

  async addUser(companyId: string, dto: CompanyUserDto) {
    await this.getRaw(companyId);
    await this.assertEmailsFree([dto.email]);
    return this.db.user.create({
      data: { ...(await this.userData(dto, 'RECEPTIONIST')), companyId },
      select: publicUser,
    });
  }

  async updateUser(companyId: string, userId: string, dto: UpdateCompanyUserDto) {
    const u = await this.db.user.findFirst({ where: { id: userId, companyId } });
    if (!u) throw new NotFoundException('Usuário não encontrado nesta empresa');
    return this.db.user.update({
      where: { id: userId },
      data: { active: dto.active, ...(dto.password && { password: await bcrypt.hash(dto.password, 10), passwordChangedAt: new Date() }) },
      select: publicUser,
    });
  }

  // ---------- cobrança por e-mail ----------

  async setInvoice(id: string, dto: InvoiceSettingsDto) {
    const current = await this.getRaw(id);
    const email = parseEmails(dto.email);
    // Ao ligar ou trocar para um dia que já passou neste mês, a cobrança não sai de surpresa no dia seguinte:
    // o primeiro envio automático fica para o dia escolhido ("Enviar cobrança agora" manda na hora).
    const turningOn = !current.billingEmail || current.billingDay !== dto.day;
    const next = { billingEmail: email, billingDay: dto.day, billingLastSentMonth: current.billingLastSentMonth };
    if (email && turningOn && chargeDue({ ...current, ...next, monthlyFeeCents: current.monthlyFeeCents || 1 })) {
      next.billingLastSentMonth = chargeMonthKey();
    }
    await this.db.company.update({ where: { id }, data: next });
    return this.findOne(id);
  }

  /** Envia agora a cobrança deste mês, sem mexer no envio automático. */
  async sendInvoice(id: string, email?: string) {
    const company = await this.getRaw(id);
    const recipients = email ? (parseEmails(email) ?? '').split(', ').filter(Boolean) : undefined;
    try {
      return await this.charges.sendCompanyCharge(company, { recipients });
    } catch (err) {
      const message = (err as Error).message;
      // Erros de configuração/dados são do superadmin e ajudam; falha do provedor de e-mail fica só no log.
      if (/^(Informe|Defina|Configure)/.test(message)) throw new BadRequestException(message);
      console.error(`[cobrança] envio manual da empresa ${id}: ${message}`);
      throw new BadGatewayException('Não foi possível enviar o e-mail agora. Tente de novo em alguns minutos.');
    }
  }

  // ---------- pagamentos ----------

  private paymentView(p: any) {
    return {
      ...p,
      paidAt: p.paidAt.toISOString().slice(0, 10),
      periodStart: p.periodStart.toISOString().slice(0, 10),
      periodEnd: p.periodEnd.toISOString().slice(0, 10),
    };
  }

  /** "Pago até" = fim do período pago mais distante (recalculado ao incluir ou remover pagamento). */
  private async refreshPaidUntil(companyId: string) {
    const latest = await this.db.payment.findFirst({ where: { companyId }, orderBy: { periodEnd: 'desc' } });
    await this.db.company.update({ where: { id: companyId }, data: { paidUntil: latest?.periodEnd ?? null } });
  }

  async listPayments(companyId: string) {
    const payments = await this.db.payment.findMany({ where: { companyId }, orderBy: { periodEnd: 'desc' } });
    return payments.map((p) => this.paymentView(p));
  }

  async addPayment(companyId: string, dto: CreatePaymentDto, createdById?: string) {
    await this.getRaw(companyId);
    if (dto.periodEnd < dto.periodStart) throw new BadRequestException('O fim do período deve ser depois do início');
    const payment = await this.db.payment.create({
      data: {
        companyId,
        amountCents: dto.amountCents,
        method: dto.method,
        note: dto.note?.trim() || null,
        paidAt: toDay(dto.paidAt),
        periodStart: toDay(dto.periodStart),
        periodEnd: toDay(dto.periodEnd),
        createdById,
      },
    });
    await this.refreshPaidUntil(companyId);
    return { payment: this.paymentView(payment), company: await this.findOne(companyId) };
  }

  /** Remover pagamento lançado por engano. */
  async removePayment(paymentId: string) {
    const payment = await this.db.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Pagamento não encontrado');
    await this.db.payment.delete({ where: { id: paymentId } });
    await this.refreshPaidUntil(payment.companyId);
    return { company: await this.findOne(payment.companyId) };
  }
}
