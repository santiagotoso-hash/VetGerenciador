import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export enum PaymentMethod {
  CASH = 'CASH',
  CREDIT_CARD = 'CREDIT_CARD',
  DEBIT_CARD = 'DEBIT_CARD',
  PIX = 'PIX',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CHECK = 'CHECK',
}

export class SaleItemDto {
  @IsString() @IsOptional() productId?: string;
  @IsString() @IsOptional() serviceId?: string;
  @IsInt() @Min(1) quantity: number;
  @IsNumber() @Min(0) @IsOptional() discount?: number;
}

export class CreateSaleDto {
  @IsString() @IsOptional() clientId?: string;
  @IsEnum(PaymentMethod) paymentMethod: PaymentMethod;
  @IsNumber() @Min(0) @IsOptional() discount?: number;
  @IsString() @IsOptional() notes?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items: SaleItemDto[];
}
