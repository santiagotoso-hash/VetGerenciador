import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsDateString, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export enum AppointmentStatus {
  SCHEDULED = 'SCHEDULED',
  CONFIRMED = 'CONFIRMED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}
export enum AppointmentType {
  CONSULTATION = 'CONSULTATION',
  VACCINATION = 'VACCINATION',
  EXAM = 'EXAM',
  SURGERY = 'SURGERY',
  GROOMING = 'GROOMING',
  BATH = 'BATH',
  RETURN = 'RETURN',
}

export class CreateAppointmentDto {
  @IsDateString() date: string;
  @IsEnum(AppointmentType) type: AppointmentType;
  @IsString() petId: string;
  @IsString() @IsOptional() veterinarianId?: string;
  @IsString() @IsOptional() scheduledById?: string;
  @IsString() @IsOptional() serviceId?: string;
  @IsString() @IsOptional() notes?: string;
  @IsString() @IsOptional() observations?: string;
  @IsNumber() @IsOptional() price?: number;
  @IsBoolean() @IsOptional() notifyClient?: boolean;
  @IsEnum(AppointmentStatus) @IsOptional() status?: AppointmentStatus;
}
export class UpdateAppointmentDto extends PartialType(CreateAppointmentDto) {}
export class UpdateStatusDto {
  @IsEnum(AppointmentStatus) status: AppointmentStatus;
}
