import { createHash } from 'node:crypto';
import { createEncoder } from 'tools/mcp/encoder';
import pc from 'picocolors';
import pg from 'pg';
import { DbEnv } from '../db';

type Item = { id: string; text: string };

const SOURCES: Record<string, string> = {
  token: `SELECT id, concat_ws('; ', gloss->>'ru',
            concat(surface, ' (', reading, ', ', romaji, ')')) AS text
          FROM "Token"`,
  sentence: `SELECT s.id, concat_ws(' — ', s.translation->>'ru',
               concat((SELECT string_agg(coalesce(st.before,'') || tk.surface || coalesce(st.after,''), ''
                       ORDER BY st.position)
                  FROM "SentenceToken" st JOIN "Token" tk ON tk.id = st."tokenId"
                 WHERE st."sentenceId" = s.id), ' (', s.romaji, ')')) AS text
             FROM "Sentence" s`,
  note: `SELECT id, concat_ws('. ', title->>'ru',
           left(coalesce(body->>'ru', body::text), 400)) AS text
         FROM "GrammarNote"`,
  pattern: `SELECT id, concat(explanation->>'ru', ' [slot: ', "slotType", ']') AS text
            FROM "Pattern"`,
  lesson: `SELECT id, concat_ws('. ', title->>'ru', context->>'ru') AS text
           FROM "Lesson"`,
};

export async function runEmbed(env: DbEnv): Promise<number> {
  const url =
    env === 'prod'
      ? process.env.DATABASE_URL_PROD
      : process.env.DATABASE_URL_DEV;
  if (!url) {
    console.error(pc.red(`Не задан DATABASE_URL_${env.toUpperCase()}`));

    return 1;
  }

  const encoder = createEncoder();
  const db = new pg.Client({ connectionString: url });
  await db.connect();

  try {
    const { rows: models } = await db.query<{ model: string }>(
      `SELECT DISTINCT model FROM "ContentEmbedding"`,
    );
    if (models.length && models.some((m) => m.model !== encoder.model)) {
      console.log(
        `Смена модели (${models.map((m) => m.model).join(',')} → ${encoder.model}): полная переиндексация`,
      );

      await db.query(`TRUNCATE "ContentEmbedding"`);
    }

    for (const [kind, sql] of Object.entries(SOURCES)) {
      const { rows: items } = await db.query<Item>(sql);
      const { rows: existing } = await db.query<{
        entityId: string;
        textHash: string;
      }>(
        `SELECT "entityId", "textHash" FROM "ContentEmbedding" WHERE kind = $1`,
        [kind],
      );
      const known = new Map(existing.map((e) => [e.entityId, e.textHash]));

      const changed = items.filter(
        (item) => known.get(item.id) !== sha(item.text),
      );

      for (let i = 0; i < changed.length; i += 16) {
        const batch = changed.slice(i, i + 16);
        const vectors = await encoder.encode(batch.map((b) => b.text));

        for (let j = 0; j < batch.length; j++) {
          await db.query(
            `INSERT INTO "ContentEmbedding"
              (kind, "entityId", model, "textHash", text, embedding, "updatedAt")
            VALUES ($1, $2, $3, $4, $5, $6::vector, now())
            ON CONFLICT (kind, "entityId") DO UPDATE SET
              model = EXCLUDED.model, "textHash" = EXCLUDED."textHash",
              text = EXCLUDED.text, embedding = EXCLUDED.embedding, "updatedAt" = now()
          `,
            [
              kind,
              batch[j].id,
              encoder.model,
              sha(batch[j].text),
              batch[j].text,
              `[${vectors[j].join(',')}]`,
            ],
          );
        }
      }

      const liveIds = new Set(items.map((item) => item.id));
      const stale = [...known.keys()].filter((id) => !liveIds.has(id));

      if (stale.length) {
        await db.query(
          `DELETE FROM "ContentEmbedding" WHERE kind = $1 AND "entityId" = ANY($2)`,
          [kind, stale],
        );
      }

      console.log(
        `${kind}: всего ${items.length}, закодировано ${changed.length}, удалено ${stale.length}`,
      );
    }

    return 0;
  } finally {
    await db.end();
  }
}

function sha(s: string) {
  return createHash('sha256').update(s).digest('hex');
}
