import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { currentCompanyId } from '../../common/tenant';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcryptjs';

/** Empresa do usuário + o que a cobrança precisa para decidir bloqueio e avisos. */
const COMPANY_SELECT = {
  id: true, name: true, logo: true, active: true,
  trialEndsAt: true, paidUntil: true, monthlyFeeCents: true, billingStartDate: true,
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    const email = createUserDto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Email já cadastrado');
    }
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    const { password, refreshToken, ...rest } = await this.prisma.user.create({
      data: { ...createUserDto, email, password: hashedPassword, companyId: currentCompanyId() },
    });
    return rest;
  }

  async findAll(active?: string) {
    const where = active !== undefined ? { active: active === 'true' } : {};
    const users = await this.prisma.user.findMany({ where, orderBy: { name: 'asc' } });
    return users.map(({ password, refreshToken, ...u }) => u);
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { company: { select: COMPANY_SELECT } },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    const { password, refreshToken, ...rest } = user;
    return rest;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: { company: { select: COMPANY_SELECT } },
    });
  }

  /** Impede deixar o sistema sem nenhum administrador ativo. */
  private async assertNotLastAdmin(id: string) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (target?.role !== 'ADMIN' || !target.active) return;
    const others = await this.prisma.user.count({
      where: { role: 'ADMIN', active: true, id: { not: id } },
    });
    if (others === 0) {
      throw new BadRequestException('Deve existir pelo menos um administrador ativo');
    }
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    await this.findOne(id);
    const data: any = { ...updateUserDto };
    if (data.email) {
      data.email = data.email.trim().toLowerCase();
      const dup = await this.prisma.user.findFirst({ where: { email: data.email, id: { not: id } } });
      if (dup) throw new ConflictException('Email já cadastrado');
    }
    if (data.role !== undefined && data.role !== 'ADMIN') await this.assertNotLastAdmin(id);
    if (data.active === false) await this.assertNotLastAdmin(id);
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }
    const { password, refreshToken, ...rest } = await this.prisma.user.update({
      where: { id },
      data,
    });
    return rest;
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.assertNotLastAdmin(id);
    return this.prisma.user.update({
      where: { id },
      data: { active: false },
    });
  }
}
