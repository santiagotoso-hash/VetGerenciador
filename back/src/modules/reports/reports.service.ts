import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async dashboard() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const [todayAppointments, pending, sales, products, upcoming] = await Promise.all([
      this.prisma.appointment.findMany({
        where: { date: { gte: start, lt: end }, status: { not: 'CANCELLED' } },
      }),
      this.prisma.appointment.count({
        where: { date: { gte: start }, status: { in: ['SCHEDULED', 'CONFIRMED'] } },
      }),
      this.prisma.sale.findMany({ where: { date: { gte: start, lt: end } } }),
      this.prisma.product.findMany({ where: { active: true } }),
      this.prisma.appointment.findMany({
        where: { date: { gte: new Date() }, status: { in: ['SCHEDULED', 'CONFIRMED'] } },
        include: { pet: { include: { client: true } }, service: true },
        orderBy: { date: 'asc' },
        take: 5,
      }),
    ]);

    return {
      appointmentsToday: todayAppointments.length,
      petsAttended: todayAppointments.filter((a) => a.status === 'COMPLETED').length,
      pendingAppointments: pending,
      revenueToday: sales.reduce((s, x) => s + x.total, 0),
      lowStockCount: products.filter((p) => p.stock <= p.minStock).length,
      upcomingAppointments: upcoming,
    };
  }

  private groupByDay<T>(rows: T[], dateOf: (r: T) => Date, valueOf: (r: T) => number) {
    const map = new Map<string, number>();
    for (const r of rows) {
      const k = dateOf(r).toISOString().slice(0, 10);
      map.set(k, (map.get(k) ?? 0) + valueOf(r));
    }
    return [...map].sort(([a], [b]) => a.localeCompare(b));
  }

  async revenueByDay(from: string, to: string) {
    const sales = await this.prisma.sale.findMany({
      where: { date: { gte: new Date(from), lte: new Date(to) } },
    });
    return this.groupByDay(sales, (s) => s.date, (s) => s.total).map(([date, amount]) => ({ date, amount }));
  }

  async appointmentsByDay(from: string, to: string) {
    const list = await this.prisma.appointment.findMany({
      where: { date: { gte: new Date(from), lte: new Date(to) } },
    });
    return this.groupByDay(list, (a) => a.date, () => 1).map(([date, count]) => ({ date, count }));
  }

  /** Produtos e serviços mais vendidos no período (top 5 de cada). */
  async topItems(from: string, to: string) {
    const items = await this.prisma.saleItem.findMany({
      where: { sale: { date: { gte: new Date(from), lte: new Date(to) } } },
      include: { product: true, service: true },
    });

    const agg = (pick: (i: (typeof items)[number]) => { id: string; name: string } | null) => {
      const map = new Map<string, { name: string; quantity: number; total: number }>();
      for (const i of items) {
        const ref = pick(i);
        if (!ref) continue;
        const cur = map.get(ref.id) ?? { name: ref.name, quantity: 0, total: 0 };
        cur.quantity += i.quantity;
        cur.total += i.total;
        map.set(ref.id, cur);
      }
      return [...map.values()].sort((a, b) => b.total - a.total).slice(0, 5);
    };

    return {
      products: agg((i) => (i.product ? { id: i.product.id, name: i.product.name } : null)),
      services: agg((i) => (i.service ? { id: i.service.id, name: i.service.name } : null)),
    };
  }

  async appointmentsByStatus(from: string, to: string) {
    const groups = await this.prisma.appointment.groupBy({
      by: ['status'],
      where: { date: { gte: new Date(from), lte: new Date(to) } },
      _count: { _all: true },
    });
    return groups.map((g) => ({ status: g.status, count: g._count._all }));
  }

  async speciesDistribution() {
    const groups = await this.prisma.pet.groupBy({
      by: ['species'],
      where: { active: true },
      _count: { _all: true },
    });
    return groups.map((g) => ({ species: g.species, count: g._count._all }));
  }
}
