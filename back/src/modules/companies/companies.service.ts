import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { CompanyUserDto, CreateCompanyDto, UpdateCompanyDto, UpdateCompanyUserDto } from './dto';

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

/**
 * Gestão das empresas (clínicas/petshops). Usa o cliente SEM filtro de empresa
 * (PrismaService.raw): só o SUPER_ADMIN chega aqui.
 */
@Injectable()
export class CompaniesService {
  private get db() {
    return PrismaService.raw;
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
    return this.db.company.create({
      data: { name: dto.name.trim(), slug: await this.uniqueSlug(dto.name), users: { create: users } },
      include: { users: { select: publicUser, orderBy: { createdAt: 'asc' } } },
    });
  }

  findAll() {
    return this.db.company.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { users: true, clients: true, pets: true, appointments: true } },
        users: { where: { role: 'ADMIN' }, select: { name: true, email: true, active: true }, orderBy: { createdAt: 'asc' } },
      },
    });
  }

  async findOne(id: string) {
    const c = await this.db.company.findUnique({
      where: { id },
      include: {
        _count: { select: { clients: true, pets: true, appointments: true } },
        users: { select: publicUser, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!c) throw new NotFoundException('Empresa não encontrada');
    return c;
  }

  async update(id: string, dto: UpdateCompanyDto) {
    await this.findOne(id);
    return this.db.company.update({
      where: { id },
      data: { ...(dto.name && { name: dto.name.trim() }), logo: dto.logo, active: dto.active },
    });
  }

  async addUser(companyId: string, dto: CompanyUserDto) {
    await this.findOne(companyId);
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
      data: { active: dto.active, ...(dto.password && { password: await bcrypt.hash(dto.password, 10) }) },
      select: publicUser,
    });
  }
}
