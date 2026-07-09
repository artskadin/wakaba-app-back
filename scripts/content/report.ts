import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  AudioItem,
  AudioPlanOptions,
  AudioReport,
  AudioSlice,
  ContentGraph,
  EntityKind,
  LessonInput,
  OrphanReport,
  Reference,
} from './types';

export const VOICES = ['m', 'f'] as const;

export function hasAudio(
  audioDir: string,
  category: string,
  id: string,
  voice: string,
): boolean {
  return existsSync(join(audioDir, category, `${id}.${voice}.mp3`));
}

export function reachable(
  graph: ContentGraph,
  lessons: Iterable<LessonInput> = graph.lessons.values(),
) {
  const sentences = new Set<string>();
  const dialogs = new Set<string>();
  const patterns = new Set<string>();
  const notes = new Set<string>();
  const tokens = new Set<string>();

  const addSentence = (sid: string) => {
    if (!graph.sentences.has(sid) || sentences.has(sid)) return;

    sentences.add(sid);

    const s = graph.sentences.get(sid)!;

    for (const ref of s.tokens) {
      tokens.add(ref.tokenId);
    }

    if (s.patternId) {
      patterns.add(s.patternId);
    }

    for (const nid of s.grammarNoteIds ?? []) {
      notes.add(nid);
    }
  };

  for (const lesson of lessons) {
    for (const step of lesson.steps) {
      if (step.kind === 'dialog') {
        if (graph.dialogs.has(step.dialogId)) {
          dialogs.add(step.dialogId);

          for (const turn of graph.dialogs.get(step.dialogId)!.turns) {
            addSentence(turn.sentenceId);
          }
        }
      } else {
        addSentence(step.sentenceId);
      }

      if (step.kind === 'teach') {
        if (step.patternId) {
          patterns.add(step.patternId);
        }

        for (const sid of step.siblingSentenceIds ?? []) {
          addSentence(sid);
        }
      }

      for (const nid of step.grammarNoteIds ?? []) {
        notes.add(nid);
      }
    }
  }

  for (const tid of tokens) {
    const gid = graph.tokens.get(tid)?.grammarNoteId;
    if (gid) {
      notes.add(gid);
    }
  }

  for (const pid of patterns) {
    for (const nid of graph.patterns.get(pid)?.grammarNoteIds ?? []) {
      notes.add(nid);
    }
  }

  return { tokens, notes, patterns, sentences, dialogs };
}

export function findOrphans(graph: ContentGraph): OrphanReport {
  const reach = reachable(graph);
  const minus = (all: Iterable<string>, keep: Set<string>) =>
    [...all].filter((id) => !keep.has(id));

  return {
    tokens: minus(graph.tokens.keys(), reach.tokens),
    notes: minus(graph.notes.keys(), reach.notes),
    patterns: minus(graph.patterns.keys(), reach.patterns),
    sentences: minus(graph.sentences.keys(), reach.sentences),
    dialogs: minus(graph.dialogs.keys(), reach.dialogs),
  };
}

export function audioStatus(
  graph: ContentGraph,
  audioDir: string,
): AudioReport {
  const check = (category: string, ids: string[]): AudioSlice => {
    const missing: string[] = [];
    let done = 0;

    for (const id of ids) {
      const ok = VOICES.every((v) => hasAudio(audioDir, category, id, v));

      if (ok) {
        done++;
      } else {
        missing.push(id);
      }
    }

    return { done, total: ids.length, missing };
  };

  return {
    sentences: check('sentences', [...graph.sentences.keys()]),
    tokens: check('tokens', [...graph.tokens.keys()]),
  };
}

interface AudioMeta {
  surface: string;
  reading: string;
  romaji: string;
  translation: string;
}

function tokenMeta(graph: ContentGraph, id: string): AudioMeta {
  const t = graph.tokens.get(id);

  return {
    surface: t?.surface ?? id,
    reading: t?.reading ?? '',
    romaji: t?.romaji ?? '',
    translation: t?.gloss.ru ?? '',
  };
}

function sentenceMeta(graph: ContentGraph, id: string): AudioMeta {
  const s = graph.sentences.get(id);
  if (!s) {
    return { surface: id, reading: '', romaji: '', translation: '' };
  }

  const glue = (pick: (tokenId: string) => string) =>
    s.tokens
      .map((ref) => `${ref.before ?? ''}${pick(ref.tokenId)}${ref.after ?? ''}`)
      .join('');

  return {
    surface: glue((tid) => graph.tokens.get(tid)?.surface ?? ''),
    reading: glue((tid) => graph.tokens.get(tid)?.reading ?? ''),
    romaji: s.romaji,
    translation: s.translation.ru,
  };
}

