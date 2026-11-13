import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  async create(createClientDto: CreateClientDto) {
    return this.prisma.client.create({ data: createClientDto });
  }

  async findAll(search?: string, active?: string) {
    const where: any = {};
    if (active !== undefined) where.active = active === 'true';
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { cpf: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.client.findMany({ where, include: { pets: true } });
  }

  async findOne(id: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: { pets: true },
    });
    if (!client) throw new NotFoundException('Cliente não encontrado');
    return client;
  }

  async getPets(id: string) {
    await this.findOne(id);
    return this.prisma.pet.findMany({ where: { clientId: id } });
  }

  async update(id: string, updateClientDto: UpdateClientDto) {
    await this.findOne(id);
    return this.prisma.client.update({ where: { id }, data: updateClientDto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.client.update({
      where: { id },
      data: { active: false },
    });
  }
}
