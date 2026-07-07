import { existsSync } from 'node:fs';
import { ContentGraph } from './types';
import { join } from 'node:path';

function reachable(graph: ContentGraph) {
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

  for (const lesson of graph.lessons.values()) {
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

export interface OrphanReport {
  tokens: string[];
  notes: string[];
  patterns: string[];
  sentences: string[];
  dialogs: string[];
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

interface AudioSlice {
  done: number;
  total: number;
  missing: string[];
}

export interface AudioReport {
  sentences: AudioSlice;
  tokens: AudioSlice;
}

export function audioStatus(
  graph: ContentGraph,
  audioDir: string,
): AudioReport {
  const voices = ['m', 'f'];
  const check = (category: string, ids: string[]): AudioSlice => {
    const missing: string[] = [];
    let done = 0;

    for (const id of ids) {
      const ok = voices.every((v) =>
        existsSync(join(audioDir, category, `${id}.${v}.mp3`)),
      );
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
