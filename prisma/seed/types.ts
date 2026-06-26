import { Speaker, StepKind, TokenType } from '@prisma/client';

export interface Localized {
  ru: string;
  en?: string;
}

export interface ManifestTrack {
  id: string;
  title: Localized;
  description: Localized;
  lessons: { id: string; title: Localized }[];
}

export interface Manifest {
  version: number;
  tracks: ManifestTrack[];
}

export interface TokenRef {
  tokenId: string;
  slotType?: string;
  isFocusSlot?: boolean;
}

export interface BundleToken {
  id: string;
  surface: string;
  reading: string;
  romaji: string;
  cyrillic: string;
  gloss: Localized;
  type: TokenType;
  grammarNoteId?: string;
  synonymGroupId?: string;
}

export interface BundleSentence {
  id: string;
  tokens: TokenRef[];
  translation: Localized;
  romaji: string;
  cyrillicGuide: Localized;
  grammarNoteIds?: string[];
  patternId?: string;
}

export interface BundlePattern {
  id: string;
  explanation: Localized;
  slotType: string;
  grammarNoteIds: string[];
}

export interface BundleGrammarNote {
  id: string;
  title: Localized;
  body: unknown;
  deeper?: unknown;
}

export interface BundleDialog {
  id: string;
  title: Localized;
  turns: { speaker: Speaker; sentenceId: string }[];
}

export interface BundleStep {
  kind: StepKind;
  sentenceId?: string;
  patternId?: string;
  siblingSentenceIds?: string[];
  dialogId?: string;
}

export interface BundleLesson {
  id: string;
  trackId: string;
  title: Localized;
  context: Localized;
  version: number;
  changelog: unknown[];
  steps: BundleStep[];
}

export interface LessonBundle {
  lesson: BundleLesson;
  tokens: Record<string, BundleToken>;
  grammarNotes: Record<string, BundleGrammarNote>;
  patterns: Record<string, BundlePattern>;
  sentences: Record<string, BundleSentence>;
  dialogs: Record<string, BundleDialog>;
}
