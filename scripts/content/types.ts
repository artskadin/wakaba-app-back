import type { Speaker, TokenType, Voice } from '@prisma/client';

export interface LocalizedText {
  ru: string;
  en?: string;
}

export type EntityKind =
  | 'token'
  | 'note'
  | 'pattern'
  | 'sentence'
  | 'dialog'
  | 'lesson'
  | 'track';

export interface TokenInput {
  id: string;
  surface: string;
  reading: string;
  romaji: string;
  cyrillic: string;
  gloss: LocalizedText;
  type: TokenType;
  grammarNoteId?: string;
  synonymGroupId?: string;
}

export interface TokenRefInput {
  tokenId: string;
  slotType?: string;
  isFocusSlot?: boolean;
  before?: string;
  after?: string;
}

export interface SentenceInput {
  id: string;
  tokens: TokenRefInput[];
  translation: LocalizedText;
  romaji: string;
  cyrillicGuide: LocalizedText;
  patternId?: string;
  grammarNoteIds?: string[];
}

export interface GrammarBlockInput {
  summary?: LocalizedText;
  details?: LocalizedText[];
  examples?: unknown[];
}

export interface GrammarNoteInput {
  id: string;
  title?: LocalizedText;
  body: GrammarBlockInput[];
  deeper?: GrammarBlockInput[];
}

export interface PatternInput {
  id: string;
  explanation: LocalizedText;
  slotType: string;
  grammarNoteIds: string[];
}

export interface DialogInput {
  id: string;
  title: LocalizedText;
  turns: { speaker: Speaker; sentenceId: string }[];
}

type StepNotesInput = { grammarNoteIds?: string[] };

export type LessonStepInput = StepNotesInput &
  (
    | {
        kind: 'teach';
        sentenceId: string;
        patternId?: string;
        siblingSentenceIds?: string[];
      }
    | { kind: 'assemble'; sentenceId: string }
    | { kind: 'speak'; sentenceId: string }
    | { kind: 'listen'; sentenceId: string }
    | { kind: 'dialog'; dialogId: string }
  );

export interface LessonInput {
  id: string;
  trackId: string;
  title: LocalizedText;
  context: LocalizedText;
  version: number;
  position?: number;
  changelog?: unknown[];
  steps: LessonStepInput[];
}

export interface TrackInput {
  id: string;
  title: LocalizedText;
  description: LocalizedText;
  position?: number;
}

export interface ContentGraph {
  tokens: Map<string, TokenInput>;
  notes: Map<string, GrammarNoteInput>;
  patterns: Map<string, PatternInput>;
  sentences: Map<string, SentenceInput>;
  dialogs: Map<string, DialogInput>;
  lessons: Map<string, LessonInput>;
  tracks: Map<string, TrackInput>;
}

export interface Problem {
  level: 'error' | 'warning';
  message: string;
}

export interface OrphanReport {
  tokens: string[];
  notes: string[];
  patterns: string[];
  sentences: string[];
  dialogs: string[];
}

export interface AudioSlice {
  done: number;
  total: number;
  missing: string[];
}

export interface AudioReport {
  sentences: AudioSlice;
  tokens: AudioSlice;
}

export interface AudioItem {
  category: 'tokens' | 'sentences';
  id: string;
  voice: Voice;
  file: string;
  surface: string;
  reading: string;
  romaji: string;
  translation: string;
}

export interface AudioPlanOptions {
  voices?: Voice[];
  ids?: { tokens: string[]; sentences: string[] };
}

export interface AudioEntity {
  category: 'tokens' | 'sentences';
  id: string;
  surface: string;
  reading: string;
  romaji: string;
  translation: string;
  voices: Voice[];
}

export interface Reference {
  kind: string;
  owner: string;
  detail: string;
}
