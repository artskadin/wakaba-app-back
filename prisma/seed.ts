import {
  GrammarExampleKind,
  Prisma,
  PrismaClient,
  Speaker,
  StepKind,
  TokenType,
} from '@prisma/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const prisma = new PrismaClient();
const CONTENT_DIR = join(process.cwd(), 'content');
const toJson = (value: unknown): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

interface Localized {
  ru: string;
  en?: string;
}

interface ManifestTrack {
  id: string;
  title: Localized;
  description: Localized;
  lessons: { id: string; title: Localized }[];
}

interface Manifest {
  version: number;
  tracks: ManifestTrack[];
}

interface TokenRef {
  tokenId: string;
  slotType?: string;
  isFocusSlot?: boolean;
}

interface BundleToken {
  id: string;
  surface: string;
  reading: string;
  romaji: string;
  cyrillic: string;
  gloss: Localized;
  type: TokenType;
  audioKey?: string;
  grammarNoteId?: string;
  synonymGroupId?: string;
}

interface BundleSentence {
  id: string;
  tokens: TokenRef[];
  translation: Localized;
  romaji: string;
  cyrillicGuide: Localized;
  audioKey: string;
  patternId?: string;
}

interface BundlePattern {
  id: string;
  explanation: Localized;
  slotType: string;
  grammarNoteIds: string[];
}

interface BundleExample {
  kind: GrammarExampleKind;
  [key: string]: unknown;
}

interface BundleGrammarNote {
  id: string;
  title: Localized;
  body: Localized;
  deeper?: Localized;
  examples: BundleExample[];
}

interface BundleDialog {
  id: string;
  title: Localized;
  turns: { speaker: Speaker; sentenceId: string }[];
}

interface BundleStep {
  kind: StepKind;
  sentenceId?: string;
  patternId?: string;
  siblingSentenceIds?: string[];
  dialogId?: string;
}

interface BundleLesson {
  id: string;
  trackId: string;
  title: Localized;
  context: Localized;
  version: number;
  changelog: unknown[];
  steps: BundleStep[];
}

interface LessonBundle {
  lesson: BundleLesson;
  tokens: Record<string, BundleToken>;
  grammarNotes: Record<string, BundleGrammarNote>;
  patterns: Record<string, BundlePattern>;
  sentences: Record<string, BundleSentence>;
  dialogs: Record<string, BundleDialog>;
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(
    readFileSync(join(CONTENT_DIR, relativePath), 'utf-8'),
  ) as T;
}

async function seedTracks(manifest: Manifest) {
  for (const [idx, track] of manifest.tracks.entries()) {
    const data = {
      title: toJson(track.title),
      description: toJson(track.description),
      position: idx,
    };

    await prisma.track.upsert({
      where: { id: track.id },
      create: { id: track.id, ...data },
      update: data,
    });
  }
}

