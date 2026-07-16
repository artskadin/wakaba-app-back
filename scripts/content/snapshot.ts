import {
  ContentGraph,
  DialogInput,
  GrammarNoteInput,
  LessonInput,
  LessonStepInput,
  PatternInput,
  SentenceInput,
  Snapshot,
  TokenInput,
  TokenRefInput,
  TrackInput,
} from './types';

export function stableStringify(value: unknown): string {
  const sort = (v: unknown): unknown => {
    if (Array.isArray(v)) {
      return v.map(sort);
    }

    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;

      return Object.fromEntries(
        Object.keys(o)
          .sort()
          .map((k) => [k, sort(o[k])]),
      );
    }

    return v;
  };

  return JSON.stringify(sort(value));
}

export function snapshot(graph: ContentGraph): Snapshot {
  const build = <T>(pool: Map<string, T>, norm: (v: T) => unknown) => {
    const m = new Map<string, unknown>();
    for (const [id, v] of pool) m.set(id, norm(v));
    return m;
  };
  return {
    tokens: build(graph.tokens, normToken),
    notes: build(graph.notes, normNote),
    patterns: build(graph.patterns, normPattern),
    sentences: build(graph.sentences, normSentence),
    dialogs: build(graph.dialogs, normDialog),
    lessons: build(graph.lessons, normLesson),
    tracks: build(graph.tracks, normTrack),
  };
}

const normTokenRef = (r: TokenRefInput) => ({
  tokenId: r.tokenId,
  ...(r.before ? { before: r.before } : {}),
  ...(r.after ? { after: r.after } : {}),
});

const normStep = (st: LessonStepInput) => {
  const o: Record<string, unknown> = { kind: st.kind };

  if ('sentenceId' in st) {
    o.sentenceId = st.sentenceId;
  }
  if ('dialogId' in st) {
    o.dialogId = st.dialogId;
  }
  if (st.kind === 'teach') {
    if (st.patternId) {
      o.patternId = st.patternId;
    }
    if (st.siblingSentenceIds?.length) {
      o.siblingSentenceIds = st.siblingSentenceIds;
    }
  }
  if (st.grammarNoteIds?.length) {
    o.grammarNoteIds = st.grammarNoteIds;
  }

  return o;
};

const normToken = (t: TokenInput) => ({
  id: t.id,
  surface: t.surface,
  reading: t.reading,
  romaji: t.romaji,
  cyrillic: t.cyrillic,
  gloss: t.gloss,
  type: t.type,
  ...(t.grammarNoteId ? { grammarNoteId: t.grammarNoteId } : {}),
  ...(t.synonymGroupId ? { synonymGroupId: t.synonymGroupId } : {}),
});

const normNote = (n: GrammarNoteInput) => ({
  id: n.id,
  body: n.body,
  ...(n.title ? { title: n.title } : {}),
  ...(n.deeper ? { deeper: n.deeper } : {}),
});

const normPattern = (p: PatternInput) => ({
  id: p.id,
  explanation: p.explanation,
  slotType: p.slotType,
  ...(p.grammarNoteIds.length ? { grammarNoteIds: p.grammarNoteIds } : {}),
});

const normSentence = (s: SentenceInput) => ({
  id: s.id,
  tokens: s.tokens.map(normTokenRef),
  translation: s.translation,
  romaji: s.romaji,
  cyrillicGuide: s.cyrillicGuide,
  ...(s.patterns?.length
    ? {
        patterns: [...s.patterns].sort((a, b) =>
          a.patternId.localeCompare(b.patternId),
        ),
      }
    : {}),
  ...(s.grammarNoteIds?.length ? { grammarNoteIds: s.grammarNoteIds } : {}),
});

const normDialog = (d: DialogInput) => ({
  id: d.id,
  title: d.title,
  turns: d.turns.map((t) => ({ speaker: t.speaker, sentenceId: t.sentenceId })),
});

const normLesson = (l: LessonInput) => ({
  id: l.id,
  trackId: l.trackId,
  title: l.title,
  context: l.context,
  version: l.version,
  position: l.position ?? 0,
  changelog: l.changelog ?? [],
  steps: l.steps.map(normStep),
});

const normTrack = (t: TrackInput) => ({
  id: t.id,
  title: t.title,
  description: t.description,
  position: t.position ?? 0,
});
