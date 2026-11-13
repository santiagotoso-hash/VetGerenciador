import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSaleDto } from './dto';

const include = {
  client: true,
  user: { select: { id: true, name: true } },
  items: { include: { product: true, service: true } },
};

@Injectable()
export class SalesService {
  constructor(private prisma: PrismaService) {}

  /** Cria a venda, baixa o estoque e lança a receita no financeiro, tudo numa transação. */
  create(dto: CreateSaleDto, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      let subtotal = 0;
      const items: any[] = [];

      for (const item of dto.items) {
        if (!item.productId === !item.serviceId) {
          throw new BadRequestException('Cada item deve ter productId ou serviceId (apenas um)');
        }
        let unitPrice: number;
        if (item.productId) {
          const p = await tx.product.findUnique({ where: { id: item.productId } });
          if (!p) throw new NotFoundException('Produto não encontrado');
          if (p.stock < item.quantity) throw new BadRequestException(`Estoque insuficiente: ${p.name}`);
          await tx.product.update({ where: { id: p.id }, data: { stock: { decrement: item.quantity } } });
          unitPrice = p.price;
        } else {
          const s = await tx.service.findUnique({ where: { id: item.serviceId } });
          if (!s) throw new NotFoundException('Serviço não encontrado');
          unitPrice = s.price;
        }
        const discount = item.discount ?? 0;
        const total = unitPrice * item.quantity - discount;
        subtotal += total;
        items.push({
          productId: item.productId,
          serviceId: item.serviceId,
          quantity: item.quantity,
          unitPrice,
          discount,
          total,
        });
      }

      const discount = dto.discount ?? 0;
      const total = Math.max(subtotal - discount, 0);

      const sale = await tx.sale.create({
        data: {
          clientId: dto.clientId,
          userId,
          paymentMethod: dto.paymentMethod,
          discount,
          notes: dto.notes,
          total,
          items: { create: items },
        },
        include,
      });

      await tx.financialEntry.create({
        data: {
          type: 'INCOME',
          description: `Venda #${sale.id.slice(-6)}`,
          amount: total,
          date: sale.date,
          category: 'SALE',
          paymentMethod: dto.paymentMethod,
          paid: true,
        },
      });

      return sale;
    });
  }

  findAll(from?: string, to?: string, clientId?: string) {
    const where: any = {};
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
    }
    if (clientId) where.clientId = clientId;
    return this.prisma.sale.findMany({ where, include, orderBy: { date: 'desc' } });
  }

  async findOne(id: string) {
    const s = await this.prisma.sale.findUnique({ where: { id }, include });
    if (!s) throw new NotFoundException('Venda não encontrada');
    return s;
  }
}
