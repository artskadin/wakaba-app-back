import pc from 'picocolors';
import { ContentGraph, Problem } from './types';

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
