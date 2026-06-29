import { Injectable } from '@nestjs/common';
import { FavouriteItemType, Token } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class FavouritesService {
  constructor(private prisma: PrismaService) {}

  async getForUser(userId: string) {
    const rows = await this.prisma.favourite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        token: true,
        sentence: {
          include: {
            tokens: { orderBy: { position: 'asc' }, include: { token: true } },
          },
        },
      },
    });

    return rows.map((f) => ({
      id: f.id,
      itemType: f.itemType,
      tokenId: f.tokenId,
      sentenceId: f.sentenceId,
      createdAt: f.createdAt,
      token: f.token ? this.toToken(f.token) : null,
      sentence: f.sentence
        ? {
            id: f.sentence.id,
            romaji: f.sentence.romaji,
            translation: f.sentence.translation,
            cyrillicGuide: f.sentence.cyrillicGuide,
            tokens: f.sentence.tokens.map((st) => ({
              token: this.toToken(st.token),
              slotType: st.slotType,
              isFocuced: st.isFocusSlot,
            })),
          }
        : null,
    }));
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

  private toToken(t: Token) {
    return {
      id: t.id,
      surface: t.surface,
      reading: t.reading,
      romaji: t.romaji,
      cyrillic: t.cyrillic,
      gloss: t.gloss,
      type: t.type,
      ...(t.grammarNoteId ? { grammarNoteId: t.grammarNoteId } : {}),
      ...(t.synonymGroupId ? { synonymGroupId: t.synonymGroupId } : {}),
    };
  }
}
