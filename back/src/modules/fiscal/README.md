# Nota fiscal: como ligar um provedor (ou a SEFAZ)

O sistema nunca fala direto com um provedor: ele usa a interface `FiscalProvider`
([providers/fiscal-provider.ts](providers/fiscal-provider.ts)). Hoje existem dois drivers gratuitos:

| Driver | Para quê |
|---|---|
| `MANUAL` | a pessoa emite no portal gratuito (SEFAZ/prefeitura) e registra a nota no sistema |
| `MOCK` | simula a autorização, sem validade fiscal, só em homologação (para testar o fluxo) |

## Passo a passo quando contratar um provedor

1. **Conta no provedor** (Focus NFe, Nuvem Fiscal, PlugNotas…): pegue o token de **homologação**.
2. **Variáveis no servidor (Vercel)** — são suas, valem para todos os clientes. Os nomes dependem do provedor, ex.:
   ```
   FOCUSNFE_TOKEN=...            # token da SUA conta
   FOCUSNFE_URL=https://homologacao.focusnfe.com.br
   FISCAL_ENCRYPTION_KEY=...     # 64 hex; protege certificado e CSC no banco (veja abaixo)
   ```
3. **Driver novo**: crie `providers/focus-nfe.provider.ts` implementando `FiscalProvider`:
   - `emit(input)` monta o JSON do provedor com `input.company` (CNPJ, inscrições, endereço), `input.items`
     (NCM/CFOP/CST… ou código do serviço/ISS…), `input.recipient` e `input.credentials`
     (certificado A1 já decifrado + CSC) e devolve `{ status, number, accessKey, pdfUrl, xmlUrl… }`.
     Se o provedor responde "processando", devolva `status: 'PROCESSING'` e atualize depois por webhook.
   - `cancel(input)` cancela a nota autorizada.
4. **Registre o driver** em `FiscalService.providers` ([fiscal.service.ts](fiscal.service.ts)) com um nome, ex. `FOCUS`.
5. **Libere o nome** em `UpdateCompanyDto.fiscalProvider` (`@IsIn([...])` em [../companies/dto.ts](../companies/dto.ts))
   e no mapa `providerLabel` do front (`front/src/lib/fiscal.ts`). Ele passa a aparecer em *Emissor*
   no cartão "Nota fiscal" da página da empresa (Superadmin).
6. **Webhook** (se o provedor avisa por chamada de volta): crie uma rota pública que valide o segredo do
   provedor e atualize `Invoice.status/number/accessKey/pdfUrl/xmlUrl` pelo `externalId`.
7. Teste tudo em **homologação**; só depois mude o ambiente da empresa para Produção.

## Credenciais de cada empresa (certificado A1 e CSC)

- Cadastradas pelo **superadmin**, na página da empresa → *Dados da empresa* → cartão **Nota fiscal**.
- Ficam no banco **cifradas** (AES-256-GCM) com a chave `FISCAL_ENCRYPTION_KEY`; **nunca** saem pela API
  (só um resumo: nome do titular, validade, se há CSC). O driver recebe o certificado decifrado em
  `input.credentials` apenas durante a chamada.
- **Sem `FISCAL_ENCRYPTION_KEY` o sistema recusa guardar** certificado/CSC (melhor do que gravar sem proteção).
- Gerar a chave: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
  Guarde uma cópia num cofre de senhas: se for perdida, os certificados precisam ser enviados de novo.
- Alternativa: se preferir subir o certificado direto no painel do provedor, não use o cadastro daqui.
