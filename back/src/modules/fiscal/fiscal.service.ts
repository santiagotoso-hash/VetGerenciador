import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { currentCompanyId } from '../../common/tenant';
import { PrismaService } from '../../prisma/prisma.service';
import { CancelInvoiceDto, PrepareInvoicesDto, RegisterInvoiceDto, UpdateFiscalSettingsDto } from './dto';
import { decryptSecret } from '../../common/secret-box';
import { EmitCompany, FiscalCredentials, FiscalProvider } from './providers/fiscal-provider';
import { ManualProvider } from './providers/manual.provider';
import { MockProvider } from './providers/mock.provider';

const digits = (s?: string | null) => (s ?? '').replace(/\D/g, '');
const blank = (v: unknown) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

const COMPANY_TEXT = ['cnpj', 'stateRegistration', 'municipalRegistration', 'cityIbgeCode', 'address', 'city', 'state', 'zipCode'] as const;

@Injectable()
export class FiscalService {
  /** Emissores disponíveis. Para um provedor novo (Focus, Nuvem Fiscal, SEFAZ direta…), registre aqui. */
  private readonly providers: Record<string, FiscalProvider> = {
    MANUAL: new ManualProvider(),
    MOCK: new MockProvider(),
  };

  constructor(private prisma: PrismaService) {}

  private get db() {
    return PrismaService.raw;
  }

  private provider(name: string) {
    const p = this.providers[name];
    if (!p) throw new BadRequestException(`Emissor fiscal "${name}" não disponível`);
    return p;
  }

  /** Decifra as credenciais da empresa só na hora de emitir; o driver recebe e descarta. */
  private credentials(c: any): FiscalCredentials {
    // manual e teste não usam credenciais: nem tenta decifrar
    if (['MANUAL', 'MOCK'].includes(c.fiscalProvider)) return { certificatePfx: null, certificatePassword: null, cscId: null, csc: null };
    return {
      certificatePfx: c.fiscalCertificate ? decryptSecret(c.fiscalCertificate) : null,
      certificatePassword: c.fiscalCertificatePassword ? decryptSecret(c.fiscalCertificatePassword).toString('utf8') : null,
      cscId: c.fiscalCscId ?? null,
      csc: c.fiscalCscToken ? decryptSecret(c.fiscalCscToken).toString('utf8') : null,
    };
  }

  private async company() {
    const c = await this.db.company.findUnique({ where: { id: currentCompanyId() } });
    if (!c) throw new NotFoundException('Empresa não encontrada');
    return c;
  }

  private async enabledCompany() {
    const c = await this.company();
    if (!c.fiscalEnabled) throw new BadRequestException('A nota fiscal não está ativada para esta empresa. Fale com o suporte.');
    return c;
  }

  // ---------- configuração ----------

  async getSettings() {
    const c = await this.company();
    return {
      cnpj: c.cnpj, stateRegistration: c.stateRegistration, municipalRegistration: c.municipalRegistration,
      taxRegime: c.taxRegime, cityIbgeCode: c.cityIbgeCode,
      address: c.address, city: c.city, state: c.state, zipCode: c.zipCode,
      fiscalEnabled: c.fiscalEnabled, fiscalProvider: c.fiscalProvider, fiscalEnvironment: c.fiscalEnvironment,
      fiscalAutoEmit: c.fiscalAutoEmit,
      providers: Object.values(this.providers).map((p) => ({ name: p.name, label: p.label, manual: p.manual })),
    };
  }

  async updateSettings(dto: UpdateFiscalSettingsDto) {
    const data: Record<string, unknown> = {};
    for (const k of COMPANY_TEXT) if (dto[k] !== undefined) data[k] = dto[k].trim() || null;
    if (typeof data.state === 'string') data.state = data.state.toUpperCase();
    if (dto.taxRegime !== undefined) data.taxRegime = dto.taxRegime;
    if (dto.fiscalAutoEmit !== undefined) data.fiscalAutoEmit = dto.fiscalAutoEmit;
    await this.db.company.update({ where: { id: currentCompanyId() }, data });
    return this.getSettings();
  }

