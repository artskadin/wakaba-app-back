/**
 * Wakaba DB MCP — read-only доступ авторинг-чатов к контенту в Postgres.
 *
 * Запуск:  WAKABA_RO_URL=postgresql://agent_ro:...@localhost:5433/wakaba tsx db-readonly.ts
 *
 * Инструменты спроектированы вокруг вопросов авторинг-флоу (см. AUTHORING.md),
 * а не вокруг таблиц:
 *   search_content — "есть ли уже что-то про X?" (поиск по всем типам сразу)
 *   where          — аналог `npm run content -- where <id>`, но над БД и с полной карточкой
 *   stats          — аналог `content -- status`: счётчики + сироты
 *   run_sql        — произвольный SELECT для аналитики (двойная защита read-only)
 *
 * Безопасность двухслойная: сервер не содержит пишущих операций, а роль
 * agent_ro на уровне БД имеет только SELECT + default_transaction_read_only.
 */

import pg from 'pg';
import * as z from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type {
  Token,
  Sentence,
  GrammarNote,
  Pattern,
  Dialog,
  Lesson,
  Track,
  SynonymGroup,
  Register,
  StepKind,
  Speaker,
} from '@prisma/client';

const DSN = process.env.WAKABA_RO_URL;
if (!DSN) {
  console.error(
    'WAKABA_RO_URL env var is required (postgresql://agent_ro:...@host:port/db)',
  );
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DSN, max: 3 });

const server = new McpServer({ name: 'wakaba-db', version: '1.0.0' });

async function main() {
  await pool.query('SELECT 1');
  await server.connect(new StdioServerTransport());
  console.error('wakaba-db MCP started (read-only)');
}

const SURFACE_SQL = `(
  SELECT string_agg(coalesce(st.before,'') || tk.surface || coalesce(st.after,''), '' ORDER BY st.position)
    FROM "SentenceToken" st
    JOIN "Token" tk ON tk.id = st."tokenId"
    WHERE st."sentenceId" = s.id
)`;

const SENTENCE_LESSONS_SQL = `
  SELECT ls."sentenceId" AS sid, l.id AS lesson_id
    FROM "LessonStep" ls
    JOIN "Lesson" l ON l.id = ls."lessonId"
    WHERE ls."sentenceId" = ANY($1)
  UNION
  SELECT sib."sentenceId", l.id
    FROM "LessonStepSibling" sib
    JOIN "LessonStep" ls ON ls.id = sib."lessonStepId"
    JOIN "Lesson" l ON l.id = ls."lessonId"
    WHERE sib."sentenceId" = ANY($1)
  UNION
  SELECT dt."sentenceId", l.id
    FROM "DialogTurn" dt
    JOIN "LessonStep" ls ON ls."dialogId" = dt."dialogId"
    JOIN "Lesson" l ON l.id = ls."lessonId"
    WHERE dt."sentenceId" = ANY($1)
  `;

