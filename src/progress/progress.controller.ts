import { Body, Controller, Get, Put, Param, UseGuards } from '@nestjs/common';
import { ProgressService } from './progress.service';
import { CurrentUser } from 'src/auth/current-user.decorator';
import { type AuthUser } from 'src/auth/auth.types';
import { SaveProgressDto } from './dto/save-progress.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('progress')
export class ProgressController {
  constructor(private progress: ProgressService) {}

  @Get()
  getMine(@CurrentUser() user: AuthUser) {
    return this.progress.getForUser(user.id);
  }

  @Put(':lessonId')
  save(
    @CurrentUser() user: AuthUser,
    @Param('lessonId') lessonId: string,
    @Body() dto: SaveProgressDto,
  ) {
    return this.progress.save(user.id, lessonId, dto);
  }
}
