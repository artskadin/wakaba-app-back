import pc from 'picocolors';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { Voice } from '@prisma/client';
import { isAbort } from 'helpers/is-abort';
import { AudioEntity, AudioItem, ContentGraph, LessonInput } from '../types';
import { hasAudio, planAudio, reachable, VOICES } from '../report';
import { AUDIO_DIR, CONTENT_DIR } from '../config';
import { loadContentGraph } from '../loader';
import { report } from '../ui';

function toEntity(items: AudioItem[]): AudioEntity[] {
  const map = new Map<string, AudioEntity>();

  for (const item of items) {
    const key = `${item.category}/${item.id}`;
    const found = map.get(key);

    if (found) {
      found.voices.push(item.voice);
    } else {
      const { category, id, surface, reading, romaji, translation } = item;
      map.set(key, {
        category,
        id,
        surface,
        reading,
        romaji,
        translation,
        voices: [item.voice],
      });
    }
  }

  return [...map.values()];
}

function printCard(e: AudioEntity, prefix = ''): void {
  console.log(
    `  ${pc.yellow('●')} ${pc.bold(e.surface)}  ${pc.dim(`[ ${e.reading} ]`)}  ${pc.cyan(e.romaji)}`,
  );
  console.log(`    ${e.translation}`);
  if (prefix) {
    console.log(prefix);
  }
}

function printAudioList(entities: AudioEntity[]): void {
  console.log(pc.cyan(`\nНужно записать — ${entities.length} шт.`));

  for (const cat of ['tokens', 'sentences'] as const) {
    const list = entities.filter((e) => e.category === cat);

    if (list.length === 0) {
      continue;
    }

    console.log(
      pc.bold(
        pc.cyan(
          `\n${cat === 'tokens' ? 'ТОКЕНЫ' : 'ПРЕДЛОЖЕНИЯ'} (${list.length})`,
        ),
      ),
    );

    for (const e of list) {
      console.log('');
      printCard(
        e,
        `    ${pc.dim(`audio/${e.category}/${e.id}`)} ${pc.dim('— голоса:')} ${e.voices.join(', ')}`,
      );
    }
  }

  console.log('');
}

async function runAudioInteractive(
  entities: AudioEntity[],
  voices: Voice[],
): Promise<number> {
  const rl = createInterface({ input: stdin, output: stdout });
  let recorded = 0;
  let skipped = 0;

  try {
    for (const [i, e] of entities.entries()) {
      console.log('');
      console.log(pc.dim(`— ${i + 1}/${entities.length} —`));
      printCard(e);
      console.log(`    ${pc.cyan('В TTS:')} ${pc.bold(e.reading)}`);

      let skip = false;

      for (;;) {
        const need = voices.filter(
          (v) => !hasAudio(AUDIO_DIR, e.category, e.id, v),
        );

        if (need.length === 0) {
          console.log(`    ${pc.green('✓ записано')}`);
          break;
        }

        for (const v of need) {
          console.log(
            `    ${pc.dim('→ нужен')} audio/${e.category}/${e.id}.${v}.mp3`,
          );
        }

        const answer = await rl.question(
          `    ${pc.dim('Enter — проверить · s — пропустить: ')}`,
        );
        if (answer.trim().toLowerCase() === 's') {
          skip = true;
          break;
        }
      }

      if (skip) {
        skipped++;
      } else {
        recorded++;
      }
    }
  } catch (err) {
    if (isAbort(err)) {
      console.log(pc.dim('\nПрервано.'));

      return 130;
    }

    throw err;
  } finally {
    rl.close();
  }

  console.log(
    `\n${pc.bold('Итого:')} ${pc.green(`${recorded} готово`)}, ${pc.yellow(`${skipped} осталось`)}`,
  );

  return 0;
}

function parseVoices(v?: string): Voice[] | undefined {
  if (!v) {
    return undefined;
  }

  const valid = v
    .split(',')
    .map((s) => s.trim())
    .filter((x): x is Voice => (VOICES as readonly string[]).includes(x));

  return valid.length ? valid : undefined;
}

function scopeIds(
  graph: ContentGraph,
  sel: { lesson?: string; track?: string },
): { tokens: string[]; sentences: string[] } | undefined {
  if (!sel.lesson && !sel.track) {
    return undefined;
  }

  const lessons: LessonInput[] = [];

  if (sel.lesson) {
    const l = graph.lessons.get(sel.lesson);
    if (l) {
      lessons.push(l);
    }
  }

  if (sel.track) {
    for (const l of graph.lessons.values()) {
      if (l.trackId === sel.track) {
        lessons.push(l);
      }
    }
  }

  const reach = reachable(graph, lessons);
  return { tokens: [...reach.tokens], sentences: [...reach.sentences] };
}

export async function runAudio(values: {
  voice?: string;
  lesson?: string;
  track?: string;
  interactive?: boolean;
}): Promise<number> {
  const { graph, problems } = loadContentGraph(CONTENT_DIR);

  const voices = parseVoices(values.voice) ?? [...VOICES];
  const ids = scopeIds(graph, { lesson: values.lesson, track: values.track });
  const entities = toEntity(planAudio(graph, AUDIO_DIR, { voices, ids }));

  if (entities.length === 0) {
    console.log(pc.green('Все аудиофайлы на месте.'));

    return 0;
  }

  if (values.interactive) {
    return runAudioInteractive(entities, voices);
  }

  printAudioList(entities);

  if (problems.length) {
    console.log('');
    report(problems);
  }

  return 0;
}
