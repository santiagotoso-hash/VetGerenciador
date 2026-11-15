import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { currentCompanyId } from '../../common/tenant';
import { CreateServiceDto, UpdateServiceDto } from './dto';

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateServiceDto) {
    return this.prisma.service.create({ data: { ...dto, companyId: currentCompanyId() } });
  }

  findAll(search?: string, active?: string) {
    const where: any = {};
    if (active !== undefined) where.active = active === 'true';
    if (search) where.name = { contains: search, mode: 'insensitive' };
    return this.prisma.service.findMany({ where, orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    const s = await this.prisma.service.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Serviço não encontrado');
    return s;
  }

  async update(id: string, dto: UpdateServiceDto) {
    await this.findOne(id);
    return this.prisma.service.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.service.update({ where: { id }, data: { active: false } });
  }
}
