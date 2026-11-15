import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';

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
}

export class UpdateCompanyDto {
  @IsString() @MinLength(2) @IsOptional() name?: string;
  @IsString() @IsOptional() logo?: string;
  @IsBoolean() @IsOptional() active?: boolean;
}

export class UpdateCompanyUserDto {
  @IsString() @MinLength(6) @IsOptional() password?: string;
  @IsBoolean() @IsOptional() active?: boolean;
}
