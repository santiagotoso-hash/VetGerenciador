import { Type } from 'class-transformer';
import {
  MaxLength, IsArray, IsBoolean, IsEmail, IsEnum, IsIn, IsInt, IsOptional, IsString, Matches, Max, Min, MinLength, ValidateNested,
} from 'class-validator';

export enum CompanyUserRole {
  ADMIN = 'ADMIN',
  VETERINARIAN = 'VETERINARIAN',
  RECEPTIONIST = 'RECEPTIONIST',
  GROOMER = 'GROOMER',
}

export class CompanyUserDto {
  @IsString() @MinLength(2) name: string;
  @IsEmail() email: string;
  @IsString() @MinLength(6) password: string;
  @IsEnum(CompanyUserRole) @IsOptional() role?: CompanyUserRole;
  @IsString() @IsOptional() phone?: string;
}

export class CreateCompanyDto {
  @IsString() @MinLength(2) name: string;
  /** Administrador da empresa (obrigatório). */
  @ValidateNested() @Type(() => CompanyUserDto) admin: CompanyUserDto;
  /** Atendentes e demais usuários criados junto (opcional). */
  @IsArray() @ValidateNested({ each: true }) @Type(() => CompanyUserDto) @IsOptional() users?: CompanyUserDto[];
  /** Dias de teste grátis (0 = sem teste, a cobrança começa hoje). Omitido = sem cobrança. */
  @IsInt() @Min(0) @Max(365) @IsOptional() trialDays?: number;
  @IsInt() @Min(0) @Max(10_000_000) @IsOptional() monthlyFeeCents?: number;
}

export class UpdateCompanyDto {
  @IsString() @MinLength(2) @IsOptional() name?: string;
  /** Logomarca: data URL de imagem (enviada pela tela) ou caminho em /assets/. Vazio remove. */
  @IsString() @MaxLength(700_000) @IsOptional() logo?: string;
  @IsBoolean() @IsOptional() active?: boolean;
  @IsInt() @Min(0) @Max(10_000_000) @IsOptional() monthlyFeeCents?: number;

  // Dados da empresa (texto vazio limpa o campo)
  @IsString() @MaxLength(30) @IsOptional() cnpj?: string;
  @IsString() @MaxLength(30) @IsOptional() phone?: string;
  @IsString() @MaxLength(200) @IsOptional() email?: string;
  @IsString() @MaxLength(200) @IsOptional() address?: string;
  @IsString() @MaxLength(100) @IsOptional() city?: string;
  @IsString() @MaxLength(2) @IsOptional() state?: string;
  @IsString() @MaxLength(12) @IsOptional() zipCode?: string;
  @IsString() @MaxLength(2000) @IsOptional() notes?: string;

  // Proprietário
  @IsString() @MaxLength(150) @IsOptional() ownerName?: string;
  @IsString() @MaxLength(200) @IsOptional() ownerEmail?: string;
  @IsString() @MaxLength(30) @IsOptional() ownerPhone?: string;
  @IsString() @MaxLength(30) @IsOptional() ownerDocument?: string;

  /** Teste grátis termina daqui a N dias. */
  @IsInt() @Min(1) @Max(365) @IsOptional() trialDays?: number;
  /** Começar a cobrar hoje, sem teste. */
  @IsIn([true]) @IsOptional() startBilling?: true;
  /** Isentar de cobrança (nunca bloqueia por pagamento). */
  @IsIn([true]) @IsOptional() exempt?: true;
}

export class UpdateCompanyUserDto {
  @IsString() @MinLength(6) @IsOptional() password?: string;
  @IsBoolean() @IsOptional() active?: boolean;
}

export class InvoiceSettingsDto {
  /** E-mail(s) do financeiro, separados por vírgula. Vazio = desliga o envio automático. */
  @IsString() email: string;
  @IsInt() @Min(1, { message: 'Escolha um dia de 1 a 28' }) @Max(28, { message: 'Escolha um dia de 1 a 28' }) day: number;
}

export class SendInvoiceDto {
  @IsString() @IsOptional() email?: string;
}

export class CreatePaymentDto {
  @IsInt() @Min(1, { message: 'Informe o valor' }) @Max(10_000_000) amountCents: number;
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Data inválida' }) paidAt: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Data inválida' }) periodStart: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Data inválida' }) periodEnd: string;
  @IsIn(['PIX', 'BOLETO', 'CARTAO', 'TRANSFERENCIA', 'DINHEIRO', 'OUTRO']) method: string;
  @IsString() @IsOptional() note?: string;
}