async function seedLesson(bundle: LessonBundle) {
  await prisma.$transaction(async (tx) => {
    for (const note of Object.values(bundle.grammarNotes)) {
      const data = {
        title: toJson(note.title),
        body: toJson(note.body),
        deeper: note.deeper ? toJson(note.deeper) : undefined,
      };

      await tx.grammarNote.upsert({
        where: { id: note.id },
        create: { id: note.id, ...data },
        update: data,
      });

      await tx.grammarExample.deleteMany({ where: { grammarNoteId: note.id } });

      if (note.examples.length) {
        await tx.grammarExample.createMany({
          data: note.examples.map((example, idx) => ({
            id: `${note.id}__ex${idx}`,
            grammarNoteId: note.id,
            position: idx,
            kind: example.kind,
            payload: toJson(example),
          })),
        });
      }
    }

    for (const pattern of Object.values(bundle.patterns)) {
      const data = {
        explanation: toJson(pattern.explanation),
        slotType: pattern.slotType,
      };

      await tx.pattern.upsert({
        where: { id: pattern.id },
        create: { id: pattern.id, ...data },
        update: data,
      });

      await tx.patternGrammarNote.deleteMany({
        where: { patternId: pattern.id },
      });

      if (pattern.grammarNoteIds.length) {
        await tx.patternGrammarNote.createMany({
          data: pattern.grammarNoteIds.map((grammarNoteId) => ({
            patternId: pattern.id,
            grammarNoteId,
          })),
        });
      }
    }

    for (const token of Object.values(bundle.tokens)) {
      const data = {
        surface: token.surface,
        reading: token.reading,
        romaji: token.romaji,
        cyrillic: token.cyrillic,
        gloss: toJson(token.gloss),
        type: token.type,
        audioKey: token.audioKey ?? null,
        grammarNoteId: token.grammarNoteId ?? null,
        synonymGroupId: token.synonymGroupId ?? null,
      };

      await tx.token.upsert({
        where: { id: token.id },
        create: { id: token.id, ...data },
        update: data,
      });
    }

    for (const sentence of Object.values(bundle.sentences)) {
      const data = {
        patternId: sentence.patternId ?? null,
        translation: toJson(sentence.translation),
        romaji: sentence.romaji,
        cyrillicGuide: toJson(sentence.cyrillicGuide),
        audioKey: sentence.audioKey,
      };

      await tx.sentence.upsert({
        where: { id: sentence.id },
        create: { id: sentence.id, ...data },
        update: data,
      });

      await tx.sentenceToken.deleteMany({ where: { sentenceId: sentence.id } });

      await tx.sentenceToken.createMany({
        data: sentence.tokens.map((ref, idx) => ({
          id: `${sentence.id}__t${idx}`,
          sentenceId: sentence.id,
          tokenId: ref.tokenId,
          position: idx,
          slotType: ref.slotType ?? null,
          isFocusSlot: ref.isFocusSlot ?? false,
        })),
      });
    }

    for (const dialog of Object.values(bundle.dialogs)) {
      await tx.dialog.upsert({
        where: { id: dialog.id },
        create: { id: dialog.id, title: toJson(dialog.title) },
        update: { title: toJson(dialog.title) },
      });

      await tx.dialogTurn.deleteMany({ where: { dialogId: dialog.id } });

      await tx.dialogTurn.createMany({
        data: dialog.turns.map((turn, idx) => ({
          id: `${dialog.id}__turn${idx}`,
          dialogId: dialog.id,
          position: idx,
          speaker: turn.speaker,
          sentenceId: turn.sentenceId,
        })),
      });
    }

    const lesson = bundle.lesson;
    const lessonData = {
      trackId: lesson.trackId,
      title: toJson(lesson.title),
      context: toJson(lesson.context),
      version: lesson.version,
      changelog: toJson(lesson.changelog),
    };

    await tx.lesson.upsert({
      where: { id: lesson.id },
      create: { id: lesson.id, ...lessonData },
      update: lessonData,
    });

    await tx.lessonStep.deleteMany({ where: { lessonId: lesson.id } });

    for (const [idx, step] of lesson.steps.entries()) {
      const stepId = `${lesson.id}__step${idx}`;

      await tx.lessonStep.create({
        data: {
          id: stepId,
          lessonId: lesson.id,
          position: idx,
          kind: step.kind,
          sentenceId: step.sentenceId ?? null,
          dialogId: step.dialogId ?? null,
          patternId: step.patternId ?? null,
        },
      });

      if (step.siblingSentenceIds?.length) {
        await tx.lessonStepSibling.createMany({
          data: step.siblingSentenceIds.map((sentenceId, sIdx) => ({
            lessonStepId: stepId,
            sentenceId: sentenceId,
            position: sIdx,
          })),
        });
      }
    }
  });
}

async function main() {
  const manifest = readJson<Manifest>('manifest.json');

  await seedTracks(manifest);

  for (const track of manifest.tracks) {
    for (const lessonStub of track.lessons) {
      await seedLesson(readJson<LessonBundle>(`lessons/${lessonStub.id}.json`));
      console.log(`✓ ${lessonStub.id}`);
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);

    await prisma.$disconnect();

    process.exit(1);
  });