  /** Lista do que falta para emitir notas: dados da empresa e cadastro fiscal de produtos e serviços. */
  async readiness() {
    const c = await this.company();
    const id = c.id;
    const [products, services, productsTotal, servicesTotal] = await Promise.all([
      this.db.product.count({ where: { companyId: id, active: true, OR: [{ ncm: null }, { cfop: null }, { taxCode: null }, { origin: null }] } }),
      this.db.service.count({ where: { companyId: id, active: true, OR: [{ serviceCode: null }, { issRate: null }] } }),
      this.db.product.count({ where: { companyId: id, active: true } }),
      this.db.service.count({ where: { companyId: id, active: true } }),
    ]);
    const checks = [
      { key: 'cnpj', label: 'CNPJ da empresa', ok: digits(c.cnpj).length === 14, hint: 'Informe o CNPJ (14 dígitos).' },
      { key: 'taxRegime', label: 'Regime tributário', ok: !!c.taxRegime, hint: 'MEI, Simples Nacional, Lucro Presumido ou Real. Confirme com o contador.' },
      { key: 'address', label: 'Endereço fiscal completo', ok: !blank(c.address) && !blank(c.city) && !blank(c.state) && !blank(c.zipCode), hint: 'Endereço, cidade, UF e CEP.' },
      { key: 'cityIbgeCode', label: 'Código IBGE do município', ok: digits(c.cityIbgeCode).length === 7, hint: 'Necessário para nota de serviço. Salvador: 2927408.' },
      { key: 'stateRegistration', label: 'Inscrição estadual', ok: !blank(c.stateRegistration), hint: 'Necessária para nota de produto (NFC-e/NF-e). MEI e prestador de serviço podem não ter.' },
      { key: 'municipalRegistration', label: 'Inscrição municipal', ok: !blank(c.municipalRegistration), hint: 'Necessária para nota de serviço (NFS-e).' },
      { key: 'products', label: 'Produtos com dados fiscais', ok: products === 0, count: products, total: productsTotal, hint: 'NCM, CFOP, CST/CSOSN e origem em cada produto (Estoque → Editar).' },
      { key: 'services', label: 'Serviços com dados fiscais', ok: services === 0, count: services, total: servicesTotal, hint: 'Código do serviço e alíquota de ISS em cada serviço (Configurações → Serviços).' },
    ];
    // emissor real (não manual/teste) precisa do certificado A1; o CSC é para NFC-e
    if (!['MANUAL', 'MOCK'].includes(c.fiscalProvider)) {
      const expiring = c.fiscalCertificateExpiresAt && c.fiscalCertificateExpiresAt.getTime() < Date.now() + 30 * 86_400_000;
      checks.push(
        { key: 'certificate', label: 'Certificado digital A1', ok: !!c.fiscalCertificate && !expiring, hint: expiring ? 'O certificado vence em menos de 30 dias ou já venceu. Envie um novo.' : 'Peça ao suporte para cadastrar o certificado A1 da empresa.' },
        { key: 'csc', label: 'CSC (para NFC-e)', ok: !!c.fiscalCscToken && !!c.fiscalCscId, hint: 'Código gerado no portal da SEFAZ. Necessário só para nota de produto ao consumidor.' },
      );
    }
    return {
      enabled: c.fiscalEnabled,
      provider: c.fiscalProvider,
      environment: c.fiscalEnvironment,
      ready: checks.every((x) => x.ok || ['stateRegistration', 'municipalRegistration', 'csc'].includes(x.key)),
      checks,
    };
  }

  // ---------- notas ----------

  /** Pendências de uma nota: o que falta (empresa ou item) antes de poder emitir. */
  private issues(inv: { type: string; items: any }, c: EmitCompany): string[] {
    const out: string[] = [];
    if (digits(c.cnpj).length !== 14) out.push('CNPJ da empresa não informado');
    if (!c.taxRegime) out.push('Regime tributário da empresa não informado');
    if (blank(c.address) || blank(c.city) || blank(c.state) || blank(c.zipCode)) out.push('Endereço fiscal da empresa incompleto');
    const items = (inv.items as any[]) ?? [];
    if (inv.type === 'NFSE') {
      if (digits(c.cityIbgeCode).length !== 7) out.push('Código IBGE do município não informado');
      if (blank(c.municipalRegistration)) out.push('Inscrição municipal da empresa não informada');
      for (const i of items) {
        if (blank(i.serviceCode)) out.push(`Serviço "${i.description}": falta o código do serviço`);
        if (i.issRate === null || i.issRate === undefined) out.push(`Serviço "${i.description}": falta a alíquota de ISS`);
      }
    } else {
      if (blank(c.stateRegistration)) out.push('Inscrição estadual da empresa não informada');
      for (const i of items) {
        const miss = ['ncm', 'cfop', 'taxCode'].filter((k) => blank(i[k]));
        if (i.origin === null || i.origin === undefined) miss.push('origem');
        if (miss.length) out.push(`Produto "${i.description}": falta ${miss.join(', ')}`);
      }
    }
    return [...new Set(out)];
  }

  private view(inv: any, company: any) {
    return { ...inv, issues: ['DRAFT', 'REJECTED'].includes(inv.status) ? this.issues(inv, company) : [] };
  }

