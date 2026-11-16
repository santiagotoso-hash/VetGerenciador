import { BadRequestException } from '@nestjs/common';
import { EmitInput, EmitResult, FiscalProvider } from './fiscal-provider';

/**
 * Emissão manual: a pessoa emite no portal gratuito (emissor da SEFAZ/prefeitura ou Emissor Nacional)
 * e registra aqui o número, a chave e o PDF. Não custa nada e já deixa tudo organizado no sistema.
 */
export class ManualProvider implements FiscalProvider {
  readonly name = 'MANUAL';
  readonly label = 'Manual (emito no portal e registro aqui)';
  readonly manual = true;

  async emit(_input: EmitInput): Promise<EmitResult> {
    throw new BadRequestException('Este emissor é manual: emita a nota no portal e use "Registrar nota emitida".');
  }

  async cancel(_input?: unknown) {
    // o cancelamento de verdade é feito pela pessoa no portal; aqui só se registra
    return { ok: true };
  }
}
