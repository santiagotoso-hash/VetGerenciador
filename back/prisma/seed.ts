import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hash = (p: string) => bcrypt.hashSync(p, 10);

  await prisma.user.upsert({
    where: { email: 'admin@vetpet.com' },
    update: {},
    create: { name: 'Administrador', email: 'admin@vetpet.com', password: hash('admin123'), role: 'ADMIN' },
  });
  await prisma.user.upsert({
    where: { email: 'vet@vetpet.com' },
    update: {},
    create: { name: 'Dra. Ana Souza', email: 'vet@vetpet.com', password: hash('vet12345'), role: 'VETERINARIAN' },
  });

  const services = [
    { name: 'Consulta geral', category: 'Clínica', price: 120, duration: 30 },
    { name: 'Vacina V10', category: 'Vacinação', price: 90, duration: 15 },
    { name: 'Banho', category: 'Estética', price: 60, duration: 45 },
    { name: 'Tosa', category: 'Estética', price: 80, duration: 60 },
  ];
  for (const s of services) {
    const exists = await prisma.service.findFirst({ where: { name: s.name } });
    if (!exists) await prisma.service.create({ data: s });
  }

  const products = [
    { name: 'Ração Premium 15kg', category: 'FOOD', price: 189.9, costPrice: 130, stock: 20, minStock: 5, sku: 'RAC-15' },
    { name: 'Antipulgas', category: 'MEDICINE', price: 74.5, costPrice: 45, stock: 3, minStock: 5, sku: 'ANT-01' },
    { name: 'Shampoo Neutro', category: 'HYGIENE', price: 32, costPrice: 18, stock: 15, minStock: 5, sku: 'SHA-01' },
  ];
  for (const p of products) {
    await prisma.product.upsert({ where: { sku: p.sku }, update: {}, create: p });
  }

  console.log('Seed concluído. Login: admin@vetpet.com / admin123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