  async list(saleId?: string) {
    const c = await this.company();
    const list = await this.prisma.invoice.findMany({
      where: saleId ? { saleId } : {},
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return list.map((i) => this.view(i, c));
  }

  private async getInvoice(id: string) {
    const inv = await this.prisma.invoice.findUnique({ where: { id } });
    if (!inv) throw new NotFoundException('Nota não encontrada');
    return inv;
  }

  async get(id: string) {
    return this.view(await this.getInvoice(id), await this.company());
  }

  /** Cria os rascunhos de nota de uma venda: produtos em NFC-e/NF-e e serviços em NFS-e. Não duplica. */
  async prepareFromSale(saleId: string, dto: PrepareInvoicesDto) {
    const company = await this.enabledCompany();
    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: { items: { include: { product: true, service: true } }, client: true },
    });
    if (!sale) throw new NotFoundException('Venda não encontrada');

    const existing = await this.prisma.invoice.findMany({ where: { saleId, status: { not: 'CANCELED' } } });
    if (existing.length) return existing.map((i) => this.view(i, company));

    const groups = this.groups(sale);
    const env = company.fiscalEnvironment;
    const base = {
      saleId,
      environment: env,
      provider: company.fiscalProvider,
      recipientName: sale.client?.name ?? null,
      recipientDocument: digits(sale.client?.cpf) || null,
    };
    const created: any[] = [];
    if (groups.products) {
      created.push(await this.prisma.invoice.create({ data: { ...base, type: dto.productType ?? 'NFCE', ...groups.products, companyId: company.id } }));
    }
    if (groups.services) {
      created.push(await this.prisma.invoice.create({ data: { ...base, type: 'NFSE', ...groups.services, companyId: company.id } }));
    }
    return created.map((i) => this.view(i, company));
  }

  /** Separa os itens da venda em produtos e serviços, com o desconto da venda dividido proporcionalmente. */
  private groups(sale: any) {
    const subtotal = sale.items.reduce((s: number, i: any) => s + i.total, 0) || 1;
    const build = (list: any[], mapper: (i: any) => object) => {
      if (!list.length) return null;
      const groupTotal = list.reduce((s, i) => s + i.total, 0);
      const discount = Math.round(sale.discount * (groupTotal / subtotal) * 100) / 100;
      return { amount: Math.max(Math.round((groupTotal - discount) * 100) / 100, 0), discount, items: list.map(mapper) };
    };
    return {
      products: build(sale.items.filter((i: any) => i.product), (i) => ({
        description: i.product.name, quantity: i.quantity, unitPrice: i.unitPrice, total: i.total,
        unit: i.product.unit, ncm: i.product.ncm, cfop: i.product.cfop, taxCode: i.product.taxCode, origin: i.product.origin,
      })),
      services: build(sale.items.filter((i: any) => i.service), (i) => ({
        description: i.service.name, quantity: i.quantity, unitPrice: i.unitPrice, total: i.total,
        serviceCode: i.service.serviceCode, nbs: i.service.nbs, issRate: i.service.issRate, cnae: i.service.cnae,
      })),
    };
  }

  private async refreshRaw(inv: any) {
    const sale = await this.prisma.sale.findUnique({ where: { id: inv.saleId }, include: { items: { include: { product: true, service: true } } } });
    const g = sale && this.groups(sale)[inv.type === 'NFSE' ? 'services' : 'products'];
    if (!g) return inv;
    return this.prisma.invoice.update({ where: { id: inv.id }, data: { items: g.items as any, amount: g.amount, discount: g.discount } });
  }

  /** Atualiza o rascunho com os dados fiscais atuais dos produtos e serviços (útil depois de preencher o cadastro). */
  async refresh(id: string) {
    const company = await this.enabledCompany();
    const inv = await this.getInvoice(id);
    if (!['DRAFT', 'REJECTED'].includes(inv.status)) return this.view(inv, company);
    const sale = await this.prisma.sale.findUnique({ where: { id: inv.saleId }, include: { items: { include: { product: true, service: true } } } });
    if (!sale) return this.view(inv, company);
    const g = this.groups(sale)[inv.type === 'NFSE' ? 'services' : 'products'];
    if (!g) return this.view(inv, company);
    const updated = await this.prisma.invoice.update({ where: { id }, data: { items: g.items as any, amount: g.amount, discount: g.discount } });
    return this.view(updated, company);
  }

