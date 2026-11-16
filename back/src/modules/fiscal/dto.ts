import { IsBoolean, IsEnum, IsIn, IsOptional, IsString, IsUrl, Matches, MaxLength, MinLength } from 'class-validator';

export enum TaxRegimeDto {
  MEI = 'MEI',
  SIMPLES = 'SIMPLES',
  PRESUMIDO = 'PRESUMIDO',
  REAL = 'REAL',
}

/** Dados fiscais da empresa (preenchidos pelo administrador). Texto vazio limpa o campo. */
export class UpdateFiscalSettingsDto {
  /** Emitir a nota automaticamente ao finalizar a venda. */
  @IsBoolean() @IsOptional() fiscalAutoEmit?: boolean;
  @IsString() @IsOptional() @Matches(/^(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})?$/, { message: 'CNPJ inválido' }) cnpj?: string;
  @IsString() @IsOptional() @MaxLength(30) stateRegistration?: string;
  @IsString() @IsOptional() @MaxLength(30) municipalRegistration?: string;
  @IsEnum(TaxRegimeDto) @IsOptional() taxRegime?: TaxRegimeDto;
  @IsString() @IsOptional() @Matches(/^(\d{7})?$/, { message: 'O código IBGE do município tem 7 dígitos (Salvador: 2927408)' }) cityIbgeCode?: string;
  @IsString() @IsOptional() @MaxLength(200) address?: string;
  @IsString() @IsOptional() @MaxLength(100) city?: string;
  @IsString() @IsOptional() @MaxLength(2) state?: string;
  @IsString() @IsOptional() @MaxLength(12) zipCode?: string;
}

export class PrepareInvoicesDto {
  /** Produtos saem em NFC-e (consumidor final, padrão) ou NF-e (venda para empresa). */
  @IsIn(['NFCE', 'NFE']) @IsOptional() productType?: 'NFCE' | 'NFE';
}

/** Nota emitida fora do sistema (portal gratuito): registra o resultado aqui. */
export class RegisterInvoiceDto {
  @IsString() @MinLength(1) @MaxLength(30) number: string;
  @IsString() @IsOptional() @MaxLength(10) series?: string;
  @IsString() @IsOptional() @Matches(/^(\d{44})?$/, { message: 'A chave de acesso tem 44 números' }) accessKey?: string;
  @IsString() @IsOptional() issuedAt?: string;
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] }) @IsOptional() pdfUrl?: string;
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] }) @IsOptional() xmlUrl?: string;
}

export class CancelInvoiceDto {
  /** A SEFAZ exige justificativa de pelo menos 15 caracteres. */
  @IsString() @MinLength(15, { message: 'Informe o motivo com pelo menos 15 caracteres' }) @MaxLength(255) reason: string;
}
