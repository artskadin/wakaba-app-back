import { Injectable } from '@nestjs/common';
import { FavouriteItemType } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class FavouritesService {
  constructor(private prisma: PrismaService) {}

  getForUser(userId: string) {
    return this.prisma.favourite.findMany({
      where: { userId },
      include: { token: true, sentence: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async add(
    userId: string,
    input: {
      itemType: FavouriteItemType;
      tokenId?: string;
      sentenceId?: string;
    },
  ) {
    await this.prisma.favourite.createMany({
      data: [
        {
          userId,
          itemType: input.itemType,
          tokenId: input.tokenId ?? null,
          sentenceId: input.sentenceId ?? null,
        },
      ],
      skipDuplicates: true,
    });

    return { ok: true };
  }

  async remove(userId: string, itemType: FavouriteItemType, id: string) {
    await this.prisma.favourite.deleteMany({
      where:
        itemType === 'token'
          ? { userId, tokenId: id }
          : { userId, sentenceId: id },
    });

    return { ok: true };
  }
}
