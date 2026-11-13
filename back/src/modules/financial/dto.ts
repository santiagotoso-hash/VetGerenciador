import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export enum FinancialType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}
export enum PaymentMethod {
  CASH = 'CASH',
  CREDIT_CARD = 'CREDIT_CARD',
  DEBIT_CARD = 'DEBIT_CARD',
  PIX = 'PIX',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CHECK = 'CHECK',
}

export class CreateFinancialEntryDto {
  @IsEnum(FinancialType) type: FinancialType;
  @IsString() description: string;
  @IsNumber() @Min(0) amount: number;
  @IsDateString() date: string;
  @IsString() category: string;
  @IsEnum(PaymentMethod) @IsOptional() paymentMethod?: PaymentMethod;
  @IsBoolean() @IsOptional() paid?: boolean;
  @IsString() @IsOptional() notes?: string;
}
export class UpdateFinancialEntryDto extends PartialType(CreateFinancialEntryDto) {}
