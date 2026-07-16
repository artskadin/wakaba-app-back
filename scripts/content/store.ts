import {
  GrammarNote,
  Prisma,
  PrismaClient,
  Token,
  Track,
} from '@prisma/client';
import {
  ContentGraph,
  DialogInput,
  GrammarBlockInput,
  GrammarNoteInput,
  LessonInput,
  LessonStepInput,
  LocalizedText,
  PatternInput,
  SentenceInput,
  TokenInput,
  TrackInput,
} from './types';

type PatternRow = Prisma.PatternGetPayload<{ include: { grammarNotes: true } }>;
type SentenceRow = Prisma.SentenceGetPayload<{
  include: { tokens: true; grammarNotes: true; patterns: true };
}>;
type DialogRow = Prisma.DialogGetPayload<{ include: { turns: true } }>;
type LessonRow = Prisma.LessonGetPayload<{
  include: { steps: { include: { siblings: true; grammarNotes: true } } };
}>;
type StepRow = LessonRow['steps'][number];

export async function readDbAsGraph(
  prisma: PrismaClient,
): Promise<ContentGraph> {
  const [tokens, notes, patterns, sentences, dialogs, lessons, tracks] =
    await Promise.all([
      prisma.token.findMany(),
      prisma.grammarNote.findMany(),
      prisma.pattern.findMany({
        include: { grammarNotes: { orderBy: { position: 'asc' } } },
      }),
      prisma.sentence.findMany({
        include: {
          tokens: { orderBy: { position: 'asc' } },
          grammarNotes: { orderBy: { position: 'asc' } },
          patterns: true,
        },
      }),
      prisma.dialog.findMany({
        include: { turns: { orderBy: { position: 'asc' } } },
      }),
      prisma.lesson.findMany({
        include: {
          steps: {
            orderBy: { position: 'asc' },
            include: {
              siblings: { orderBy: { position: 'asc' } },
              grammarNotes: { orderBy: { position: 'asc' } },
            },
          },
        },
      }),
      prisma.track.findMany(),
    ]);

  return {
    tokens: mapById(
      tokens,
      (t: Token): TokenInput => ({
        id: t.id,
        surface: t.surface,
        reading: t.reading,
        romaji: t.romaji,
        cyrillic: t.cyrillic,
        gloss: asJson<LocalizedText>(t.gloss),
        type: t.type,
        ...(t.grammarNoteId ? { grammarNoteId: t.grammarNoteId } : {}),
        ...(t.synonymGroupId ? { synonymGroupId: t.synonymGroupId } : {}),
      }),
    ),

    notes: mapById(
      notes,
      (n: GrammarNote): GrammarNoteInput => ({
        id: n.id,
        body: asJson<GrammarBlockInput[]>(n.body),
        ...(n.title ? { title: asJson<LocalizedText>(n.title) } : {}),
        ...(n.deeper ? { deeper: asJson<GrammarBlockInput[]>(n.deeper) } : {}),
      }),
    ),

    patterns: mapById(
      patterns,
      (p: PatternRow): PatternInput => ({
        id: p.id,
        explanation: asJson<LocalizedText>(p.explanation),
        slotType: p.slotType,
        grammarNoteIds: p.grammarNotes.map((l) => l.grammarNoteId),
      }),
    ),

    sentences: mapById(
      sentences,
      (s: SentenceRow): SentenceInput => ({
        id: s.id,
        tokens: s.tokens.map((st) => ({
          tokenId: st.tokenId,
          ...(st.before ? { before: st.before } : {}),
          ...(st.after ? { after: st.after } : {}),
        })),
        translation: asJson<LocalizedText>(s.translation),
        romaji: s.romaji,
        cyrillicGuide: asJson<LocalizedText>(s.cyrillicGuide),
        ...(s.patterns.length
          ? {
              patterns: [...s.patterns]
                .sort((a, b) => a.patternId.localeCompare(b.patternId))
                .map((p) => ({
                  patternId: p.patternId,
                  focusTokenIndex: p.focusTokenIndex,
                })),
            }
          : {}),
        ...(s.grammarNotes.length
          ? { grammarNoteIds: s.grammarNotes.map((l) => l.grammarNoteId) }
          : {}),
      }),
    ),

    dialogs: mapById(
      dialogs,
      (d: DialogRow): DialogInput => ({
        id: d.id,
        title: asJson<LocalizedText>(d.title),
        turns: d.turns.map((turn) => ({
          speaker: turn.speaker,
          sentenceId: turn.sentenceId,
        })),
      }),
    ),

    lessons: mapById(
      lessons,
      (l: LessonRow): LessonInput => ({
        id: l.id,
        trackId: l.trackId,
        title: asJson<LocalizedText>(l.title),
        context: asJson<LocalizedText>(l.context),
        version: l.version,
        position: l.position,
        changelog: asJson<unknown[]>(l.changelog),
        steps: l.steps.map(stepFromDb),
      }),
    ),

    tracks: mapById(
      tracks,
      (t: Track): TrackInput => ({
        id: t.id,
        title: asJson<LocalizedText>(t.title),
        description: asJson<LocalizedText>(t.description),
        position: t.position,
      }),
    ),
  };
}

function mapById<Row extends { id: string }, T>(
  rows: Row[],
  make: (row: Row) => T,
): Map<string, T> {
  return new Map(rows.map((row): [string, T] => [row.id, make(row)]));
}

function asJson<T>(value: Prisma.JsonValue | null): T {
  return value as unknown as T;
}

function stepFromDb(st: StepRow): LessonStepInput {
  const noteIds = st.grammarNotes.map((l) => l.grammarNoteId);
  const notes = noteIds.length ? { grammarNoteIds: noteIds } : {};

  if (st.kind === 'dialog') {
    return { kind: 'dialog', dialogId: st.dialogId!, ...notes };
  }

  if (st.kind === 'teach') {
    const siblings = st.siblings.map((s) => s.sentenceId);

    return {
      kind: 'teach',
      sentenceId: st.sentenceId!,
      ...(st.patternId ? { patternId: st.patternId } : {}),
      ...(siblings.length ? { siblingSentenceIds: siblings } : {}),
      ...notes,
    };
  }

  return { kind: st.kind, sentenceId: st.sentenceId!, ...notes };
}
