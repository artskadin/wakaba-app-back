import { Prisma } from '@prisma/client';
import {
  ContentGraph,
  DialogInput,
  DiffResult,
  EntityDiff,
  GrammarNoteInput,
  LessonInput,
  PatternInput,
  SentenceInput,
  TokenInput,
  TrackInput,
} from './types';

const json = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;

export class Applier {
  constructor(private tx: Prisma.TransactionClient) {}

  async run(
    graph: ContentGraph,
    plan: DiffResult,
    mode: 'all' | 'creates',
  ): Promise<void> {
    const ids = (d: EntityDiff) =>
      mode === 'all' ? [...d.create, ...d.update] : d.create;

    for (const id of ids(plan.notes)) {
      await this.upsertNote(graph.notes.get(id)!);
    }

    for (const id of ids(plan.tokens)) {
      await this.upsertToken(graph.tokens.get(id)!);
    }

    for (const id of ids(plan.tracks)) {
      await this.upsertTrack(graph.tracks.get(id)!);
    }

    for (const id of ids(plan.patterns)) {
      await this.upsertPattern(graph.patterns.get(id)!);
    }

    for (const id of ids(plan.sentences)) {
      await this.upsertSentence(graph.sentences.get(id)!);
    }

    for (const id of ids(plan.dialogs)) {
      await this.upsertDialog(graph.dialogs.get(id)!);
    }

    for (const id of ids(plan.lessons)) {
      await this.upsertLesson(graph.lessons.get(id)!);
    }

    if (mode !== 'all') {
      return;
    }

    await this.tx.lesson.deleteMany({
      where: { id: { in: plan.lessons.remove } },
    });
    await this.tx.dialog.deleteMany({
      where: { id: { in: plan.dialogs.remove } },
    });
    await this.tx.sentence.deleteMany({
      where: { id: { in: plan.sentences.remove } },
    });
    await this.tx.pattern.deleteMany({
      where: { id: { in: plan.patterns.remove } },
    });
    await this.tx.token.deleteMany({
      where: { id: { in: plan.tokens.remove } },
    });
    await this.tx.track.deleteMany({
      where: { id: { in: plan.tracks.remove } },
    });
    await this.tx.grammarNote.deleteMany({
      where: { id: { in: plan.notes.remove } },
    });
  }

  private async upsertNote(n: GrammarNoteInput) {
    const data = {
      title: n.title ? json(n.title) : Prisma.JsonNull,
      body: json(n.body),
      deeper: n.deeper ? json(n.deeper) : Prisma.JsonNull,
    };

    await this.tx.grammarNote.upsert({
      where: { id: n.id },
      create: { id: n.id, ...data },
      update: data,
    });
  }

  private async upsertToken(t: TokenInput) {
    const data = {
      surface: t.surface,
      reading: t.reading,
      romaji: t.romaji,
      cyrillic: t.cyrillic,
      gloss: json(t.gloss),
      type: t.type,
      grammarNoteId: t.grammarNoteId ?? null,
      synonymGroupId: t.synonymGroupId ?? null,
    };

    await this.tx.token.upsert({
      where: { id: t.id },
      create: { id: t.id, ...data },
      update: data,
    });
  }

  private async upsertTrack(t: TrackInput) {
    const data = {
      title: json(t.title),
      description: json(t.description),
      position: t.position ?? 0,
    };

    await this.tx.track.upsert({
      where: { id: t.id },
      create: { id: t.id, ...data },
      update: data,
    });
  }

  private async upsertPattern(p: PatternInput) {
    const data = {
      explanation: json(p.explanation),
      slotType: p.slotType,
    };

    await this.tx.pattern.upsert({
      where: { id: p.id },
      create: { id: p.id, ...data },
      update: data,
    });

    await this.tx.patternGrammarNote.deleteMany({ where: { patternId: p.id } });

    if (p.grammarNoteIds.length) {
      await this.tx.patternGrammarNote.createMany({
        data: p.grammarNoteIds.map((grammarNoteId, position) => ({
          patternId: p.id,
          grammarNoteId,
          position,
        })),
      });
    }
  }

  private async upsertSentence(s: SentenceInput) {
    const data = {
      translation: json(s.translation),
      romaji: s.romaji,
      cyrillicGuide: json(s.cyrillicGuide),
    };

    await this.tx.sentence.upsert({
      where: { id: s.id },
      create: { id: s.id, ...data },
      update: data,
    });

    await this.tx.sentenceToken.deleteMany({ where: { sentenceId: s.id } });
    await this.tx.sentenceToken.createMany({
      data: s.tokens.map((ref, position) => ({
        sentenceId: s.id,
        tokenId: ref.tokenId,
        position,
        before: ref.before ?? null,
        after: ref.after ?? null,
      })),
    });

    await this.tx.sentencePattern.deleteMany({ where: { sentenceId: s.id } });
    if (s.patterns?.length) {
      await this.tx.sentencePattern.createMany({
        data: s.patterns.map((p) => ({
          sentenceId: s.id,
          patternId: p.patternId,
          focusTokenIndex: p.focusTokenIndex,
        })),
      });
    }

    await this.tx.sentenceGrammarNote.deleteMany({
      where: { sentenceId: s.id },
    });
    if (s.grammarNoteIds?.length) {
      await this.tx.sentenceGrammarNote.createMany({
        data: s.grammarNoteIds.map((grammarNoteId, position) => ({
          sentenceId: s.id,
          grammarNoteId,
          position,
        })),
      });
    }
  }

  private async upsertDialog(d: DialogInput) {
    const data = { title: json(d.title) };

    await this.tx.dialog.upsert({
      where: { id: d.id },
      create: { id: d.id, ...data },
      update: data,
    });

    await this.tx.dialogTurn.deleteMany({ where: { dialogId: d.id } });

    await this.tx.dialogTurn.createMany({
      data: d.turns.map((turn, position) => ({
        dialogId: d.id,
        speaker: turn.speaker,
        sentenceId: turn.sentenceId,
        position,
      })),
    });
  }

  private async upsertLesson(l: LessonInput) {
    const data = {
      trackId: l.trackId,
      title: json(l.title),
      context: json(l.context),
      version: l.version,
      position: l.position ?? 0,
      changelog: json(l.changelog ?? []),
    };

    await this.tx.lesson.upsert({
      where: { id: l.id },
      create: { id: l.id, ...data },
      update: data,
    });

    await this.tx.lessonStep.deleteMany({ where: { lessonId: l.id } });

    for (const [position, st] of l.steps.entries()) {
      await this.tx.lessonStep.create({
        data: {
          lessonId: l.id,
          position,
          kind: st.kind,
          sentenceId: 'sentenceId' in st ? st.sentenceId : null,
          dialogId: 'dialogId' in st ? st.dialogId : null,
          patternId: st.kind === 'teach' ? (st.patternId ?? null) : null,
          siblings:
            st.kind === 'teach' && st.siblingSentenceIds?.length
              ? {
                  create: st.siblingSentenceIds.map((sentenceId, p) => ({
                    sentenceId,
                    position: p,
                  })),
                }
              : undefined,
          grammarNotes: st.grammarNoteIds?.length
            ? {
                create: st.grammarNoteIds.map((grammarNoteId, p) => ({
                  grammarNoteId,
                  position: p,
                })),
              }
            : undefined,
        },
      });
    }
  }
}
