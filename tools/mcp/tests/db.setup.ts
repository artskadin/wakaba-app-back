import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const REPO_ROOT = process.cwd();
const AGENT_ROLE = 'agent_ro';
const AGENT_PASSWORD = 'agent-test-password';

export interface TestDb {
  adminDsn: string;
  agentDsn: string;
  stop: () => Promise<void>;
}

export async function provisionTestDb(): Promise<TestDb> {
  let adminDsn = process.env.WAKABA_TEST_DSN;
  let stopContainer: () => Promise<void> = async () => {};

  if (!adminDsn) {
    const { PostgreSqlContainer } = await import('@testcontainers/postgresql');
    const container = await new PostgreSqlContainer(
      'pgvector/pgvector:pg16',
    ).start();

    adminDsn = container.getConnectionUri();

    stopContainer = async () => {
      await container.stop();
    };
  }

  {
    const ext = new pg.Client({ connectionString: adminDsn });
    await ext.connect();
    await ext.query('CREATE EXTENSION IF NOT EXISTS vector');
    await ext.end();
  }

  if (!process.env.WAKABA_TEST_SKIP_PUSH) {
    execSync('npx prisma db push --skip-generate', {
      cwd: REPO_ROOT,
      env: { ...process.env, DATABASE_URL_DEV: adminDsn },
      stdio: 'pipe',
    });
  }

  const admin = new pg.Client({ connectionString: adminDsn });

  await admin.connect();

  try {
    await admin.query(`
      DO $$ BEGIN
        CREATE ROLE ${AGENT_ROLE} LOGIN PASSWORD '${AGENT_PASSWORD}';
      EXCEPTION WHEN duplicate_object THEN
        ALTER ROLE ${AGENT_ROLE} PASSWORD '${AGENT_PASSWORD}';
      END $$;
    `);

    const dbName = new URL(adminDsn).pathname.slice(1);

    await admin.query(`GRANT CONNECT ON DATABASE "${dbName}" TO ${AGENT_ROLE}`);
    await admin.query(`GRANT USAGE ON SCHEMA public TO ${AGENT_ROLE}`);
    await admin.query(
      `GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${AGENT_ROLE}`,
    );
    await admin.query(
      `ALTER ROLE ${AGENT_ROLE} SET default_transaction_read_only = on`,
    );
    await admin.query(`ALTER ROLE ${AGENT_ROLE} SET statement_timeout = '5s'`);

    await admin.query(`
      TRUNCATE
        "Track","Lesson","LessonStep","LessonStepSibling","LessonStepGrammarNote",
        "Sentence","SentenceToken","SentencePattern","SentenceGrammarNote",
        "Token","GrammarNote","PatternGrammarNote","Pattern",
        "Dialog","DialogTurn","SynonymGroup","SynonymMember"
      CASCADE
    `);
    const seed = readFileSync(
      path.join(REPO_ROOT, 'tools/mcp/tests/fixtures/seed.sql'),
      'utf-8',
    );
    await admin.query(seed);
  } finally {
    await admin.end();
  }

  execSync('npx tsx scripts/content/index.ts embed', {
    cwd: REPO_ROOT,
    env: { ...process.env, DATABASE_URL_DEV: adminDsn, WAKABA_ENCODER: 'fake' },
    stdio: 'pipe',
  });

  const u = new URL(adminDsn);
  u.username = AGENT_ROLE;
  u.password = AGENT_PASSWORD;

  return { adminDsn, agentDsn: u.toString(), stop: stopContainer };
}
