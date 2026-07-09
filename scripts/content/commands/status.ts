import pc from 'picocolors';
import { AUDIO_DIR, CONTENT_DIR } from '../config';
import { loadContentGraph } from '../loader';
import { counts, report } from '../ui';
import { audioStatus, findOrphans } from '../report';

export function runStatus(): number {
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
