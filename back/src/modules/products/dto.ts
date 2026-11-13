import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

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
}
export class UpdateProductDto extends PartialType(CreateProductDto) {
  @IsBoolean() @IsOptional() active?: boolean;
}
export class AdjustStockDto {
  /** positivo = entrada, negativo = saída */
  @IsInt() quantity: number;
}
