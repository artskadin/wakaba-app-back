import pc from 'picocolors';
import { CONTENT_DIR, DEFAULT_BUNDLE_OUT } from '../config';
import { loadContentGraph } from '../loader';
import { report } from '../ui';
import { validate } from '../validate';
import { buildBundle, writeBundle } from '../bundle';

export function runBundle(values: { lesson?: string; out?: string }): number {
  const { graph, problems } = loadContentGraph(CONTENT_DIR);

  const all = [...problems, ...validate(graph)];
  if (all.some((p) => p.level === 'error')) {
    report(all);
    console.error(
      pc.red('\nЕсть ошибки — бандл не собран. Сначала почини (check).'),
    );

    return 1;
  }

  const lessonIds = values.lesson ? [values.lesson] : [...graph.lessons.keys()];
  const outDir = values.out ?? DEFAULT_BUNDLE_OUT;

  for (const id of lessonIds) {
    if (!graph.lessons.has(id)) {
      console.error(pc.red(`Нет урока: ${id}`));

      return 1;
    }

    const file = writeBundle(buildBundle(graph, id), outDir, id);
    console.log(`${pc.green('✓')} ${pc.bold(id)} → ${pc.dim(file)}`);
  }

  return 0;
}
