import { skip } from '@prisma/client/runtime/library';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';

const c = {
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
};

const CONTENT_DIR = join(process.cwd(), 'content');
const AUDIO_DIR = join(process.cwd(), 'audio');
const VOICES = ['f', 'm'] as const;

interface Token {
  id: string;
  surface: string;
  reading: string;
  romaji: string;
  cyrillic: string;
  gloss: { ru: string };
}

interface Sentence {
  id: string;
  tokens: { tokenId: string }[];
  translation: { ru: string };
  romaji: string;
}

interface Bundle {
  tokens: Record<string, Token>;
  sentences: Record<string, Sentence>;
}

interface Manifest {
  tracks: { lessons: { id: string }[] }[];
}

const readJson = <T>(rel: string): T =>
  JSON.parse(readFileSync(join(CONTENT_DIR, rel), 'utf-8')) as T;

interface Item {
  type: 'words' | 'sentences';
  id: string;
  kana: string;
  surface: string;
  romaji: string;
  cyrillic: string;
  translation: string;
}

const missingVoices = (type: string, id: stirng): string[] =>
  VOICES.filter((v) => !existsSync(join(AUDIO_DIR, type, `${id}.${v}.mp3`)));

function collectItems(): Item[] {
  const manifest = readJson<Manifest>('manifest.json');
  const items: Item[] = [];
  const seen = new Set<string>();

  for (const track of manifest.tracks) {
    for (const lessonStub of track.lessons) {
      const bundle = readJson<Bundle>(`lessons/${lessonStub.id}.json`);

      for (const token of Object.values(bundle.tokens)) {
        if (seen.has(token.id)) {
          continue;
        }

        seen.add(token.id);
        items.push({
          type: 'words',
          id: token.id,
          kana: token.reading,
          surface: token.surface,
          romaji: token.romaji,
          cyrillic: token.cyrillic,
          translation: token.gloss.ru,
        });
      }

      for (const s of Object.values(bundle.sentences)) {
        const kana = s.tokens
          .map((ref) => bundle.tokens[ref.tokenId].reading)
          .join('');
        const surface = s.tokens
          .map((ref) => bundle.tokens[ref.tokenId].surface)
          .join('');

        items.push({
          type: 'sentences',
          id: s.id,
          kana,
          surface,
          romaji: s.romaji,
          cyrillic: '',
          translation: s.translation.ru,
        });
      }
    }
  }

  return items;
}

async function main() {
  const items = collectItems();
  const rl = createInterface({ input: stdin, output: stdout });
  let done = 0;
  let left = 0;

  for (const item of items) {
    const header = `${c.dim(item.type)} ${c.bold(item.surface)} ${c.dim(`[ ${item.kana} ]`)} ${item.romaji} – ${item.translation}`;
    const missing = missingVoices(item.type, item.id);

    if (missing.length === 0) {
      console.log(`${c.green('✓')} ${header} ${c.dim('– озвучен (m + f)')}`);
      done++;
      continue;
    }

    console.log('');
    console.log(`${c.yellow('●')} ${header}`);
    console.log(`   ${c.cyan('Вставь в TTS:')} ${c.bold(item.kana)}`);

    let skipped = false;

    for (;;) {
      const need = missingVoices(item.type, item.id);
      if (need.length === 0) {
        console.log(`   ${c.green('✓ оба файла на месте')}`);
        break;
      }

      for (const v of need) {
        console.log(
          `  ${c.dim('→ нужен файл')} audio/${item.type}/${item.id}.${v}.mp3`,
        );
      }

      const answer = await rl.question(
        `    ${c.dim('Enter — проверить · s — пропустить: ')}`,
      );
      if (answer.trim().toLowerCase() === 's') {
        skipped = true;
        break;
      }
    }

    if (skipped) {
      left++;
    } else {
      done++;
    }
  }

  rl.close();
  console.log(
    `\n${c.bold('Итого:')} ${c.green(`${done} готово`)}, ${c.yellow(`${left} осталось`)}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
