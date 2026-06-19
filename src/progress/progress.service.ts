import { Injectable } from '@nestjs/common';
import { LessonStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ProgressService {
  constructor(private prisma: PrismaService) {}

  getForUser(userId: string) {
    return this.prisma.lessonProgress.findMany({ where: { userId } });
  }

  save(
    userId: string,
    lessonId: string,
    input: { currentStep: number; status: LessonStatus },
  ) {
    const completedAt = input.status === 'completed' ? new Date() : null;
    const data = {
      status: input.status,
      currentStep: input.currentStep,
      completedAt,
    };

    return this.prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: { userId, lessonId, ...data },
      update: data,
    });
  }
}
