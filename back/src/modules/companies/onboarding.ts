// Checklist de implantação de uma empresa (superadmin). A maior parte dos itens é calculada sozinha a partir
// dos dados reais; os que dependem de algo fora do sistema (contrato, treinamento, contador) são confirmados
// à mão e ficam em Company.onboardingChecks.

export const MANUAL_ITEMS: Record<string, { label: string; section: string; hint: string }> = {
  contractSigned: { label: 'Contrato ou aceite do cliente', section: 'cadastro', hint: 'Marque quando o cliente aceitar as condições.' },
  trainingDone: { label: 'Treinamento / apresentação do sistema feito', section: 'acesso', hint: 'Marque depois de mostrar o sistema à equipe.' },
  accountantValidated: { label: 'Contador do cliente validou regime e códigos fiscais', section: 'fiscal', hint: 'O contador confirma regime, NCM, CFOP, CST/CSOSN e ISS.' },
  homologationTested: { label: 'Teste de emissão em homologação concluído', section: 'fiscal', hint: 'Emita algumas notas de teste e confira.' },
};

export interface OnboardingItem {
  key: string;
  label: string;
  done: boolean;
  /** true = marcado pelo sistema; false = você confirma à mão. */
  auto: boolean;
  /** Item que não entra na porcentagem (ex.: pagamento durante o teste grátis). */
  optional?: boolean;
  hint?: string;
  /** Aba da página da empresa onde se resolve (para o link "Ir para"). */
  tab?: string;
}

export interface OnboardingSection {
  key: string;
  title: string;
  /** false = seção desligada (ex.: nota fiscal ainda não ativada): não entra na porcentagem. */
  active: boolean;
  note?: string;
  items: OnboardingItem[];
}

export interface OnboardingStats {
  clients: number;
  appointments: number;
  sales: number;
  admins: number;
  receptionists: number;
  adminLoggedIn: boolean;
  payments: number;
  productsTotal: number;
  productsMissingFiscal: number;
  servicesTotal: number;
  servicesMissingFiscal: number;
}

const digits = (s?: string | null) => (s ?? '').replace(/\D/g, '');
const has = (v: unknown) => typeof v === 'string' && v.trim() !== '';

