import { ForbiddenException, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { tenantStorage } from '../common/tenant';

/** Modelos que pertencem a uma empresa e são isolados automaticamente por companyId. */
const TENANT_MODELS = new Set([
  'User',
  'Client',
  'Pet',
  'Service',
  'Appointment',
  'MedicalRecord',
  'Product',
  'Sale',
  'FinancialEntry',
  'Invoice',
]);

const WHERE_OPS = new Set([
  'findMany', 'findFirst', 'findFirstOrThrow', 'findUnique', 'findUniqueOrThrow',
  'count', 'aggregate', 'groupBy', 'update', 'updateMany', 'delete', 'deleteMany',
]);

/**
 * Cliente do banco com isolamento por empresa: dentro de uma requisição, qualquer
 * leitura/alteração dos modelos acima só enxerga registros da empresa do usuário, e
 * todo registro novo recebe o companyId dele. Assim nenhuma consulta esquecida vaza
 * dados entre clínicas.
 *
 * `PrismaService.raw` é o cliente sem filtro (uso exclusivo do módulo de superadmin).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  static raw: PrismaClient;

  constructor() {
    super();
    const base = this as PrismaClient;
    PrismaService.raw = base;

    const extended = base.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }: any) {
            const store = tenantStorage.getStore();
            if (!store || !TENANT_MODELS.has(model)) return query(args);
            const companyId = store.companyId;
            if (!companyId) {
              throw new ForbiddenException('Superadmin não acessa os dados das empresas');
            }
            const a: any = args ?? {};
            if (WHERE_OPS.has(operation)) {
              a.where = { ...(a.where ?? {}), companyId };
            } else if (operation === 'create') {
              a.data = { ...a.data, companyId };
            } else if (operation === 'createMany') {
              const rows = Array.isArray(a.data) ? a.data : [a.data];
              a.data = rows.map((r: any) => ({ ...r, companyId }));
            } else if (operation === 'upsert') {
              a.where = { ...(a.where ?? {}), companyId };
              a.create = { ...a.create, companyId };
            }
            return query(a);
          },
        },
      },
    });

    try {
      (extended as any).onModuleInit = () => base.$connect();
    } catch {
      /* o Prisma conecta sozinho na primeira consulta */
    }
    return extended as unknown as this;
  }

  async onModuleInit() {
    await this.$connect();
  }
}