// ============================================================
// search_content — "есть ли уже что-то про X?"
// ============================================================
server.registerTool(
  'search_content',
  {
    title: 'Search all content',
    description:
      'Search Wakaba content DB (approved content) across tokens, sentences, grammar notes, patterns and lessons at once. ' +
      'Matches substrings case-insensitively in ids, Japanese surface/reading, romaji, cyrillic and Russian text. ' +
      'Use before creating new content to check what already exists. Returns content ids usable with the `where` tool.',
    inputSchema: {
      query: z
        .string()
        .min(1)
        .describe(
          'Substring: russian ("чай"), romaji ("hanase"), surface ("話"), or id part',
        ),
      limit: z
        .number()
        .int()
        .min(1)
        .max(30)
        .optional()
        .describe('Max results per kind, default 8'),
    },
  },
  async ({ query, limit }) => {
    const perKindLimit = limit ?? 8;
    const likePattern = `%${query}%`;
    const out: string[] = [];

    const tokens = await queryRows<TokenSearchRow>(
      `SELECT t.id, t.surface, t.reading, t.romaji, t.cyrillic, t.gloss->>'ru' AS gloss, t.type,
              t."grammarNoteId" AS note, t."synonymGroupId" AS syn,
              (SELECT count(*)::int FROM "SentenceToken" st WHERE st."tokenId" = t.id) AS uses
      FROM "Token" t
      WHERE t.id ILIKE $1 OR t.surface ILIKE $1 OR t.reading ILIKE $1 OR t.romaji ILIKE $1
            OR t.cyrillic ILIKE $1 OR t.gloss->>'ru' ILIKE $1
      ORDER BY (t.id = $2) DESC, (t.id ILIKE $3) DESC, t.id
      LIMIT $4`,
      [likePattern, query, `${query}%`, perKindLimit],
    );

    if (tokens.length) {
      out.push('tokens:');

      for (const t of tokens) {
        out.push(
          `  ${t.id} – ${t.surface} (${t.reading} / ${t.cyrillic}) – "${t.gloss}" [${t.type}]` +
            ` • фраз: ${t.uses}` +
            (t.note ? ` • note: ${t.note}` : '') +
            (t.syn ? ` • syn: ${t.syn}` : ''),
        );
      }
    }

    const sentences = await queryRows<SentenceSearchRow>(
      `SELECT s.id, s.romaji, s.translation->>'ru' AS ru, ${SURFACE_SQL} AS surface
      FROM "Sentence" s
      WHERE s.id ILIKE $1 OR s.romaji ILIKE $1 OR s.translation->>'ru' ILIKE $1
            OR ${SURFACE_SQL} ILIKE $1
      ORDER BY (s.id = $2) DESC, s.id
      LIMIT $3
      `,
      [likePattern, query, perKindLimit],
    );

    if (sentences.length) {
      const lm = await lessonsBySentenceId(sentences.map((s) => s.id));

      out.push('sentences:');

      for (const s of sentences) {
        out.push(
          `  ${s.id} – ${s.surface ?? s.romaji} – "${s.ru}"` +
            (lm.has(s.id) ? ` • lessons: ${lm.get(s.id)}` : ' • вне лекций'),
        );
      }
    }

    const notes = await queryRows<NoteSearchRow>(
      `SELECT g.id, g.title->>'ru' AS title,
              (SELECT count(*)::int FROM "Token" t WHERE t."grammarNoteId" = g.id) AS tok_refs
        FROM "GrammarNote" g
        WHERE g.id ILIKE $1 OR g.title->>'ru' ILIKE $1 OR g.body::text ILIKE $1
        ORDER BY (g.id = $2) DESC, g.id
        LIMIT $3
      `,
      [likePattern, query, perKindLimit],
    );

    if (notes.length) {
      out.push('grammar-notes:');

      for (const g of notes) {
        out.push(
          `  ${g.id} – "${g.title ?? '–'}" • токенов с этой note: ${g.tok_refs}`,
        );
      }
    }

    const patterns = await queryRows<PatternSearchRow>(
      `SELECT id, "slotType", explanation->>'ru' AS ru
        FROM "Pattern"
        WHERE id ILIKE $1 OR explanation->>'ru' ILIKE $1
        ORDER BY id
        LIMIT $2
      `,
      [likePattern, perKindLimit],
    );

    if (patterns.length) {
      out.push('patterns:');

      for (const pt of patterns) {
        out.push(`  ${pt.id} [slot: ${pt.slotType}] — ${pt.ru}`);
      }
    }

    const lessons = await queryRows<LessonSearchRow>(
      `SELECT l.id, l.title->>'ru' AS ru, l."trackId" AS track
        FROM "Lesson" l
        WHERE l.id ILIKE $1 OR l.title->>'ru' ILIKE $1
        ORDER BY l.id
        LIMIT $2
      `,
      [likePattern, perKindLimit],
    );

    if (lessons.length) {
      out.push('lessons:');

      for (const l of lessons) {
        out.push(`  ${l.id} – "${l.ru}" • track: ${l.track}`);
      }
    }

    return ok(
      out.length
        ? out.join('\n')
        : `Ничто не найдено по "${query}". Попробуй другую форму слова (ромадзи/кириллица/русский).`,
    );
  },
);

