import pc from 'picocolors';
import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { loadContentGraph } from '../loader';
import { CONTENT_DIR } from '../config';
import { validate } from '../validate';
import { printPlan, report } from '../ui';
import { diffSnapshots } from '../diff';
import { snapshot } from '../snapshot';
import { readDbAsGraph } from '../store';
import { DbEnv, makePrisma } from '../db';
import { Applier } from '../applier';

type Mode = 'all' | 'creates' | 'none';

export async function runApply(
  values: {
    yes?: boolean;
    'dry-run'?: boolean;
  },
  env: DbEnv,
): Promise<number> {
  const { graph, problems } = loadContentGraph(CONTENT_DIR);

  const all = [...problems, ...validate(graph)];

  if (all.some((p) => p.level === 'error')) {
    report(all);
    console.error(
      pc.red('\nЕсть ошибки — ничего не применяю. Сначала почини (check).'),
    );

    return 1;
  }

  const prisma = makePrisma(env);

  try {
    const plan = diffSnapshots(
      snapshot(graph),
      snapshot(await readDbAsGraph(prisma)),
    );
    const total = printPlan(plan);

    if (total === 0) {
      console.log(pc.green('\n✔ БД уже совпадает — применять нечего'));

      return 0;
    }

    if (values['dry-run']) {
      console.log(pc.dim('\n--dry-run: ничего не записано'));

      return 0;
    }

    const mode: Mode = values.yes ? 'all' : await confirm();
    if (mode === 'none') {
      console.log(pc.dim('Отменено.'));

      return 0;
    }

    await prisma.$transaction((tx) => new Applier(tx).run(graph, plan, mode));

    console.log(pc.green('\n✔ Применено.'));
    console.log(
      pc.dim(
        'Тексты могли измениться — обнови индекс: npm run content -- embed',
      ),
    );

    return 0;
  } finally {
    await prisma.$disconnect();
  }
}

async function confirm(): Promise<Mode> {
  const rl = createInterface({ input: stdin, output: stdout });

  try {
    const a = (
      await rl.question('\nПрименить? [a]ll · [c]reates-only · [n]o: ')
    )
      .trim()
      .toLowerCase();

    if (a === 'a' || a === 'all') {
      return 'all';
    }

    if (a === 'c' || a === 'creates') {
      return 'creates';
    }

    return 'none';
  } finally {
    rl.close();
  }
}
