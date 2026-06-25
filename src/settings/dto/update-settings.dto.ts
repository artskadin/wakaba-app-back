import { Voice } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsEnum(Voice)
  voice?: 'm' | 'f';
}
