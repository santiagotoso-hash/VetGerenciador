import { AsyncLocalStorage } from 'async_hooks';
import { CallHandler, ExecutionContext, ForbiddenException, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';

/**
 * Contexto da empresa (tenant) da requisição atual.
 * - sem contexto: tarefas internas (login, e-mails automáticos, scripts) — sem filtro de empresa;
 * - companyId preenchido: toda consulta aos dados da clínica é filtrada por essa empresa;
 * - companyId null (superadmin): não pode tocar nos dados de nenhuma clínica.
 */
export interface TenantStore {
  companyId: string | null;
}

export const tenantStorage = new AsyncLocalStorage<TenantStore>();

/** Id da empresa da requisição atual (falha se não houver, ex.: superadmin). */
export function currentCompanyId(): string {
  const id = tenantStorage.getStore()?.companyId;
  if (!id) throw new ForbiddenException('Operação disponível apenas dentro de uma empresa');
  return id;
}

/** Roda cada requisição autenticada dentro do contexto da empresa do usuário. */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const user = context.switchToHttp().getRequest()?.user;
    if (!user) return next.handle();
    const store: TenantStore = { companyId: user.companyId ?? null };
    return new Observable((subscriber) => tenantStorage.run(store, () => next.handle().subscribe(subscriber)));
  }
}
