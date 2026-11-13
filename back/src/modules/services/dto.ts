import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateServiceDto {
  @IsString() name: string;
  @IsString() @IsOptional() description?: string;
  @IsString() category: string;
  @IsNumber() @Min(0) price: number;
  @IsInt() @Min(1) duration: number;
}
export class UpdateServiceDto extends PartialType(CreateServiceDto) {
  @IsBoolean() @IsOptional() active?: boolean;
}
