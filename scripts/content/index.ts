import { join } from 'node:path';
import pc from 'picocolors';
import { parseArgs } from 'node:util';
import { ContentGraph, Problem } from './types';
import { loadContentGraph } from './loader';
import { validate } from './validate';
import { audioStatus, findOrphans } from './report';

const CONTENT_DIR = join(process.cwd(), 'content');
const AUDIO_DIR = join(process.cwd(), 'audio');

function printHelp(): void {
  console.log(`
  ${pc.bold('wakaba content')} — управление учебным контентом

  ${pc.cyan('ИСПОЛЬЗОВАНИЕ')}
    npm run content -- <команда> [опции]

  ${pc.cyan('КОМАНДЫ')}
    check            Проверить контент (целостность, дубли, уникальность id). Без записи.
    status           Обзор: счётчики, сироты, аудио-пробелы. Без записи.

  ${pc.cyan('ОПЦИИ')}
    --help, -h       Показать эту справку.
  `);
}

function counts(graph: ContentGraph): void {
  const rows: [string, number][] = [
    ['токены', graph.tokens.size],
    ['заметки', graph.notes.size],
    ['паттерны', graph.patterns.size],
    ['предложения', graph.sentences.size],
    ['диалоги', graph.dialogs.size],
    ['уроки', graph.lessons.size],
    ['треки', graph.tracks.size],
  ];

  console.log(pc.cyan('\nКонтент'));

  for (const [label, n] of rows) {
    console.log(`  ${label.padEnd(12)} ${pc.bold(String(n))}`);
  }
}

function report(problems: Problem[]): number {
  const errors = problems.filter((p) => p.level === 'error');
  const warnings = problems.filter((p) => p.level === 'warning');

  for (const w of warnings) {
    console.log(`  ${pc.yellow('⚠')} ${w.message}`);
  }
  for (const e of errors) {
    console.log(`  ${pc.red('✗')} ${e.message}`);
  }

  console.log(
    `\n${errors.length === 0 ? pc.green('✔') : pc.red('✗')} ` +
      `Итог: ${errors.length} ошибок, ${warnings.length} предупреждений`,
  );

  return errors.length === 0 ? 0 : 1;
}

function runCheck(): number {
  console.log(pc.dim(`Проверка ${CONTENT_DIR}…`));
  const { graph, problems: loadProblems } = loadContentGraph(CONTENT_DIR);
  counts(graph);
  console.log('');

  return report([...loadProblems, ...validate(graph)]);
}

function runStatus(): number {
  const { graph, problems } = loadContentGraph(CONTENT_DIR);
  counts(graph);

  const o = findOrphans(graph);
  const orphanList = [
    ...o.tokens.map((id) => `token ${id}`),
    ...o.notes.map((id) => `note ${id}`),
    ...o.patterns.map((id) => `pattern ${id}`),
    ...o.sentences.map((id) => `sentence ${id}`),
    ...o.dialogs.map((id) => `dialog ${id}`),
  ];

  console.log(pc.cyan('\nСироты (не используются ни одним уроком)'));
  if (orphanList.length === 0) {
    console.log(pc.green('  нет'));
  } else {
    for (const item of orphanList) {
      console.log(`  ${pc.yellow('•')} ${item}`);
    }
  }

  const audio = audioStatus(graph, AUDIO_DIR);
  console.log(pc.cyan('\nАудио'));

  const line = (
    label: string,
    r: { done: number; total: number; missing: string[] },
  ) => {
    console.log(`  ${label}: ${pc.bold(`${r.done}/${r.total}`)}`);

    if (r.missing.length) {
      const shown = r.missing.slice(0, 8).join(', ');
      const more = r.missing.length > 8 ? ` (+${r.missing.length - 8})` : '';

      console.log(pc.dim(`    без аудио: ${shown}${more}`));
    }
  };

  line('предложения', audio.sentences);
  line('токены', audio.tokens);

  if (problems.length) {
    console.log('');
    report(problems);
  }

  return 0;
}

function main(): void {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: { help: { type: 'boolean', short: 'h' } },
  });

  const command = positionals[0];
  if (values.help || !command) {
    printHelp();

    return;
  }

  switch (command) {
    case 'check':
      process.exit(runCheck());
      break;
    case 'status':
      process.exit(runStatus());
      break;
    default:
      console.error(pc.red(`Неизвестная команда: ${command}`));
      printHelp();
      process.exit(1);
  }
}

main();
