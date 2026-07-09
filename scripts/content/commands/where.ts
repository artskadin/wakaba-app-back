import pc from 'picocolors';
import { CONTENT_DIR } from '../config';
import { loadContentGraph } from '../loader';
import { findReferences, identify } from '../report';

export function runWhere(id: string | undefined): number {
  if (!id) {
    console.error(pc.red('Укажи id: npm run content -- where <id>'));

    return 1;
  }

  const { graph } = loadContentGraph(CONTENT_DIR);

  const found = identify(graph, id);
  if (!found) {
    console.error(pc.red(`Не найдено: ${id}`));

    return 1;
  }

  console.log(
    `${pc.bold(id)} ${pc.dim('—')} ${pc.cyan(found.kind)}  ${pc.dim(found.label)}`,
  );

  const refs = findReferences(graph, id);
  if (refs.length === 0) {
    console.log(pc.dim('  на него никто не ссылается'));

    return 0;
  }

  console.log(pc.dim(`  ссылок: ${refs.length}`));
  for (const r of refs) {
    console.log(
      `  ${pc.yellow('←')} ${r.kind} ${pc.bold(r.owner)} ${pc.dim(r.detail)}`,
    );
  }

  return 0;
}
