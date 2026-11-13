import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFinancialEntryDto, UpdateFinancialEntryDto } from './dto';

@Injectable()
export class FinancialService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateFinancialEntryDto) {
    return this.prisma.financialEntry.create({ data: { ...dto, date: new Date(dto.date) } });
  }

  private range(from?: string, to?: string) {
    const where: any = {};
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
    }
    return where;
  }

  findAll(from?: string, to?: string, type?: string, paid?: string) {
    const where = this.range(from, to);
    if (type) where.type = type;
    if (paid !== undefined) where.paid = paid === 'true';
    return this.prisma.financialEntry.findMany({ where, orderBy: { date: 'desc' } });
  }

  async summary(from?: string, to?: string) {
    const entries = await this.prisma.financialEntry.findMany({
      where: { ...this.range(from, to), paid: true },
    });
    const income = entries.filter((e) => e.type === 'INCOME').reduce((s, e) => s + e.amount, 0);
    const expense = entries.filter((e) => e.type === 'EXPENSE').reduce((s, e) => s + e.amount, 0);
    return { income, expense, balance: income - expense };
  }

  async findOne(id: string) {
    const e = await this.prisma.financialEntry.findUnique({ where: { id } });
    if (!e) throw new NotFoundException('Lançamento não encontrado');
    return e;
  }

  async update(id: string, dto: UpdateFinancialEntryDto) {
    await this.findOne(id);
    const data: any = { ...dto };
    if (dto.date) data.date = new Date(dto.date);
    return this.prisma.financialEntry.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.financialEntry.delete({ where: { id } });
  }
}