export function buildOnboarding(c: any, st: OnboardingStats) {
  const checks: Record<string, boolean> = (c.onboardingChecks as Record<string, boolean>) ?? {};
  const manual = (key: string): OnboardingItem => ({
    key, label: MANUAL_ITEMS[key].label, hint: MANUAL_ITEMS[key].hint, done: !!checks[key], auto: false,
  });
  const realProvider = !['MANUAL', 'MOCK'].includes(c.fiscalProvider);

  const sections: OnboardingSection[] = [
    {
      key: 'cadastro', title: 'Cadastro da empresa', active: true,
      items: [
        { key: 'logo', label: 'Logomarca enviada', done: has(c.logo), auto: true, tab: 'empresa' },
        {
          key: 'companyData', label: 'Dados da empresa (CNPJ, contato e endereço)', auto: true, tab: 'empresa',
          done: digits(c.cnpj).length === 14 && (has(c.phone) || has(c.email)) && has(c.address) && has(c.city),
        },
        { key: 'owner', label: 'Proprietário informado (nome e contato)', done: has(c.ownerName) && (has(c.ownerEmail) || has(c.ownerPhone)), auto: true, tab: 'proprietario' },
        manual('contractSigned'),
      ],
    },
    {
      key: 'acesso', title: 'Acesso da equipe', active: true,
      items: [
        { key: 'admin', label: 'Administrador criado', done: st.admins > 0, auto: true, tab: 'usuarios' },
        { key: 'receptionist', label: 'Atendente criado', done: st.receptionists > 0, auto: true, tab: 'usuarios' },
        { key: 'adminLogin', label: 'Administrador já entrou no sistema', done: st.adminLoggedIn, auto: true, hint: 'Se não entrou, confira se recebeu o e-mail e a senha.' },
        manual('trainingDone'),
      ],
    },
    {
      key: 'cobranca', title: 'Cobrança', active: true,
      items: [
        { key: 'fee', label: 'Mensalidade definida', done: (c.monthlyFeeCents ?? 0) > 0, auto: true, tab: 'pagamentos' },
        { key: 'plan', label: 'Teste grátis ou início da cobrança definido', done: !!(c.trialEndsAt || c.billingStartDate || c.paidUntil), auto: true, tab: 'pagamentos', hint: 'Sem isso a empresa fica "sem cobrança" e nunca é bloqueada.' },
        { key: 'billingEmail', label: 'E-mail do financeiro para a cobrança automática', done: has(c.billingEmail) && !!c.billingDay, auto: true, tab: 'pagamentos' },
        { key: 'payment', label: 'Primeiro pagamento registrado', done: st.payments > 0, auto: true, optional: true, tab: 'pagamentos', hint: 'Depois do teste grátis.' },
      ],
    },
    {
      key: 'uso', title: 'Primeiros usos', active: true,
      items: [
        { key: 'firstClient', label: 'Primeiro cliente cadastrado', done: st.clients > 0, auto: true },
        { key: 'firstAppointment', label: 'Primeiro agendamento criado', done: st.appointments > 0, auto: true },
        { key: 'firstSale', label: 'Primeira venda registrada', done: st.sales > 0, auto: true },
      ],
    },
  ];

  const fiscal: OnboardingSection = {
    key: 'fiscal', title: 'Nota fiscal', active: !!c.fiscalEnabled, items: [],
    note: c.fiscalEnabled ? undefined : 'Recurso opcional. Ative em "Dados da empresa → Nota fiscal" quando o cliente contratar.',
  };
  if (c.fiscalEnabled) {
    fiscal.items = [
      {
        key: 'fiscalData', label: 'Dados fiscais da empresa (CNPJ, regime, endereço, IBGE)', auto: true,
        done: digits(c.cnpj).length === 14 && !!c.taxRegime && has(c.address) && has(c.city) && has(c.state) && has(c.zipCode) && digits(c.cityIbgeCode).length === 7,
        hint: 'O cliente preenche em Configurações → Fiscal.',
      },
      { key: 'registrations', label: 'Inscrição estadual ou municipal informada', done: has(c.stateRegistration) || has(c.municipalRegistration), auto: true, hint: 'Estadual para produtos, municipal para serviços.' },
      { key: 'productsFiscal', label: 'Produtos com dados fiscais', done: st.productsMissingFiscal === 0, auto: true, hint: st.productsMissingFiscal ? `${st.productsMissingFiscal} de ${st.productsTotal} sem NCM/CFOP/CST/origem.` : undefined },
      { key: 'servicesFiscal', label: 'Serviços com dados fiscais', done: st.servicesMissingFiscal === 0, auto: true, hint: st.servicesMissingFiscal ? `${st.servicesMissingFiscal} de ${st.servicesTotal} sem código do serviço/ISS.` : undefined },
      manual('accountantValidated'),
    ];
    if (realProvider) {
      fiscal.items.push(
        { key: 'certificate', label: 'Certificado digital A1 guardado', done: !!c.fiscalCertificate, auto: true, tab: 'empresa' },
        { key: 'csc', label: 'CSC da NFC-e guardado', done: !!c.fiscalCscToken && !!c.fiscalCscId, auto: true, optional: true, tab: 'empresa', hint: 'Só para nota de produto ao consumidor.' },
      );
    }
    fiscal.items.push(manual('homologationTested'), {
      key: 'production', label: 'Em produção (valor fiscal)', done: c.fiscalEnvironment === 'PRODUCAO', auto: true, tab: 'empresa',
      hint: 'Mude para Produção só depois do teste em homologação.',
    });
  }
  sections.push(fiscal);

  const counted = sections.filter((s) => s.active).flatMap((s) => s.items).filter((i) => !i.optional);
  const done = counted.filter((i) => i.done).length;
  return {
    sections,
    progress: { done, total: counted.length, percent: counted.length ? Math.round((done / counted.length) * 100) : 0 },
  };
}