export function planAudio(
  graph: ContentGraph,
  audioDir: string,
  opts: AudioPlanOptions = {},
): AudioItem[] {
  const voices = opts.voices ?? [...VOICES];
  const items: AudioItem[] = [];

  const collect = (
    category: 'tokens' | 'sentences',
    ids: string[],
    meta: (id: string) => AudioMeta,
  ) => {
    for (const id of ids) {
      const m = meta(id);

      for (const voice of voices) {
        if (hasAudio(audioDir, category, id, voice)) {
          continue;
        }

        items.push({
          category,
          id,
          voice,
          file: `${category}/${id}.${voice}.mp3`,
          ...m,
        });
      }
    }
  };

  collect('tokens', opts.ids?.tokens ?? [...graph.tokens.keys()], (id) =>
    tokenMeta(graph, id),
  );
  collect(
    'sentences',
    opts.ids?.sentences ?? [...graph.sentences.keys()],
    (id) => sentenceMeta(graph, id),
  );

  return items;
}

export function identify(
  graph: ContentGraph,
  id: string,
): { kind: EntityKind; label: string } | undefined {
  const t = graph.tokens.get(id);
  if (t) {
    return { kind: 'token', label: `${t.surface} – ${t.gloss.ru}` };
  }

  const n = graph.notes.get(id);
  if (n) {
    return { kind: 'note', label: n.title?.ru ?? '(без заголовка)' };
  }

  const p = graph.patterns.get(id);
  if (p) {
    return { kind: 'pattern', label: p.explanation.ru };
  }

  const s = graph.sentences.get(id);
  if (s) {
    return { kind: 'sentence', label: s.translation.ru };
  }

  const d = graph.dialogs.get(id);
  if (d) {
    return { kind: 'dialog', label: d.title.ru };
  }

  const l = graph.lessons.get(id);
  if (l) {
    return { kind: 'lesson', label: l.title.ru };
  }

  const tr = graph.tracks.get(id);
  if (tr) {
    return { kind: 'track', label: tr.title.ru };
  }

  return undefined;
}

export function findReferences(graph: ContentGraph, id: string): Reference[] {
  const refs: Reference[] = [];
  const add = (kind: string, owner: string, detail: string) =>
    refs.push({ kind, owner, detail });

  for (const [tid, t] of graph.tokens) {
    if (t.grammarNoteId === id) {
      add('token', tid, 'grammarNoteId');
    }
  }

  for (const [pid, p] of graph.patterns) {
    if (p.grammarNoteIds.includes(id)) {
      add('pattern', pid, 'grammarNoteIds');
    }
  }

  for (const [sid, s] of graph.sentences) {
    if (s.tokens.some((r) => r.tokenId === id)) {
      add('sentence', sid, 'tokens');
    }

    if (s.patternId === id) {
      add('sentence', sid, 'patternId');
    }

    if (s.grammarNoteIds?.includes(id)) {
      add('sentence', sid, 'grammarNoteIds');
    }
  }

  for (const [did, d] of graph.dialogs) {
    if (d.turns.some((turn) => turn.sentenceId === id)) {
      add('dialog', did, 'turns');
    }
  }

  for (const [lid, l] of graph.lessons) {
    if (l.trackId === id) {
      add('lesson', lid, 'trackId');
    }

    l.steps.forEach((st, i) => {
      const at = `step[${i}]`;

      if ('sentenceId' in st && st.sentenceId === id) {
        add('lesson', lid, `${at}.sentenceId`);
      }

      if ('dialogId' in st && st.dialogId === id) {
        add('lesson', lid, `${at}.dialogId`);
      }

      if (st.kind === 'teach') {
        if (st.patternId === id) {
          add('lesson', lid, `${at}.patternId`);
        }

        if (st.siblingSentenceIds?.includes(id)) {
          add('lesson', lid, `${at}.sibling`);
        }
      }

      if (st.grammarNoteIds?.includes(id)) {
        add('lesson', lid, `${at}.grammarNoteIds`);
      }
    });
  }

  return refs;
}