// ============================================================
// where — полная карточка сущности + все ссылки на неё
// ============================================================
server.registerTool(
  'where',
  {
    title: 'Entity card & reference',
    description:
      'Like `npm run content -- where <id>` but over the DB: detects entity type by content id ' +
      '(token/sentence/grammar-note/pattern/dialog/lesson/track/synonym-group) and returns the full card ' +
      'plus everything that references it. Use before reusing, renaming or improving an entity.',
    inputSchema: {
      id: z
        .string()
        .min(1)
        .describe(
          'Content id, e.g. "hanasemasu", "wa-note", "ask-speak-english"',
        ),
    },
  },
  async ({ id }) => {
    const [tok] = await queryRows<TokenRow>(
      `SELECT *, gloss->>'ru' AS gloss_ru, gloss->>'en' AS gloss_en
        FROM "Token"
        WHERE id = $1
      `,
      [id],
    );
    if (tok) {
      return ok(await tokenCard(tok));
    }

    const [sen] = await queryRows<SentenceRow>(
      `SELECT s.*, ${SURFACE_SQL} AS surface
        FROM "Sentence" s
        WHERE id = $1
      `,
      [id],
    );
    if (sen) {
      return ok(await sentenceCard(sen));
    }

    const [note] = await queryRows<GrammarNote>(
      `SELECT * FROM "GrammarNote"
        WHERE id = $1
      `,
      [id],
    );
    if (note) {
      return ok(await noteCard(note));
    }

    const [pattern] = await queryRows<Pattern>(
      `SELECT *
        FROM "Pattern"
        WHERE id = $1
      `,
      [id],
    );
    if (pattern) {
      return ok(await patternCard(pattern));
    }

    const [dialog] = await queryRows<Dialog>(
      `SELECT *
        FROM "Dialog"
        WHERE id = $1
      `,
      [id],
    );
    if (dialog) {
      return ok(await dialogCard(dialog));
    }

    const [lesson] = await queryRows<Lesson>(
      `SELECT *
        FROM "Lesson"
        WHERE id = $1
      `,
      [id],
    );
    if (lesson) {
      return ok(await lessonCard(lesson));
    }

    const [track] = await queryRows<Track>(
      `SELECT *
        FROM "Track"
        WHERE id = $1
      `,
      [id],
    );
    if (track) {
      return ok(await trackCard(track));
    }

    const [sg] = await queryRows<SynonymGroup>(
      `SELECT *
        FROM "SynonymGroup"
        WHERE id = $1
      `,
      [id],
    );
    if (sg) {
      return ok(await synonymGroupCard(sg));
    }

    return ok(
      `id "${id}" не найден ни в одном типе. Проверь через search_content — возможно, другая форма id.`,
    );
  },
);

async function queryRows<T extends pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await pool.query<T>(text, params);

  return res.rows;
}

async function lessonsBySentenceId(
  sentenceIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  if (sentenceIds.length === 0) {
    return map;
  }

  const rows = await queryRows<LessonRefRow>(SENTENCE_LESSONS_SQL, [
    sentenceIds,
  ]);

  for (const r of rows) {
    map.set(
      r.sid,
      map.has(r.sid) ? map.get(r.sid) + ', ' + r.lesson_id : r.lesson_id,
    );
  }

  return map;
}

