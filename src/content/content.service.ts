import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Token } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ContentService {
  constructor(private prisma: PrismaService) {}

  async getManifest() {
    const tracks = await this.prisma.track.findMany({
      orderBy: { position: 'asc' },
      include: {
        lessons: {
          select: { id: true, title: true },
          orderBy: { position: 'asc' },
        },
      },
    });

    return {
      version: 1,
      tracks: tracks.map((track) => ({
        id: track.id,
        title: track.title,
        description: track.description,
        lessons: track.lessons.map((lesson) => ({
          id: lesson.id,
          title: lesson.title,
        })),
      })),
    };
  }

  async getLessonBundle(id: string) {
    const lesson = await this.loadLessonOrThrow(id);
    const dialogs = await this.loadDialogs(lesson.steps);
    const sentences = await this.loadSentences(lesson.steps, dialogs);
    const tokens = await this.loadTokens(sentences);
    const patterns = await this.loadPatterns(lesson.steps, sentences);
    const grammarNotes = await this.loadGrammarNotes(tokens, patterns);

    return {
      lesson: {
        id: lesson.id,
        trackId: lesson.trackId,
        title: lesson.title,
        context: lesson.context,
        version: lesson.version,
        changelog: lesson.changelog,
        steps: lesson.steps.map(toBundleStep),
      },
      tokens: byId(tokens, toBundleToken),
      grammarNotes: byId(grammarNotes, toBundleNote),
      patterns: byId(patterns, toBundlePattern),
      sentences: byId(sentences, toBundleSentence),
      dialogs: byId(dialogs, toBundleDialog),
    };
  }

  async getTokenDetail(id: string) {
    const token = await this.prisma.token.findUnique({
      where: { id },
      include: {
        grammarNote: {
          include: { examples: { orderBy: { position: 'asc' } } },
        },
      },
    });

    if (!token) {
      throw new NotFoundException(`Token ${id} not found`);
    }
    return {
      token: toBundleToken(token),
      grammarNote: token.grammarNote ? toBundleNote(token.grammarNote) : null,
    };
  }

  private async loadLessonOrThrow(id: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id },
      include: {
        steps: {
          orderBy: { position: 'asc' },
          include: { siblings: { orderBy: { position: 'asc' } } },
        },
      },
    });

    if (!lesson) {
      throw new NotFoundException(`Lesson ${id} not found`);
    }

    return lesson;
  }

  private loadDialogs(steps: StepWithSiblings[]) {
    const dialogIds = steps.flatMap((step) =>
      step.dialogId ? [step.dialogId] : [],
    );

    return this.prisma.dialog.findMany({
      where: { id: { in: dialogIds } },
      include: { turns: { orderBy: { position: 'asc' } } },
    });
  }

  private loadSentences(steps: StepWithSiblings[], dialogs: DialogWithTurns[]) {
    const sentenceIds = new Set<string>();
    for (const step of steps) {
      if (step.sentenceId) {
        sentenceIds.add(step.sentenceId);
      }

      for (const sibling of step.siblings) {
        sentenceIds.add(sibling.sentenceId);
      }
    }

    for (const dialog of dialogs) {
      for (const turn of dialog.turns) {
        sentenceIds.add(turn.sentenceId);
      }
    }

    return this.prisma.sentence.findMany({
      where: { id: { in: [...sentenceIds] } },
      include: { tokens: { orderBy: { position: 'asc' } } },
    });
  }

  private loadTokens(sentences: SentenceWithTokens[]) {
    const tokenIds = new Set<string>();
    for (const sentence of sentences) {
      for (const st of sentence.tokens) {
        tokenIds.add(st.tokenId);
      }
    }

    return this.prisma.token.findMany({
      where: { id: { in: [...tokenIds] } },
    });
  }

  private loadPatterns(
    steps: StepWithSiblings[],
    sentences: SentenceWithTokens[],
  ) {
    const patternIds = new Set<string>();
    for (const step of steps) {
      if (step.patternId) {
        patternIds.add(step.patternId);
      }
    }

    for (const sentence of sentences) {
      if (sentence.patternId) {
        patternIds.add(sentence.patternId);
      }
    }

    return this.prisma.pattern.findMany({
      where: { id: { in: [...patternIds] } },
      include: { grammarNotes: true },
    });
  }

  private loadGrammarNotes(tokens: Token[], patterns: PatternWithNotes[]) {
    const grammarNoteIds = new Set<string>();
    for (const token of tokens) {
      if (token.grammarNoteId) {
        grammarNoteIds.add(token.grammarNoteId);
      }
    }

    for (const pattern of patterns) {
      for (const link of pattern.grammarNotes) {
        grammarNoteIds.add(link.grammarNoteId);
      }
    }

    return this.prisma.grammarNote.findMany({
      where: { id: { in: [...grammarNoteIds] } },
      include: { examples: { orderBy: { position: 'asc' } } },
    });
  }
}

