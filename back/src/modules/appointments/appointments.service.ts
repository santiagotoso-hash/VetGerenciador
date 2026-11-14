import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppointmentNotifier } from './appointment-notifier';
import { AppointmentStatus, CreateAppointmentDto, UpdateAppointmentDto } from './dto';

const include = {
  pet: { include: { client: true } },
  veterinarian: { select: { id: true, name: true } },
  scheduledBy: { select: { id: true, name: true } },
  service: true,
};

@Injectable()
export class AppointmentsService {
  constructor(
    private prisma: PrismaService,
    private notifier: AppointmentNotifier,
  ) {}

  async create(dto: CreateAppointmentDto) {
    let price = dto.price;
    if (price === undefined && dto.serviceId) {
      const svc = await this.prisma.service.findUnique({ where: { id: dto.serviceId } });
      price = svc?.price;
    }
    const created = await this.prisma.appointment.create({
      data: { ...dto, price, date: new Date(dto.date) },
      include,
    });
    if (created.notifyClient) {
      // não bloqueia nem derruba o agendamento se o e-mail falhar
      this.notifier.sendConfirmation(created.id).catch(() => undefined);
    }
    return created;
  }

  findAll(
    from?: string,
    to?: string,
    status?: string,
    petId?: string,
    veterinarianId?: string,
    clientId?: string,
  ) {
    const where: any = {};
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
    }
    if (status) where.status = status;
    if (petId) where.petId = petId;
    if (veterinarianId) where.veterinarianId = veterinarianId;
    if (clientId) where.pet = { clientId };
    return this.prisma.appointment.findMany({ where, include, orderBy: { date: 'asc' } });
  }

  async findOne(id: string) {
    const a = await this.prisma.appointment.findUnique({ where: { id }, include });
    if (!a) throw new NotFoundException('Agendamento não encontrado');
    return a;
  }

  async update(id: string, dto: UpdateAppointmentDto) {
    const before = await this.findOne(id);
    const data: any = { ...dto };
    if (dto.date) {
      data.date = new Date(dto.date);
      if (data.date.getTime() !== before.date.getTime()) data.reminderSentAt = null; // nova data: lembrete deve ser reenviado
    }
    if (dto.serviceId && dto.price === undefined && dto.serviceId !== before.serviceId) {
      const svc = await this.prisma.service.findUnique({ where: { id: dto.serviceId } });
      if (svc) data.price = svc.price;
    }
    const after = await this.prisma.appointment.update({ where: { id }, data, include });
    // e-mail só se ainda estiver ativo; falha no envio não derruba a edição
    if (after.status !== AppointmentStatus.CANCELLED) {
      this.notifier.sendChange(before, after).catch(() => undefined);
    }
    return after;
  }

  async updateStatus(id: string, status: AppointmentStatus) {
    const before = await this.findOne(id);
    const after = await this.prisma.appointment.update({ where: { id }, data: { status }, include });
    if (status === AppointmentStatus.CANCELLED && before.status !== AppointmentStatus.CANCELLED) {
      this.notifier.sendCancellation(after).catch(() => undefined);
    }
    return after;
  }

  /** Exclui de vez. Se ainda estava ativo, avisa o cliente do cancelamento antes. */
  async remove(id: string) {
    const a = await this.findOne(id);
    if (a.status !== AppointmentStatus.CANCELLED && a.status !== AppointmentStatus.COMPLETED) {
      this.notifier.sendCancellation(a).catch(() => undefined);
    }
    // o prontuário vinculado (se houver) é mantido, só desvinculado
    await this.prisma.$transaction([
      this.prisma.medicalRecord.updateMany({ where: { appointmentId: id }, data: { appointmentId: null } }),
      this.prisma.appointment.delete({ where: { id } }),
    ]);
    return { id };
  }
}
