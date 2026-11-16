import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class CreateServiceDto {
  @IsString() name: string;
  @IsString() @IsOptional() description?: string;
  @IsString() category: string;
  @IsNumber() @Min(0) price: number;
  @IsInt() @Min(1) duration: number;

  // Fiscal (NFS-e). String vazia limpa o campo.
  @IsString() @IsOptional() @Matches(/^(\d{1,2}\.?\d{2}(\.?\d{2})?)?$/, { message: 'Código do serviço inválido (ex.: 05.01)' }) serviceCode?: string;
  @IsString() @IsOptional() @Matches(/^(\d{1,2}\.?\d{4}\.?\d{2}\.?\d{2})?$/, { message: 'NBS inválido' }) nbs?: string;
  @IsNumber() @Min(0) @Max(100) @IsOptional() issRate?: number;
  @IsString() @IsOptional() @Matches(/^(\d{4}-?\d\/?\d{2})?$/, { message: 'CNAE inválido' }) cnae?: string;
}
export class UpdateServiceDto extends PartialType(CreateServiceDto) {
  @IsBoolean() @IsOptional() active?: boolean;
}
