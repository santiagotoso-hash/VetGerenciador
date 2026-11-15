import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

const DAY = 24 * 60 * 60 * 1000;

const typeLabel: Record<string, string> = {
  CONSULTATION: 'Consulta',
  VACCINATION: 'Vacinação',
  EXAM: 'Exame',
  SURGERY: 'Cirurgia',
  GROOMING: 'Tosa',
  BATH: 'Banho',
  RETURN: 'Retorno',
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

@Injectable()
export class AppointmentNotifier implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AppointmentNotifier.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private prisma: PrismaService,
    private mail: MailService,
  ) {}

  onModuleInit() {
    // verifica lembretes a cada 10 minutos
    this.timer = setInterval(() => { this.sendDueReminders().catch((e) => this.logger.error(e.message)); this.sendBirthdays().catch((e) => this.logger.error(e.message)); }, 10 * 60 * 1000);
    setTimeout(() => this.sendBirthdays().catch((e) => this.logger.error(e.message)), 20 * 1000);
    setTimeout(() => this.sendDueReminders().catch((e) => this.logger.error(e.message)), 15 * 1000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private when(d: Date | string) {
    return new Date(d).toLocaleString('pt-BR', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: process.env.TZ || 'America/Sao_Paulo',
    });
  }

  private body(a: any, intro: string, changes: string[] = []) {
    const when = this.when(a.date);
    return `<div style="font-family:Arial,sans-serif;max-width:520px">
      <h2 style="color:#0d9488">🐾 ${esc(a.company?.name ?? 'VetPet')}</h2>
      <p>Olá, ${esc(a.pet.client.name)}!</p>
      <p>${intro}</p>
      ${changes.length ? `<ul style="color:#b45309">${changes.map((c) => `<li>${c}</li>`).join('')}</ul>` : ''}
      <table style="border-collapse:collapse">
        <tr><td style="padding:4px 12px 4px 0;color:#666">Pet</td><td><b>${esc(a.pet.name)}</b></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666">Atendimento</td><td>${typeLabel[a.type] ?? a.type}${a.service ? ` — ${esc(a.service.name)}` : ''}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666">Data e hora</td><td><b>${when}</b></td></tr>
        ${a.veterinarian ? `<tr><td style="padding:4px 12px 4px 0;color:#666">Profissional</td><td>${esc(a.veterinarian.name)}</td></tr>` : ''}
      </table>
      <p style="color:#666;font-size:13px">Se precisar remarcar ou cancelar, entre em contato conosco.</p>
    </div>`;
  }

  private load(id: string) {
    return this.prisma.appointment.findUnique({
      where: { id },
      include: { pet: { include: { client: true } }, service: true, veterinarian: { select: { name: true } }, company: { select: { name: true } } },
    });
  }

  /** E-mail de confirmação, no momento do agendamento. */
  async sendConfirmation(id: string) {
    const a = await this.load(id);
    const to = a?.pet.client.email;
    if (!a || !a.notifyClient || !to) return;
    const ok = await this.mail.send(to, 'Agendamento confirmado', this.body(a, 'Seu agendamento foi registrado:'));
    if (ok) await this.prisma.appointment.update({ where: { id }, data: { confirmationSentAt: new Date() } });
  }

  private label(a: any) {
    return `${typeLabel[a.type] ?? a.type}${a.service ? ` — ${a.service.name}` : ''}`;
  }

  /** E-mail com o que mudou, quando o agendamento é editado. Recebe o estado antes e depois. */
  async sendChange(before: any, after: any) {
    const to = after.pet.client.email;
    if (!after.notifyClient || !to) return;
    const changes: string[] = [];
    if (new Date(before.date).getTime() !== new Date(after.date).getTime())
      changes.push(`<b>Data e hora:</b> de ${this.when(before.date)} para <b>${this.when(after.date)}</b>`);
    if (this.label(before) !== this.label(after))
      changes.push(`<b>Atendimento:</b> de ${esc(this.label(before))} para <b>${esc(this.label(after))}</b>`);
    if (before.petId !== after.petId)
      changes.push(`<b>Pet:</b> de ${esc(before.pet.name)} para <b>${esc(after.pet.name)}</b>`);
    if ((before.veterinarian?.id ?? null) !== (after.veterinarian?.id ?? null))
      changes.push(`<b>Profissional:</b> de ${esc(before.veterinarian?.name ?? '—')} para <b>${esc(after.veterinarian?.name ?? '—')}</b>`);
    if (!changes.length) return;
    await this.mail.send(to, 'Seu agendamento foi alterado', this.body(after, 'Houve uma alteração no seu agendamento:', changes));
  }

  /** E-mail de cancelamento. Recebe o agendamento já carregado (serve também antes de excluir). */
  async sendCancellation(a: any) {
    const to = a.pet.client.email;
    if (!a.notifyClient || !to) return;
    await this.mail.send(to, 'Agendamento cancelado', this.body(a, 'Seu agendamento foi <b>cancelado</b>:'));
  }

  /** Parabéns no dia do aniversário (fuso de São Paulo) para pets com a opção ativada. */
  async sendBirthdays() {
    const tz = process.env.TZ || 'America/Sao_Paulo';
    const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date()).split('-').map(Number);
    const pets = await this.prisma.pet.findMany({
      where: { active: true, birthdayEmail: true, birthDate: { not: null }, OR: [{ birthdayEmailYear: null }, { birthdayEmailYear: { lt: y } }] },
      include: { client: true, company: { select: { name: true } } },
    });
    for (const p of pets) {
      const b = p.birthDate!;
      // birthDate é gravada em UTC (meia-noite), então comparamos em UTC
      if (b.getUTCMonth() + 1 !== m || b.getUTCDate() !== d) continue;
      const to = p.client.email;
      if (!to) continue;
      const years = y - b.getUTCFullYear();
      const html = `<div style="font-family:Arial,sans-serif;max-width:520px;text-align:center">
        <h2 style="color:#0d9488">🐾 ${esc(p.company?.name ?? 'VetPet')}</h2>
        ${p.photo ? `<img src="${p.photo}" alt="${esc(p.name)}" style="width:160px;height:160px;border-radius:50%;object-fit:cover">` : '<div style="font-size:64px">🎂</div>'}
        <h3>Feliz aniversário, ${esc(p.name)}! 🎉</h3>
        <p>Olá, ${esc(p.client.name)}! Hoje ${esc(p.name)} completa <b>${years} ano${years === 1 ? '' : 's'}</b>.<br>Toda a equipe da clínica deseja muita saúde, carinho e petiscos! 🦴</p></div>`;
      const ok = await this.mail.send(to, `Feliz aniversário, ${p.name}! 🎂`, html);
      if (ok) await this.prisma.pet.update({ where: { id: p.id }, data: { birthdayEmailYear: y } });
    }
  }

  /** Lembrete: agendamentos nas próximas 24h que ainda não receberam lembrete. */
  async sendDueReminders() {
    const now = new Date();
    const list = await this.prisma.appointment.findMany({
      where: {
        notifyClient: true,
        reminderSentAt: null,
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
        date: { gt: now, lte: new Date(now.getTime() + DAY) },
      },
      include: { pet: { include: { client: true } }, service: true, veterinarian: { select: { name: true } }, company: { select: { name: true } } },
    });
    for (const a of list) {
      // agendado já dentro das 24h: a confirmação serve como aviso, sem lembrete duplicado
      const bookedLate = a.createdAt.getTime() > a.date.getTime() - DAY;
      const to = a.pet.client.email;
      if (bookedLate || !to) {
        await this.prisma.appointment.update({ where: { id: a.id }, data: { reminderSentAt: now } });
        continue;
      }
      const ok = await this.mail.send(to, 'Lembrete: atendimento amanhã', this.body(a, 'Lembrete do seu atendimento <b>nas próximas 24 horas</b>:'));
      if (ok) await this.prisma.appointment.update({ where: { id: a.id }, data: { reminderSentAt: now } });
    }
  }
}
