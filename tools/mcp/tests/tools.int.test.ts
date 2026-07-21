import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'node:path';
import pg from 'pg';
import { provisionTestDb, type TestDb } from './db.setup';

const SERVER_PATH = path.resolve(process.cwd(), 'tools/mcp/db-readonly.ts');

let db: TestDb;
let client: Client;

async function call(name: string, args: Record<string, unknown> = {}) {
  const res = (await client.callTool({ name, arguments: args })) as {
    isError?: boolean;
    content: Array<{ type: string; text: string }>;
  };
  return { isError: res.isError ?? false, text: res.content[0]?.text ?? '' };
}

beforeAll(async () => {
  db = await provisionTestDb();

  client = new Client({ name: 'int-tests', version: '1.0.0' });
  await client.connect(
    new StdioClientTransport({
      command: 'npx',
      args: ['tsx', SERVER_PATH],
      env: {
        ...(process.env as Record<string, string>),
        WAKABA_RO_URL: db.agentDsn,
        WAKABA_ENCODER: 'fake',
      },
    }),
  );
}, 120_000);

afterAll(async () => {
  await client?.close();
  await db?.stop();
});

describe('search_content', () => {
  it('находит токен по русскому глоссу и показывает синоним-группу', async () => {
    const { text } = await call('search_content', { query: 'чай' });
    expect(text).toContain('ocha');
    expect(text).toContain('drink-tea-group');
  });

  it('по ромадзи-подстроке находит и токен, и фразы, и заметку', async () => {
    const { text } = await call('search_content', { query: 'hanase' });
    expect(text).toContain('tokens:');
    expect(text).toContain('hanasemasu');
    expect(text).toContain('sentences:');
    expect(text).toContain('ask-speak-english');
  });

  it('по иероглифу находит фразу через собранную поверхность', async () => {
    const { text } = await call('search_content', { query: '話' });
    expect(text).toContain('ask-speak-english');
  });

  it('на пустой результат отвечает подсказкой, а не пустотой', async () => {
    const { text } = await call('search_content', { query: 'ксилофон' });
    expect(text).toMatch(/не найдено/i);
  });
});

describe('where', () => {
  it('токен: карточка с note, использованием и лекциями', async () => {
    const { text } = await call('where', { id: 'hanasemasu' });
    expect(text).toContain('TOKEN hanasemasu');
    expect(text).toContain('potential');
    expect(text).toContain('ask-speak-english');
    expect(text).toContain('language-barrier');
  });

  it('токен-сирота честно помечен', async () => {
    const { text } = await call('where', { id: 'sake' });
    expect(text).toContain('⚠');
    expect(text).toContain('ocha');
  });

  it('фраза: токены по позициям, after-приклейка, дедупликация лекций', async () => {
    const { text } = await call('where', { id: 'ask-speak-english' });
    expect(text).toContain('[0] eigo');
    expect(text).toContain('after:"?"');
    expect(text).toContain('speak-language');
    expect(text).toContain('language-help');
    expect(text).not.toMatch(/language-barrier.*language-barrier/s);
    expect(text).toContain('в лекциях: language-barrier');
  });

  it('лекция: шаги по порядку с siblings и notes', async () => {
    const { text } = await call('where', { id: 'language-barrier' });
    expect(text).toContain('[0] teach: ask-speak-english');
    expect(text).toContain('siblings: 1');
    expect(text).toContain('[2] dialog: language-help');
  });

  it('неизвестный id → вежливое "не найден", а не падение', async () => {
    const { text } = await call('where', { id: 'no-such-id' });
    expect(text).toContain('не найден');
  });
});

describe('stats', () => {
  it('счётчики и сироты', async () => {
    const { text } = await call('stats');
    expect(text).toContain('tokens: 7');
    expect(text).toContain('lessons: 1');
    expect(text).toMatch(/токены вне фраз \(2\): ocha, sake/);
  });
});

describe('run_sql', () => {
  it('выполняет агрегацию и возвращает строки как JSON', async () => {
    const { text } = await call('run_sql', {
      sql: `SELECT count(*)::int AS n FROM "Token"`,
    });
    expect(text).toContain('"n":7');
  });

  it('отклоняет DELETE на уровне валидации', async () => {
    const { isError, text } = await call('run_sql', {
      sql: 'DELETE FROM "Token"',
    });
    expect(isError).toBe(true);
    expect(text).toMatch(/Только SELECT/);
  });

  it('отклоняет чтение пользовательских таблиц (регрессия RefreshToken)', async () => {
    const { isError, text } = await call('run_sql', {
      sql: 'SELECT "tokenHash" FROM "RefreshToken"',
    });
    expect(isError).toBe(true);
    expect(text).toMatch(/контент-скоуп/);
  });
});

describe('защита на уровне БД (мимо сервера)', () => {
  it('роль agent_ro не может писать даже прямым подключением', async () => {
    const direct = new pg.Client({ connectionString: db.agentDsn });
    await direct.connect();
    try {
      await expect(
        direct.query(`INSERT INTO "Track" (id, title, description, "updatedAt")
                      VALUES ('hack', '{}', '{}', now())`),
      ).rejects.toThrow(/read-only/);
    } finally {
      await direct.end();
    }
  });
});

describe('semantic_search (на FakeEncoder: проверяем механику, не семантику)', () => {
  it('тождественный текст находит свою сущность с similarity 1.000', async () => {
    const admin = new pg.Client({ connectionString: db.adminDsn });
    await admin.connect();
    const { rows } = await admin.query<{ text: string }>(
      `SELECT text FROM "ContentEmbedding" WHERE kind = 'token' AND "entityId" = 'ocha'`,
    );
    await admin.end();

    const { text } = await call('semantic_search', { query: rows[0].text });
    const topLine = text.split('\n')[1];

    expect(topLine).toContain('ocha');
    expect(topLine).toContain('1.000');
  });

  it('фильтр kind ограничивает выдачу', async () => {
    const { text } = await call('semantic_search', {
      query: 'что угодно',
      kind: 'lesson',
    });

    expect(text).toContain('[lesson]');
    expect(text).not.toContain('[token]');
  });

  it('индекс другой моделью => внятная ошибка с рецептом', async () => {
    const { isError } = await call('semantic_search', { query: 'чай' });

    expect(isError).toBe(false);
  });
});
