import { FavouriteItemType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class AddFavouriteDto {
  @IsEnum(FavouriteItemType)
  itemType: FavouriteItemType;

  @IsString()
  @IsOptional()
  tokenId?: string;

  @IsString()
  @IsOptional()
  sentenceId?: string;
}
