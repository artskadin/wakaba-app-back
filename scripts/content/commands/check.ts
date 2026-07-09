import pc from 'picocolors';
import { loadContentGraph } from '../loader';
import { counts, report } from '../ui';
import { validate } from '../validate';
import { CONTENT_DIR } from '../config';

export function runCheck(): number {
  console.log(pc.dim(`Проверка ${CONTENT_DIR}…`));
  const { graph, problems: loadProblems } = loadContentGraph(CONTENT_DIR);
  counts(graph);
  console.log('');

  return report([...loadProblems, ...validate(graph)]);
}
