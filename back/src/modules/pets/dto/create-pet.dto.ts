import {
  IsBoolean,
  IsDateString,
  MaxLength,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum Species {
  DOG = 'DOG',
  CAT = 'CAT',
  BIRD = 'BIRD',
  RABBIT = 'RABBIT',
  HAMSTER = 'HAMSTER',
  FISH = 'FISH',
  REPTILE = 'REPTILE',
  OTHER = 'OTHER',
}

export class CreatePetDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ enum: Species })
  @IsEnum(Species)
  species: Species;

  @ApiProperty()
  @IsString()
  clientId: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  breed?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  color?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  birthDate?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  weight?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  microchip?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  allergies?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  observations?: string;

  /** Foto redimensionada no front, como data URL (image/jpeg). String vazia remove a foto. */
  @ApiPropertyOptional()
  @IsString()
  @MaxLength(400000)
  @IsOptional()
  photo?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  birthdayEmail?: boolean;
}
