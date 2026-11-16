// Tipos e textos da nota fiscal (API em /fiscal).

export type InvoiceType = 'NFSE' | 'NFE' | 'NFCE';
export type InvoiceStatus = 'DRAFT' | 'PROCESSING' | 'AUTHORIZED' | 'REJECTED' | 'CANCELED';
export type TaxRegime = 'MEI' | 'SIMPLES' | 'PRESUMIDO' | 'REAL';

export interface Invoice {
  id: string;
  type: InvoiceType;
  status: InvoiceStatus;
  environment: string;
  provider: string;
  number?: string | null;
  series?: string | null;
  accessKey?: string | null;
  issuedAt?: string | null;
  amount: number;
  discount: number;
  recipientName?: string | null;
  pdfUrl?: string | null;
  xmlUrl?: string | null;
  errorMessage?: string | null;
  cancelReason?: string | null;
  saleId: string;
  items: { description: string; quantity: number; total: number }[];
  /** O que falta preencher antes de poder emitir. */
  issues: string[];
}

export interface FiscalSettings {
  cnpj: string | null;
  stateRegistration: string | null;
  municipalRegistration: string | null;
  taxRegime: TaxRegime | null;
  cityIbgeCode: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  fiscalEnabled: boolean;
  fiscalProvider: string;
  fiscalEnvironment: 'HOMOLOGACAO' | 'PRODUCAO';
  fiscalAutoEmit: boolean;
  providers: { name: string; label: string; manual: boolean }[];
}

export interface Readiness {
  enabled: boolean;
  ready: boolean;
  checks: { key: string; label: string; ok: boolean; hint: string; count?: number; total?: number }[];
}

export const invoiceTypeLabel: Record<InvoiceType, string> = {
  NFSE: 'NFS-e (serviços)',
  NFE: 'NF-e (produtos)',
  NFCE: 'NFC-e (produtos, consumidor)',
};

export const invoiceStatusLabel: Record<InvoiceStatus, string> = {
  DRAFT: 'Rascunho',
  PROCESSING: 'Processando',
  AUTHORIZED: 'Autorizada',
  REJECTED: 'Rejeitada',
  CANCELED: 'Cancelada',
};

export const invoiceStatusColor: Record<InvoiceStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  PROCESSING: 'bg-amber-100 text-amber-700',
  AUTHORIZED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  CANCELED: 'bg-gray-100 text-gray-400 line-through',
};

export const taxRegimeLabel: Record<TaxRegime, string> = {
  MEI: 'MEI',
  SIMPLES: 'Simples Nacional',
  PRESUMIDO: 'Lucro Presumido',
  REAL: 'Lucro Real',
};

export const providerLabel: Record<string, string> = {
  MANUAL: 'Manual (emito no portal e registro aqui)',
  MOCK: 'Teste (simula, sem validade fiscal)',
};

export const originOptions: [number, string][] = [
  [0, '0 – Nacional'],
  [1, '1 – Estrangeira (importação direta)'],
  [2, '2 – Estrangeira (mercado interno)'],
  [3, '3 – Nacional, importação 40% a 70%'],
  [4, '4 – Nacional, processos básicos'],
  [5, '5 – Nacional, importação até 40%'],
  [6, '6 – Estrangeira, sem similar (importação direta)'],
  [7, '7 – Estrangeira, sem similar (mercado interno)'],
  [8, '8 – Nacional, importação acima de 70%'],
];

/** Resultado da emissão automática devolvido ao finalizar uma venda. */
export interface SaleFiscalResult {
  results: { type: InvoiceType; status: InvoiceStatus; message?: string }[];
}

const shortType: Record<InvoiceType, string> = { NFSE: 'NFS-e', NFE: 'NF-e', NFCE: 'NFC-e' };

/** Linhas de aviso para mostrar na tela da venda. */
export function saleFiscalLines(f?: SaleFiscalResult | null): string[] {
  return (f?.results ?? []).map((r) => {
    const t = shortType[r.type];
    if (r.status === 'AUTHORIZED') return `🧾 ${t}: emitida`;
    if (r.status === 'PROCESSING') return `🧾 ${t}: em processamento`;
    if (r.status === 'REJECTED') return `⚠️ ${t}: rejeitada${r.message ? ` — ${r.message}` : ''}`;
    return `⚠️ ${t}: ficou como rascunho${r.message ? ` — ${r.message}` : ''} (Vendas → Histórico → 🧾 Nota)`;
  });
}
