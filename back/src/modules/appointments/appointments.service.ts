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
    await this.findOne(id);
    const data: any = { ...dto };
    if (dto.date) {
      data.date = new Date(dto.date);
      data.reminderSentAt = null; // nova data: lembrete deve ser reenviado
    }
    return this.prisma.appointment.update({ where: { id }, data, include });
  }

  async updateStatus(id: string, status: AppointmentStatus) {
    await this.findOne(id);
    return this.prisma.appointment.update({ where: { id }, data: { status }, include });
  }

  remove(id: string) {
    return this.updateStatus(id, AppointmentStatus.CANCELLED);
  }
}
