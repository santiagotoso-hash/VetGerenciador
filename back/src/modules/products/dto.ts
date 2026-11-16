import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class CreateProductDto {
  @IsString() name: string;
  @IsString() @IsOptional() description?: string;
  @IsString() category: string;
  @IsString() @IsOptional() brand?: string;
  @IsString() @IsOptional() sku?: string;
  @IsString() @IsOptional() barcode?: string;
  @IsNumber() @Min(0) price: number;
  @IsNumber() @Min(0) @IsOptional() costPrice?: number;
  @IsInt() @Min(0) @IsOptional() stock?: number;
  @IsInt() @Min(0) @IsOptional() minStock?: number;
  @IsString() @IsOptional() unit?: string;

  // Fiscal (nota de produto). String vazia limpa o campo.
  @IsString() @IsOptional() @Matches(/^(\d{8})?$/, { message: 'NCM tem 8 números' }) ncm?: string;
  @IsString() @IsOptional() @Matches(/^(\d{4})?$/, { message: 'CFOP tem 4 números' }) cfop?: string;
  @IsString() @IsOptional() @Matches(/^(\d{2,3})?$/, { message: 'CST/CSOSN tem 2 ou 3 números' }) taxCode?: string;
  @IsInt() @Min(0) @Max(8) @IsOptional() origin?: number;
}
export class UpdateProductDto extends PartialType(CreateProductDto) {
  @IsBoolean() @IsOptional() active?: boolean;
}
export class AdjustStockDto {
  /** positivo = entrada, negativo = saída */
  @IsInt() quantity: number;
}