function ok(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

async function tokenCard(t: TokenRow): Promise<string> {
  const out = [
    `TOKEN ${t.id}`,
    `  ${t.surface} • чтение: ${t.reading} • romaji: ${t.romaji} • кириллица: ${t.cyrillic}`,
    `  gloss: "${t.gloss_ru}"${t.gloss_en ? ` / "${t.gloss_en}"` : ``} • тип: ${t.type}`,
  ];

  if (t.grammarNoteId) {
    const [g] = await queryRows<RuTitleRow>(
      `SELECT title->>'ru' AS ru
        FROM "GrammarNote"
        WHERE id = $1
      `,
      [t.grammarNoteId],
    );
    out.push(`  grammar-note: ${t.grammarNoteId} ("${g?.ru ?? '–'}")`);
  }

  if (t.synonymGroupId) {
    const members = await queryRows<SynonymMemberRow>(
      `SELECT m."tokenId", m.register, tk.surface, tk.gloss->>'ru' AS gloss
        FROM "SynonymMember" m
        JOIN "Token" tk ON tk.id = m."tokenId"
        WHERE m."synonymGroupId" = $1
        ORDER BY m."tokenId"
      `,
      [t.synonymGroupId],
    );
    out.push(`  синонимы (группа ${t.synonymGroupId}):`);

    for (const m of members) {
      out.push(
        `    ${m.tokenId} — ${m.surface} «${m.gloss}»${m.register ? ` [${m.register}]` : ''}${m.tokenId === t.id ? ' ← этот' : ''}`,
      );
    }
  }

  // Использование: фразы с токеном + лекции этих фраз.
  const sents = await queryRows<TokenSentenceRow>(
    `SELECT s.id, s.translation->>'ru' AS ru, ${SURFACE_SQL} AS surface
      FROM "Sentence" s
      WHERE s.id IN (SELECT "sentenceId" FROM "SentenceToken" WHERE "tokenId" = $1)
      ORDER BY s.id
      LIMIT 25
    `,
    [t.id],
  );

  if (sents.length) {
    const lm = await lessonsBySentenceId(sents.map((s) => s.id));
    out.push(`  используется во фразах (${sents.length})`);

    for (const s of sents) {
      out.push(
        `    ${s.id} — ${s.surface} — «${s.ru}»${lm.has(s.id) ? ` · lessons: ${lm.get(s.id)}` : ''}`,
      );
    }
  } else {
    out.push('  ⚠ не используется ни в одной фразе (сирота)');
  }

  return out.join('\n');
}

async function sentenceCard(s: SentenceRow): Promise<string> {
  const out = [
    `SENTENCE ${s.id}`,
    `  ${s.surface ?? ''} • romaji: ${s.romaji}`,
    `  перевод: "${ruText(s.translation)}"`,
    '  токены по позициям:',
  ];

  const tokens = await queryRows<SentenceTokenRow>(
    `SELECT st.position, st.before, st.after, tk.id, tk.surface, tk.gloss->>'ru' AS gloss
      FROM "SentenceToken" st
      JOIN "Token" tk ON tk.id = st."tokenId"
      WHERE st."sentenceId" = $1
      ORDER BY st.position
    `,
    [s.id],
  );
  for (const t of tokens) {
    const affix = [
      t.before && `before:"${t.before}"`,
      t.after && `after:"${t.after}"`,
    ]
      .filter(Boolean)
      .join(' ');

    out.push(
      `    [${t.position}] ${t.id} – ${t.surface} "${t.gloss}"${affix ? ' • ' + affix : ''}`,
    );
  }

  const notes = await queryRows<SentenceNoteRow>(
    `SELECT sg."grammarNoteId" AS id, g.title->>'ru' AS ru
      FROM "SentenceGrammarNote" sg
      JOIN "GrammarNote" g ON g.id = sg."grammarNoteId"
      WHERE sg."sentenceId" = $1
      ORDER BY sg.position
    `,
    [s.id],
  );
  if (notes.length) {
    out.push(
      '  заметка фразы: ' + notes.map((n) => `${n.id} ("${n.ru}")`).join(', '),
    );
  }

  const patterns = await queryRows<SentencePatternRefRow>(
    `SELECT sp."patternId" AS id, sp."focusTokenIndex" AS fti
      FROM "SentencePattern" sp
      WHERE sp."sentenceId" = $1
    `,
    [s.id],
  );
  if (patterns.length) {
    out.push(
      '  паттерны: ' +
        patterns.map((p) => `${p.id} (focus idx ${p.fti})`).join(', '),
    );
  }

  const dialogs = await queryRows<SentenceDialogRefRow>(
    `SELECT dt."dialogId" AS id, dt.position, dt.speaker
      FROM "DialogTurn" dt
      WHERE dt."sentenceId" = $1
    `,
    [s.id],
  );
  if (dialogs.length) {
    out.push(
      '  в диалогах: ' +
        dialogs
          .map((d) => `${d.id} (реплика ${d.position}, ${d.speaker})`)
          .join(', '),
    );
  }

  const lessonsMap = await lessonsBySentenceId([s.id]);
  out.push(
    lessonsMap.has(s.id)
      ? `  в лекциях: ${lessonsMap.get(s.id)}`
      : '  ⚠ не входит ни в одну лекцию',
  );

  return out.join('\n');
}

async function noteCard(g: GrammarNote): Promise<string> {
  const out = [`GRAMMAR-NOTE ${g.id} – "${ruText(g.title)}"`];
  const body = JSON.stringify(g.body);

  out.push(
    `  body: ${body.length > 600 ? body.slice(0, 600) + '... [обрезано]' : body}`,
  );

  if (g.deeper) {
    out.push(`  deeper: есть ${JSON.stringify(g.deeper).length} символов JSON`);
  }

  const tokens = await queryRows<Pick<Token, 'id' | 'surface'>>(
    `SELECT id, surface
      FROM "Token"
      WHERE "grammarNoteId" = $1
      ORDER BY id
    `,
    [g.id],
  );
  if (tokens.length) {
    out.push(
      '  note токенов: ' +
        tokens.map((t) => `${t.id} (${t.surface})`).join(', '),
    );
  }

  const sentences = await queryRows<IdRow>(
    `SELECT "sentenceId" AS id
      FROM "SentenceGrammarNote"
      WHERE "grammarNoteId" = $1
      ORDER BY 1
    `,
    [g.id],
  );
  if (sentences.length) {
    out.push(
      '  прикреплена к фразам: ' + sentences.map((s) => s.id).join(', '),
    );
  }

  const steps = await queryRows<NoteStepRefRow>(
    `SELECT ls."lessonId" AS lesson, ls.position
      FROM "LessonStepGrammarNote" lg
      JOIN "LessonStep" ls ON ls.id = lg."lessonStepId"
      WHERE lg."grammarNoteId" = $1
    `,
    [g.id],
  );
  if (steps.length) {
    out.push(
      '  на шагах лекций: ' +
        steps.map((s) => `${s.lesson}[шаг ${s.position}]`).join(', '),
    );
  }

  const patterns = await queryRows<IdRow>(
    `SELECT "patternId" AS id
      FROM "PatternGrammarNote"
      WHERE "grammarNoteId" = $1
    `,
    [g.id],
  );
  if (patterns.length) {
    out.push('  у паттернов: ' + patterns.map((p) => p.id).join(', '));
  }

  if (
    !tokens.length &&
    !sentences.length &&
    !steps.length &&
    !patterns.length
  ) {
    out.push('  ⚠ ни одной ссылки (сирота)');
  }

  return out.join('\n');
}

async function patternCard(p: Pattern): Promise<string> {
  const out = [
    `PATTERN ${p.id} • slot: ${p.slotType}`,
    `  ${ruText(p.explanation)}`,
  ];
  const sentences = await queryRows<UsageSentenceRow>(
    `SELECT sp."sentenceId" AS id, s.translation->>'ru' AS ru
      FROM "SentencePattern" sp
      JOIN "Sentence" s ON s.id = sp."sentenceId"
      WHERE sp."patternId" = $1
      ORDER BY 1
    `,
    [p.id],
  );
  if (sentences.length) {
    out.push(`  фразы паттерна (${sentences.length})`);

    for (const s of sentences) {
      out.push(`    ${s.id} – "${s.ru}"`);
    }
  }

  const steps = await queryRows<IdRow>(
    `SELECT DISTINCT "lessonId" AS id
      FROM "LessonStep"
      WHERE "patternId" = $1
    `,
    [p.id],
  );
  if (steps.length) {
    out.push('  на шагах лекций: ' + steps.map((s) => s.id).join(', '));
  }

  return out.join('\n');
}

async function dialogCard(d: Dialog): Promise<string> {
  const out = [`DIALOG ${d.id} – "${ruText(d.title)}"`, '  реплики:'];
  const turns = await queryRows<DialogTurnRow>(
    `SELECT dt.position, dt.speaker, dt."sentenceId" AS sid, s.translation->>'ru' AS ru,
            ${SURFACE_SQL.replace(/s\.id/g, 'dt."sentenceId"')} AS surface
      FROM "DialogTurn" dt
      JOIN "Sentence" s ON s.id = dt."sentenceId"
      WHERE dt."dialogId" = $1
      ORDER BY dt.position
    `,
    [d.id],
  );

  for (const t of turns) {
    out.push(
      `    [${t.position}] ${t.speaker}: ${t.sid} – ${t.surface} – "${t.ru}"`,
    );
  }

  const lessons = await queryRows<IdRow>(
    `SELECT DISTINCT "lessonId" AS id
      FROM "LessonStep"
      WHERE "dialogId" = $1
    `,
    [d.id],
  );
  if (lessons.length) {
    out.push('  в лекциях: ' + lessons.map((l) => l.id).join(', '));
  }

  return out.join('\n');
}

async function lessonCard(l: Lesson): Promise<string> {
  const out = [
    `LESSON ${l.id} – "${ruText(l.title)}" • track: ${l.trackId} • v${l.version} • position ${l.position}`,
    `  context: ${ruText(l.context)}`,
    '  шаги:',
  ];
  const steps = await queryRows<LessonStepRow>(
    `SELECT ls.position, ls.kind, ls."sentenceId" AS sid, ls."dialogId" AS did, ls."patternId" AS pid,
            (SELECT count(*)::int FROM "LessonStepSibling" x WHERE x."lessonStepId" = ls.id) AS sibs,
            (SELECT count(*)::int FROM "LessonStepGrammarNote" x WHERE x."lessonStepId" = ls.id) AS notes
      FROM "LessonStep" ls
      WHERE ls."lessonId" = $1
      ORDER BY ls.position
    `,
    [l.id],
  );

  for (const s of steps) {
    const ref = s.sid ?? s.did ?? s.pid ?? '–';

    out.push(
      `    [${s.position}] ${s.kind}: ${ref}` +
        (s.sibs ? ` · siblings: ${s.sibs}` : '') +
        (s.notes ? ` · notes: ${s.notes}` : ''),
    );
  }

  return out.join('\n');
}

async function trackCard(t: Track): Promise<string> {
  const out = [
    `TRACK ${t.id} – "${ruText(t.title)}" • position ${t.position}`,
    `  ${ruText(t.description)}`,
    '  лекции:',
  ];

  const lessons = await queryRows<TrackLessonRow>(
    `SELECT id, title->>'ru' AS ru, position, version,
            (SELECT count(*)::int FROM "LessonStep" ls WHERE ls."lessonId" = l.id) AS steps
      FROM "Lesson" l
      WHERE "trackId" = $1
      ORDER BY position
    `,
    [t.id],
  );

  for (const l of lessons) {
    out.push(
      `    [${l.position}] ${l.id} – "${l.ru}" • v${l.version} • шагов: ${l.steps}`,
    );
  }

  return out.join('\n');
}

async function synonymGroupCard(g: SynonymGroup): Promise<string> {
  const out = [`SYNONYM-GROUP ${g.id} – "${ruText(g.meaning)}"`];
  const members = await queryRows<SynonymMemberFullRow>(
    `SELECT m."tokenId", m.register, m.note, tk.surface, tk.gloss->>'ru' AS gloss
      FROM "SynonymMember" m
      JOIN "Token" tk ON tk.id = m."tokenId"
      WHERE m."synonymGroupId" = $1
      ORDER BY m."tokenId"
    `,
    [g.id],
  );

  for (const m of members) {
    out.push(
      `  ${m.tokenId} – ${m.surface} "${m.gloss}"${m.register ? ` [${m.register}]` : ''}${m.note ? ` • ${ruText(m.note)}` : ''}`,
    );
  }

  return out.join('\n');
}

// ============================================================
// stats — счётчики и сироты (аналог content -- status)
// ============================================================
server.registerTool(
  'stats',
  {
    title: 'Content stats & orphans',
    description:
      'Overview of the content DB: entity counts per type, plus "orphans" — tokens not used in any sentence, ' +
      'grammar notes referenced by nothing, sentences outside any lesson. Like `npm run content -- status`. ' +
      'Good starting point for "what can be improved" tasks.',
    inputSchema: {},
  },
  async () => {
    const [c] = await queryRows<StatsRow>(
      `SELECT
        (SELECT count(*)::int FROM "Track") AS tracks,
        (SELECT count(*)::int FROM "Lesson") AS lessons,
        (SELECT count(*)::int FROM "Sentence") AS sentences,
        (SELECT count(*)::int FROM "Token") AS tokens,
        (SELECT count(*)::int FROM "GrammarNote") AS notes,
        (SELECT count(*)::int FROM "Pattern") AS patterns,
        (SELECT count(*)::int FROM "Dialog") AS dialogs,
        (SELECT count(*)::int FROM "SynonymGroup") AS syn_groups`,
    );

    const out = [
      `tracks: ${c.tracks} · lessons: ${c.lessons} · sentences: ${c.sentences} · tokens: ${c.tokens}`,
      `grammar-notes: ${c.notes} · patterns: ${c.patterns} · dialogs: ${c.dialogs} · synonym-groups: ${c.syn_groups}`,
    ];

    const orphanTokens = await queryRows<IdRow>(
      `SELECT id FROM "Token" t
        WHERE NOT EXISTS (SELECT 1 FROM "SentenceToken" st WHERE st."tokenId" = t.id)
        ORDER BY id
      `,
    );
    if (orphanTokens.length) {
      out.push(
        `токены вне фраз (${orphanTokens.length}): ` +
          orphanTokens.map((ot) => ot.id).join(', '),
      );
    }

    const orphanNotes = await queryRows<IdRow>(
      `SELECT g.id
        FROM "GrammarNote" g
        WHERE
          NOT EXISTS (SELECT 1 FROM "Token" t WHERE t."grammarNoteId" = g.id) AND
          NOT EXISTS (SELECT 1 FROM "SentenceGrammarNote" x WHERE x."grammarNoteId" = g.id) AND
          NOT EXISTS (SELECT 1 FROM "LessonStepGrammarNote" x WHERE x."grammarNoteId" = g.id) AND
          NOT EXISTS (SELECT 1 FROM "PatternGrammarNote" x WHERE x."grammarNoteId" = g.id)
        ORDER BY g.id
      `,
    );
    if (orphanNotes.length) {
      out.push(
        `заметки без ссылок (${orphanNotes.length}): ` +
          orphanNotes.map((g) => g.id).join(', '),
      );
    }

    const looseSentences = await queryRows<IdRow>(
      `SELECT s.id
        FROM "Sentence" s
        WHERE
          NOT EXISTS (SELECT 1 FROM "LessonStep" ls WHERE ls."sentenceId" = s.id) AND
          NOT EXISTS (SELECT 1 FROM "LessonStepSibling" x WHERE x."sentenceId" = s.id) AND
          NOT EXISTS (SELECT 1 FROM "DialogTurn" dt WHERE dt."sentenceId" = s.id)
        ORDER BY s.id
      `,
    );
    if (looseSentences.length) {
      out.push(
        `фразы вне лекций (${looseSentences.length}): ` +
          looseSentences.map((s) => s.id).join(', '),
      );
    }

    return ok(out.join('\n'));
  },
);

server.registerTool(
  'run_sql',
  {
    title: 'Run read-only SQL',
    description:
      'Execute an arbitrary SELECT over the Wakaba content DB for ad-hoc analysis not covered by other tools. ' +
      'Read-only is enforced at the DB level (role agent_ro). Single statement, SELECT/WITH only, ' +
      'results capped at 50 rows. Table names are quoted PascalCase ("Token", "SentenceToken"); ' +
      "localized JSON columns: gloss->>'ru', translation->>'ru', title->>'ru'.",
    inputSchema: {
      sql: z
        .string()
        .min(1)
        .describe('A single SELECT (or WITH ...SELECT) statement'),
    },
  },
  async ({ sql }) => {
    const s = sql.trim().replace(/;\s*$/, '');

    if (s.includes(';')) {
      throw new Error('Только один statement за вызов');
    }

    if (!/^(select|with)\b/i.test(s)) {
      throw new Error('Только SELECT или WITH... SELECT');
    }

    if (
      /\b(insert|update|delete|truncate|drop|alter|create|grant|revoke|copy|vacuum)\b/i.test(
        s,
      )
    ) {
      throw new Error(
        'Запрос содержит пишущие ключевые слова – доступ только на чтение',
      );
    }

    if (
      /"(User|RefreshToken|UserSettings|LessonProgress|Favourite)"/i.test(s)
    ) {
      throw new Error(
        'Таблицы пользователей недоступны этому инструменту (контент-скоуп)',
      );
    }

    const rows = await queryRows<pg.QueryResultRow>(
      `SELECT * FROM (${s}) AS q LIMIT 51`,
    );
    const truncated = rows.length > 50;
    const shown = truncated ? rows.slice(0, 50) : rows;

    if (shown.length === 0) {
      return ok('0 строк.');
    }

    const lines = shown.map((r) => JSON.stringify(r));
    let text = lines.join('\n');

    if (text.length > 8000) {
      text =
        text.slice(0, 8000) + '\n… [вывод обрезан по размеру — сузь запрос]';
    }

    if (truncated) {
      text += '\n… [показаны первые 50 строк — добавь WHERE или агрегацию]';
    }

    return ok(text);
  },
);

function ruText(v: unknown): string {
  if (v == null) {
    return '-';
  }
  if (typeof v === 'string') {
    return v;
  }

  const o = v as Record<string, unknown>;

  return String(o.ru ?? o.en ?? JSON.stringify(v));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

type IdRow = { id: string };
type RuTitleRow = { ru: string | null };
type LessonRefRow = { sid: string; lesson_id: string };

type TokenSearchRow = Pick<
  Token,
  'id' | 'surface' | 'reading' | 'romaji' | 'cyrillic' | 'type'
> & {
  gloss: string | null;
  note: string | null;
  syn: string | null;
  uses: number;
};
type SentenceSearchRow = Pick<Sentence, 'id' | 'romaji'> & {
  ru: string | null;
  surface: string | null;
};
type NoteSearchRow = { id: string; title: string | null; tok_refs: number };
type PatternSearchRow = Pick<Pattern, 'id' | 'slotType'> & {
  ru: string | null;
};
type LessonSearchRow = { id: string; ru: string | null; track: string };

type TokenRow = Token & { gloss_ru: string | null; gloss_en: string | null };
type SentenceRow = Sentence & { surface: string | null };
type TokenSentenceRow = {
  id: string;
  ru: string | null;
  surface: string | null;
};
type SynonymMemberRow = {
  tokenId: string;
  register: Register | null;
  surface: string;
  gloss: string | null;
};
type SynonymMemberFullRow = SynonymMemberRow & { note: unknown };
type UsageSentenceRow = {
  id: string;
  ru: string | null;
};
type SentenceTokenRow = {
  position: number;
  before: string | null;
  after: string | null;
  id: string;
  surface: string;
  gloss: string | null;
};
type SentenceNoteRow = { id: string; ru: string | null };
type SentencePatternRefRow = { id: string; fti: number };
type SentenceDialogRefRow = { id: string; position: number; speaker: Speaker };
type NoteStepRefRow = { lesson: string; position: number };
type DialogTurnRow = {
  position: number;
  speaker: Speaker;
  sid: string;
  ru: string | null;
  surface: string | null;
};
type LessonStepRow = {
  position: number;
  kind: StepKind;
  sid: string | null;
  did: string | null;
  pid: string | null;
  sibs: number;
  notes: number;
};
type TrackLessonRow = {
  id: string;
  ru: string | null;
  position: number;
  version: number;
  steps: number;
};

type StatsRow = {
  tracks: number;
  lessons: number;
  sentences: number;
  tokens: number;
  notes: number;
  patterns: number;
  dialogs: number;
  syn_groups: number;
};
