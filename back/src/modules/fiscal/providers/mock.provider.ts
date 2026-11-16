import { BadRequestException } from '@nestjs/common';
import { randomInt } from 'crypto';
import { EmitInput, EmitResult, FiscalProvider } from './fiscal-provider';

/**
 * Emissor de TESTE: "autoriza" a nota na hora, com número e chave inventados, sem falar com SEFAZ
 * nem prefeitura. Serve para validar telas e fluxo sem pagar provedor. NUNCA tem validade fiscal
 * e é recusado em produção.
 */
export class MockProvider implements FiscalProvider {
  readonly name = 'MOCK';
  readonly label = 'Teste (simula a emissão, sem validade fiscal)';
  readonly manual = false;

  async emit(input: EmitInput): Promise<EmitResult> {
    if (input.environment !== 'HOMOLOGACAO') {
      throw new BadRequestException('O emissor de teste só funciona em homologação.');
    }
    const digits = (n: number) => Array.from({ length: n }, () => randomInt(0, 10)).join('');
    const uf = '29'; // só aparência (BA)
    const model = input.type === 'NFE' ? '55' : input.type === 'NFCE' ? '65' : '99';
    return {
      status: 'AUTHORIZED',
      number: String(randomInt(1, 99999)),
      series: '1',
      accessKey: `${uf}${digits(8)}${digits(14)}${model}${digits(23)}`.slice(0, 44),
      protocol: digits(15),
      issuedAt: new Date(),
      externalId: `mock-${input.invoiceId}`,
    };
  }

  async cancel(_input?: unknown) {
    return { ok: true };
  }
}