  /**
   * Chamado ao finalizar uma venda, se a empresa ligou "Emitir nota ao finalizar a venda".
   * NUNCA derruba a venda: o que não puder ser emitido (dado fiscal faltando, emissor manual, erro do emissor)
   * fica como rascunho, e o resultado de cada nota volta para a tela avisar.
   */
  async autoEmitForSale(saleId: string) {
    const company = await this.company();
    if (!company.fiscalEnabled || !company.fiscalAutoEmit) return null;
    const provider = this.providers[company.fiscalProvider];
    const results: { type: string; status: string; message?: string }[] = [];
    const invoices = await this.prepareFromSale(saleId, {});
    for (const inv of invoices) {
      if (inv.status !== 'DRAFT') {
        results.push({ type: inv.type, status: inv.status });
      } else if (inv.issues.length) {
        results.push({ type: inv.type, status: 'DRAFT', message: `falta completar: ${inv.issues.join('; ')}` });
      } else if (!provider || provider.manual) {
        results.push({ type: inv.type, status: 'DRAFT', message: 'emissor manual: emita no portal e registre a nota' });
      } else {
        try {
          const done = await this.emit(inv.id);
          results.push({ type: inv.type, status: done.status, message: done.errorMessage ?? undefined });
        } catch (e) {
          results.push({ type: inv.type, status: 'DRAFT', message: String((e as Error).message).split('\n')[0].slice(0, 200) });
        }
      }
    }
    return { results };
  }

  /** Emite pelo driver automático (teste, provedor ou SEFAZ direta). */
  async emit(id: string) {
    const company = await this.enabledCompany();
    let inv = await this.getInvoice(id);
    if (!['DRAFT', 'REJECTED'].includes(inv.status)) throw new BadRequestException('Só é possível emitir uma nota em rascunho ou rejeitada');
    inv = await this.refreshRaw(inv);
    const issues = this.issues(inv, company);
    if (issues.length) throw new BadRequestException(`Complete os dados fiscais antes de emitir:\n- ${issues.join('\n- ')}`);

    const provider = this.provider(company.fiscalProvider);
    if (provider.manual) throw new BadRequestException('Este emissor é manual: emita a nota no portal e use "Registrar nota emitida".');

    await this.prisma.invoice.update({
      where: { id },
      data: { status: 'PROCESSING', provider: provider.name, environment: company.fiscalEnvironment, errorMessage: null },
    });
    try {
      const r = await provider.emit({
        invoiceId: id,
        type: inv.type,
        environment: company.fiscalEnvironment as 'HOMOLOGACAO' | 'PRODUCAO',
        company: company as EmitCompany,
        credentials: this.credentials(company),
        recipient: { name: inv.recipientName, document: inv.recipientDocument },
        amount: inv.amount,
        discount: inv.discount,
        items: inv.items as any[],
      });
      const updated = await this.prisma.invoice.update({
        where: { id },
        data: {
          status: r.status, number: r.number, series: r.series, accessKey: r.accessKey, protocol: r.protocol,
          issuedAt: r.issuedAt, pdfUrl: r.pdfUrl, xmlUrl: r.xmlUrl, externalId: r.externalId, errorMessage: r.errorMessage ?? null,
        },
      });
      return this.view(updated, company);
    } catch (e) {
      // erro de uso (ex.: teste em produção) volta ao estado anterior; qualquer outro vira "rejeitada" com o motivo
      const known = e instanceof BadRequestException;
      await this.prisma.invoice.update({
        where: { id },
        data: { status: known ? inv.status : 'REJECTED', errorMessage: known ? null : String((e as Error).message).slice(0, 500) },
      });
      throw e;
    }
  }

  /** Registra uma nota emitida fora do sistema (portal gratuito da SEFAZ/prefeitura). */
  async register(id: string, dto: RegisterInvoiceDto) {
    const company = await this.enabledCompany();
    const inv = await this.getInvoice(id);
    if (!['DRAFT', 'REJECTED'].includes(inv.status)) throw new BadRequestException('Esta nota já foi emitida ou cancelada');
    const issuedAt = dto.issuedAt ? new Date(dto.issuedAt) : new Date();
    if (isNaN(issuedAt.getTime())) throw new BadRequestException('Data de emissão inválida');
    const updated = await this.prisma.invoice.update({
      where: { id },
      data: {
        status: 'AUTHORIZED', provider: 'MANUAL', environment: company.fiscalEnvironment,
        number: dto.number.trim(), series: dto.series?.trim() || null, accessKey: dto.accessKey || null,
        issuedAt, pdfUrl: dto.pdfUrl || null, xmlUrl: dto.xmlUrl || null, errorMessage: null,
      },
    });
    return this.view(updated, company);
  }

  async cancel(id: string, dto: CancelInvoiceDto) {
    const company = await this.enabledCompany();
    const inv = await this.getInvoice(id);
    if (inv.status !== 'AUTHORIZED') throw new BadRequestException('Só é possível cancelar uma nota autorizada');
    const r = await this.provider(inv.provider).cancel({
      invoice: { id: inv.id, accessKey: inv.accessKey, externalId: inv.externalId, environment: inv.environment },
      company: company as EmitCompany,
      credentials: this.credentials(company),
      reason: dto.reason.trim(),
    });
    if (!r.ok) throw new BadRequestException(r.errorMessage ?? 'Não foi possível cancelar a nota');
    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { status: 'CANCELED', cancelReason: dto.reason.trim(), canceledAt: new Date() },
    });
    return this.view(updated, company);
  }
}
