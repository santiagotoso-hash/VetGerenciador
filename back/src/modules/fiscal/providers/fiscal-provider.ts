/**
 * Camada de emissão de nota fiscal. O resto do sistema só fala com esta interface; quem de fato
 * emite é um "driver". Hoje existem dois, ambos gratuitos:
 *
 *  - MANUAL: a nota é emitida pela pessoa no portal gratuito (SEFAZ/prefeitura) e depois registrada aqui.
 *  - MOCK:   simula a autorização (sem validade fiscal), para testar o fluxo inteiro em homologação.
 *
 * Para contratar um provedor (Focus NFe, Nuvem Fiscal, PlugNotas…) ou integrar direto com a SEFAZ,
 * basta criar uma classe que implemente `FiscalProvider`, registrá-la em `FiscalService.providers`
 * e escolher o nome dela em "Emissor" no cadastro da empresa. Nada mais no sistema muda.
 */

export type InvoiceKind = 'NFSE' | 'NFE' | 'NFCE';

export interface EmitCompany {
  id: string;
  name: string;
  cnpj: string | null;
  stateRegistration: string | null;
  municipalRegistration: string | null;
  taxRegime: string | null;
  cityIbgeCode: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
}

/** Credenciais fiscais da empresa, já decifradas (só existem na memória, durante a chamada). */
export interface FiscalCredentials {
  /** Conteúdo do certificado A1 (.pfx). */
  certificatePfx: Buffer | null;
  certificatePassword: string | null;
  cscId: string | null;
  csc: string | null;
}

export interface EmitInput {
  invoiceId: string;
  type: InvoiceKind;
  environment: 'HOMOLOGACAO' | 'PRODUCAO';
  company: EmitCompany;
  credentials: FiscalCredentials;
  recipient: { name: string | null; document: string | null };
  amount: number;
  discount: number;
  /** Itens congelados no momento da venda (produto: ncm/cfop/…; serviço: código do serviço/ISS/…). */
  items: any[];
}

export interface EmitResult {
  /** AUTHORIZED = pronta; PROCESSING = o provedor avisa depois (webhook); REJECTED = recusada. */
  status: 'AUTHORIZED' | 'PROCESSING' | 'REJECTED';
  number?: string;
  series?: string;
  accessKey?: string;
  protocol?: string;
  issuedAt?: Date;
  pdfUrl?: string;
  xmlUrl?: string;
  externalId?: string;
  errorMessage?: string;
}

export interface FiscalProvider {
  readonly name: string;
  readonly label: string;
  /** true = a emissão é feita fora do sistema e só registrada aqui (não há botão "Emitir"). */
  readonly manual: boolean;
  emit(input: EmitInput): Promise<EmitResult>;
  cancel(input: {
    invoice: { id: string; accessKey: string | null; externalId: string | null; environment: string };
    company: EmitCompany;
    credentials: FiscalCredentials;
    reason: string;
  }): Promise<{ ok: boolean; errorMessage?: string }>;
}
