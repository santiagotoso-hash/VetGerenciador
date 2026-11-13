import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProductDto, UpdateProductDto } from './dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateProductDto) {
    return this.prisma.product.create({ data: dto });
  }

  findAll(search?: string, category?: string, active?: string) {
    const where: any = {};
    if (active !== undefined) where.active = active === 'true';
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search } },
      ];
    }
    return this.prisma.product.findMany({ where, orderBy: { name: 'asc' } });
  }

  async lowStock() {
    const products = await this.prisma.product.findMany({ where: { active: true } });
    return products.filter((p) => p.stock <= p.minStock);
  }

  async findOne(id: string) {
    const p = await this.prisma.product.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Produto não encontrado');
    return p;
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id);
    return this.prisma.product.update({ where: { id }, data: dto });
  }

  async adjustStock(id: string, quantity: number) {
    const p = await this.findOne(id);
    if (p.stock + quantity < 0) throw new BadRequestException('Estoque insuficiente');
    return this.prisma.product.update({ where: { id }, data: { stock: { increment: quantity } } });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.product.update({ where: { id }, data: { active: false } });
  }
}