type SentenceWithTokens = Prisma.SentenceGetPayload<{
  include: { tokens: true };
}>;
type NoteWithExamples = Prisma.GrammarNoteGetPayload<{
  include: { examples: true };
}>;
type PatternWithNotes = Prisma.PatternGetPayload<{
  include: { grammarNotes: true };
}>;
type DialogWithTurns = Prisma.DialogGetPayload<{ include: { turns: true } }>;
type LessonWithSteps = Prisma.LessonGetPayload<{
  include: { steps: { include: { siblings: true } } };
}>;
type StepWithSiblings = LessonWithSteps['steps'][number];

function byId<T extends { id: string }, R>(
  items: T[],
  map: (item: T) => R,
): Record<string, R> {
  const result: Record<string, R> = {};

  for (const item of items) {
    result[item.id] = map(item);
  }

  return result;
}

function toBundleToken(token: Token) {
  return {
    id: token.id,
    surface: token.surface,
    reading: token.reading,
    romaji: token.romaji,
    cyrillic: token.cyrillic,
    gloss: token.gloss,
    type: token.type,
    ...(token.audioKey ? { audioKey: token.audioKey } : {}),
    ...(token.grammarNoteId ? { grammarNoteId: token.grammarNoteId } : {}),
    ...(token.synonymGroupId ? { synonymGroupId: token.synonymGroupId } : {}),
  };
}

function toBundleSentence(sentence: SentenceWithTokens) {
  return {
    id: sentence.id,
    tokens: sentence.tokens.map((st) => ({
      tokenId: st.tokenId,
      ...(st.slotType ? { slotType: st.slotType } : {}),
      ...(st.isFocusSlot ? { isFocusSlot: st.isFocusSlot } : {}),
    })),
    translation: sentence.translation,
    romaji: sentence.romaji,
    cyrillicGuide: sentence.cyrillicGuide,
    audioKey: sentence.audioKey,
    ...(sentence.patternId ? { patternId: sentence.patternId } : {}),
  };
}

function toBundleNote(note: NoteWithExamples) {
  return {
    id: note.id,
    title: note.title,
    body: note.body,
    ...(note.deeper ? { deeper: note.deeper } : {}),
    examples: note.examples.map((ex) => ex.payload),
  };
}

function toBundlePattern(pattern: PatternWithNotes) {
  return {
    id: pattern.id,
    explanation: pattern.explanation,
    slotType: pattern.slotType,
    grammarNoteIds: pattern.grammarNotes.map((link) => link.grammarNoteId),
  };
}

function toBundleDialog(dialog: DialogWithTurns) {
  return {
    id: dialog.id,
    title: dialog.title,
    turns: dialog.turns.map((turn) => ({
      speaker: turn.speaker,
      sentenceId: turn.sentenceId,
    })),
  };
}

function toBundleStep(step: StepWithSiblings) {
  if (step.kind === 'dialog') {
    return { kind: step.kind, dialogId: step.dialogId };
  }

  if (step.kind === 'teach') {
    return {
      kind: step.kind,
      sentenceId: step.sentenceId,
      ...(step.patternId ? { patternId: step.patternId } : {}),
      ...(step.siblings.length
        ? { siblingSentenceIds: step.siblings.map((s) => s.sentenceId) }
        : {}),
    };
  }

  return { kind: step.kind, sentenceId: step.sentenceId };
}
