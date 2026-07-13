import pc from 'picocolors';
import { CONTENT_DIR } from '../config';
import { loadContentGraph } from '../loader';
import { printPlan, report } from '../ui';
import { validate } from '../validate';
import { readDbAsGraph } from '../store';
import { diffSnapshots } from '../diff';
import { snapshot } from '../snapshot';
import { DbEnv, makePrisma } from '../db';

export async function runDiff(env: DbEnv): Promise<number> {
  const { graph, problems } = loadContentGraph(CONTENT_DIR);

  const all = [...problems, ...validate(graph)];

  if (all.some((p) => p.level === 'error')) {
    report(all);
    console.error(
      pc.red(
        '\nЕсть ошибки — сравнение неинформативно. Сначала почини (check).',
      ),
    );

    return 1;
  }

  const prisma = makePrisma(env);
  console.log(pc.dim(`БД: ${env}`));

  try {
    const total = printPlan(
      diffSnapshots(snapshot(graph), snapshot(await readDbAsGraph(prisma))),
    );

    console.log(
      total === 0
        ? pc.green('\n✔ БД совпадает с content/')
        : pc.dim(`\nвсего изменений: ${total}`),
    );

    return 0;
  } finally {
    await prisma.$disconnect();
  }
}
