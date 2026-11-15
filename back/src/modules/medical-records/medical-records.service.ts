import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { currentCompanyId } from '../../common/tenant';
import { assertExists } from '../../common/tenant-refs';
import { CreateMedicalRecordDto, UpdateMedicalRecordDto } from './dto';

const include = {
  pet: { include: { client: true } },
  veterinarian: { select: { id: true, name: true } },
};

@Injectable()
export class MedicalRecordsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateMedicalRecordDto, veterinarianId: string) {
    await assertExists(this.prisma.pet.findUnique({ where: { id: dto.petId } }), 'Pet');
    return this.prisma.medicalRecord.create({
      data: { ...dto, date: dto.date ? new Date(dto.date) : undefined, veterinarianId, companyId: currentCompanyId() },
      include,
    });
  }

  findAll(petId?: string) {
    return this.prisma.medicalRecord.findMany({
      where: petId ? { petId } : {},
      include,
      orderBy: { date: 'desc' },
    });
  }

  async findOne(id: string) {
    const r = await this.prisma.medicalRecord.findUnique({ where: { id }, include });
    if (!r) throw new NotFoundException('Prontuário não encontrado');
    return r;
  }

  async update(id: string, dto: UpdateMedicalRecordDto) {
    await this.findOne(id);
    const data: any = { ...dto };
    if (dto.date) data.date = new Date(dto.date);
    return this.prisma.medicalRecord.update({ where: { id }, data, include });
  }
}
