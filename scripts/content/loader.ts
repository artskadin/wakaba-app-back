import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  ContentGraph,
  DialogInput,
  GrammarNoteInput,
  LessonInput,
  PatternInput,
  Problem,
  SentenceInput,
  TokenInput,
  TrackInput,
} from './types';

function collectFiles(dir: string, name: string): string[] {
  const filePath = join(dir, `${name}.json`);
  if (existsSync(filePath)) {
    return [filePath];
  }

  const folderPath = join(dir, name);
  if (existsSync(folderPath) && statSync(folderPath).isDirectory()) {
    return readdirSync(folderPath, { recursive: true })
      .map(String)
      .filter((f) => f.endsWith('.json'))
      .map((f) => join(folderPath, f));
  }

  return [];
}

function readJson(path: string): { data?: unknown; problem?: Problem } {
  try {
    return { data: JSON.parse(readFileSync(path, 'utf-8')) };
  } catch (e) {
    return {
      problem: {
        level: 'error',
        message: `Битый JSON в ${path}: ${(e as Error).message}`,
      },
    };
  }
}

function loadMap<T extends { id: string }>(
  dir: string,
  name: string,
  label: string,
): { map: Map<string, T>; problems: Problem[] } {
  const map = new Map<string, T>();
  const source = new Map<string, string>();
  const problems: Problem[] = [];

  for (const file of collectFiles(dir, name)) {
    const obj = readJson(file) as Record<string, T>;

    for (const [key, entity] of Object.entries(obj)) {
      if (entity.id !== key) {
        problems.push({
          level: 'error',
          message: `${label} "${key}": ключ не совпадает с полем id ("${entity.id}") в ${file}`,
        });
      }

      if (map.has(key)) {
        problems.push({
          level: 'error',
          message: `Дубль ${label} "${key}": в ${source.get(key)} и в ${file}`,
        });
        continue;
      }

      map.set(key, entity);
      source.set(key, file);
    }
  }

  return { map, problems };
}

function loadLesson(dir: string): {
  map: Map<string, LessonInput>;
  problems: Problem[];
} {
  const map = new Map<string, LessonInput>();
  const source = new Map<string, string>();
  const problems: Problem[] = [];

  for (const file of collectFiles(dir, 'lessons')) {
    const lesson = readJson(file) as LessonInput;
    if (map.has(lesson.id)) {
      problems.push({
        level: 'error',
        message: `Дубль урока "${lesson.id}": в ${source.get(lesson.id)} и в ${file}`,
      });
      continue;
    }

    map.set(lesson.id, lesson);
    source.set(lesson.id, file);
  }

  return { map, problems };
}

function loadTracks(dir: string): {
  map: Map<string, TrackInput>;
  problems: Problem[];
} {
  const map = new Map<string, TrackInput>();
  const problems: Problem[] = [];

  const filePath = join(dir, 'tracks.json');
  if (!existsSync(filePath)) {
    problems.push({ level: 'error', message: 'Не найден tracks.json' });

    return { map, problems };
  }

  const tracks = readJson(filePath) as TrackInput[];

  for (const track of tracks) {
    if (map.has(track.id)) {
      problems.push({
        level: 'error',
        message: `Дубль трека "${track.id}" в tracks.json`,
      });
      continue;
    }

    map.set(track.id, track);
  }

  return { map, problems };
}

export function loadContentGraph(dir: string): {
  graph: ContentGraph;
  problems: Problem[];
} {
  const problems: Problem[] = [];

  const collect = <T>(r: { map: Map<string, T>; problems: Problem[] }) => {
    problems.push(...r.problems);

    return r.map;
  };

  const graph: ContentGraph = {
    tokens: collect(loadMap<TokenInput>(dir, 'tokens', 'токена')),
    notes: collect(loadMap<GrammarNoteInput>(dir, 'grammar-notes', 'заметки')),
    patterns: collect(loadMap<PatternInput>(dir, 'patterns', 'паттерна')),
    sentences: collect(loadMap<SentenceInput>(dir, 'sentences', 'предложения')),
    dialogs: collect(loadMap<DialogInput>(dir, 'dialogs', 'диалога')),
    lessons: collect(loadLesson(dir)),
    tracks: collect(loadTracks(dir)),
  };

  return { graph, problems };
}
