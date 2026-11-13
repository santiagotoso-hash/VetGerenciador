import { OmitType, PartialType } from '@nestjs/mapped-types';
import { IsDateString, IsInt, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateMedicalRecordDto {
  @IsString() petId: string;
  @IsString() @IsOptional() appointmentId?: string;
  @IsDateString() @IsOptional() date?: string;
  @IsString() @IsOptional() anamnesis?: string;
  @IsString() @IsOptional() diagnosis?: string;
  @IsString() @IsOptional() treatment?: string;
  @IsString() @IsOptional() prescription?: string;
  @IsString() @IsOptional() exams?: string;
  @IsNumber() @IsOptional() weight?: number;
  @IsNumber() @IsOptional() temperature?: number;
  @IsInt() @IsOptional() heartRate?: number;
  @IsString() @IsOptional() notes?: string;
}
export class UpdateMedicalRecordDto extends PartialType(OmitType(CreateMedicalRecordDto, ['petId'] as const)) {}
