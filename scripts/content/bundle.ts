import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { reachable } from './report';
import { ContentGraph, LessonInput } from './types';

function bundleLesson(l: LessonInput) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { position: _position, ...rest } = l;

  return { ...rest, changelog: l.changelog ?? [] };
}

function picked<T>(
  pool: Map<string, T>,
  ids: Set<string>,
  map: (v: T) => unknown = (v) => v,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const id of ids) {
    const v = pool.get(id);

    if (v !== undefined) {
      out[id] = map(v);
    }
  }

  return out;
}

export function buildBundle(graph: ContentGraph, lessonId: string) {
  const lesson = graph.lessons.get(lessonId);

  if (!lesson) {
    throw new Error(`Lesson not found: ${lessonId}`);
  }

  const reach = reachable(graph, [lesson]);

  return {
    lesson: bundleLesson(lesson),
    tokens: picked(graph.tokens, reach.tokens),
    grammarNotes: picked(graph.notes, reach.notes),
    patterns: picked(graph.patterns, reach.patterns),
    sentences: picked(graph.sentences, reach.sentences),
    dialogs: picked(graph.dialogs, reach.dialogs),
  };
}

export function writeBundle(
  bundle: unknown,
  outDir: string,
  lessonId: string,
): string {
  mkdirSync(outDir, { recursive: true });

  const file = join(outDir, `${lessonId}.json`);
  writeFileSync(file, JSON.stringify(bundle, null, 2) + '\n');

  return file;
}
