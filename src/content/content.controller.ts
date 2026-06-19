import { Controller, Get, UseGuards, Param } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ContentService } from './content.service';

@UseGuards(JwtAuthGuard)
@Controller('content')
export class ContentController {
  constructor(private content: ContentService) {}

  @Get('manifest')
  getManifest() {
    return this.content.getManifest();
  }

  @Get('lessons/:id')
  getLesson(@Param('id') id: string) {
    return this.content.getLessonBundle(id);
  }
}
