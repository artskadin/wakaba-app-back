import pc from 'picocolors';
import { ContentGraph, DiffResult, Problem } from './types';

export function counts(graph: ContentGraph): void {
  const rows: [string, number][] = [
    ['треки', graph.tracks.size],
    ['уроки', graph.lessons.size],
    ['токены', graph.tokens.size],
    ['предложения', graph.sentences.size],
    ['заметки', graph.notes.size],
    ['паттерны', graph.patterns.size],
    ['диалоги', graph.dialogs.size],
  ];

  console.log(pc.cyan('\nКонтент'));

  for (const [label, n] of rows) {
    console.log(`  ${label.padEnd(12)} ${pc.bold(String(n))}`);
  }
}

export function report(problems: Problem[]): number {
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

export function printPlan(result: DiffResult): number {
  const order: (keyof DiffResult)[] = [
    'tracks',
    'lessons',
    'tokens',
    'notes',
    'patterns',
    'sentences',
    'dialogs',
  ];

  let total = 0;

  for (const kind of order) {
    const d = result[kind];
    const n = d.create.length + d.update.length + d.remove.length;

    if (n === 0) {
      continue;
    }

    total += n;

    console.log(pc.cyan(`\n${kind}`));

    for (const id of d.create) {
      console.log(`  ${pc.green('+ создать')} ${id}`);
    }

    for (const id of d.update) {
      console.log(`  ${pc.yellow('~ обновить')} ${id}`);
    }

    for (const id of d.remove) {
      console.log(`  ${pc.red('- удалить')} ${id}`);
    }
  }

  // console.log(
  //   total === 0
  //     ? pc.green('\n✔ БД совпадает с content/ — применять нечего')
  //     : pc.dim(`\nвсего изменений: ${total}`),
  // );

  return total;
}
