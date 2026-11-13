import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';

@Injectable()
export class PetsService {
  constructor(private prisma: PrismaService) {}

  async create(createPetDto: CreatePetDto) {
    return this.prisma.pet.create({
      data: createPetDto,
      include: { client: true },
    });
  }

  async findAll(search?: string, clientId?: string) {
    const where: any = {};
    if (clientId) where.clientId = clientId;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { breed: { contains: search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.pet.findMany({
      where,
      include: { client: true },
    });
  }

  async findOne(id: string) {
    const pet = await this.prisma.pet.findUnique({
      where: { id },
      include: { client: true },
    });
    if (!pet) throw new NotFoundException('Pet não encontrado');
    return pet;
  }

  async getAppointments(id: string) {
    await this.findOne(id);
    return this.prisma.appointment.findMany({
      where: { petId: id },
      include: { service: true, veterinarian: true },
      orderBy: { date: 'desc' },
    });
  }

  async getMedicalRecords(id: string) {
    await this.findOne(id);
    return this.prisma.medicalRecord.findMany({
      where: { petId: id },
      include: { veterinarian: true },
      orderBy: { date: 'desc' },
    });
  }

  async update(id: string, updatePetDto: UpdatePetDto) {
    await this.findOne(id);
    return this.prisma.pet.update({
      where: { id },
      data: { ...updatePetDto, ...(updatePetDto.photo === '' && { photo: null }) },
      include: { client: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.pet.update({
      where: { id },
      data: { active: false },
    });
  }
}
