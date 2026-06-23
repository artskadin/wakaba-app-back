import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { FavouriteItemType } from '@prisma/client';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import type { AuthUser } from 'src/auth/auth.types';
import { CurrentUser } from 'src/auth/current-user.decorator';
import { FavouritesService } from './favourites.service';
import { AddFavouriteDto } from './dto/add-favourite.dto';

@UseGuards(JwtAuthGuard)
@Controller('favourites')
export class FavouritesController {
  constructor(private favouritesService: FavouritesService) {}

  @Get()
  getMine(@CurrentUser() user: AuthUser) {
    return this.favouritesService.getForUser(user.id);
  }

  @Post()
  add(@CurrentUser() user: AuthUser, @Body() dto: AddFavouriteDto) {
    return this.favouritesService.add(user.id, dto);
  }

  @Delete(':itemType/:id')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('itemType', new ParseEnumPipe(FavouriteItemType))
    itemType: FavouriteItemType,
    @Param('id') id: string,
  ) {
    return this.favouritesService.remove(user.id, itemType, id);
  }
}
