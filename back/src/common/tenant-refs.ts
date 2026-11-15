import { NotFoundException } from '@nestjs/common';

/**
 * Garante que os ids referenciados existem na empresa atual (o PrismaService já
 * filtra por empresa, então um id de outra clínica aparece como inexistente).
 */
export async function assertExists(lookup: Promise<unknown>, label: string) {
  if (!(await lookup)) throw new NotFoundException(`${label} não encontrado`);
}
