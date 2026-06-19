import { LessonStatus } from '@prisma/client';
import { IsEnum, IsInt, Min } from 'class-validator';

export class SaveProgressDto {
  @IsInt()
  @Min(0)
  currentStep: number;

  @IsEnum(LessonStatus)
  status: LessonStatus;
}
