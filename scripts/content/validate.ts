import { ContentGraph, EntityKind, Problem } from './types';

export function validate(graph: ContentGraph): Problem[] {
  const problems: Problem[] = [];

  const owner = new Map<string, EntityKind>();

  const claim = (id: string, kind: EntityKind) => {
    const prev = owner.get(id);
    if (prev && prev !== kind) {
      problems.push({
        level: 'error',
        message: `id "${id}" занят и как ${prev}, и как ${kind}`,
      });
    } else {
      owner.set(id, kind);
    }
  };

  graph.tokens.forEach((_, id) => claim(id, 'token'));
  graph.notes.forEach((_, id) => claim(id, 'note'));
  graph.patterns.forEach((_, id) => claim(id, 'pattern'));
  graph.sentences.forEach((_, id) => claim(id, 'sentence'));
  graph.dialogs.forEach((_, id) => claim(id, 'dialog'));
  graph.lessons.forEach((_, id) => claim(id, 'lesson'));
  graph.tracks.forEach((_, id) => claim(id, 'track'));

  const need = (
    id: string | undefined,
    pool: Map<string, unknown>,
    where: string,
    what: string,
  ) => {
    if (id && !pool.has(id)) {
      problems.push({
        level: 'error',
        message: `${where}: ${what} "${id}" не найден`,
      });
    }
  };

  for (const t of graph.tokens.values()) {
    need(t.grammarNoteId, graph.notes, `токен "${t.id}"`, 'заметка');
  }

  for (const p of graph.patterns.values()) {
    for (const nid of p.grammarNoteIds) {
      need(nid, graph.notes, `паттерн "${p.id}"`, 'заметка');
    }
  }

  for (const s of graph.sentences.values()) {
    for (const ref of s.tokens) {
      need(ref.tokenId, graph.tokens, `предложение "${s.id}"`, 'токен');
    }

    need(s.patternId, graph.patterns, `предложение "${s.id}"`, 'паттерн');

    for (const nid of s.grammarNoteIds ?? []) {
      need(nid, graph.notes, `предложение "${s.id}"`, 'заметка');
    }
  }

  for (const d of graph.dialogs.values()) {
    d.turns.forEach((turn, i) =>
      need(
        turn.sentenceId,
        graph.sentences,
        `диалог "${d.id}", реплика ${i + 1}`,
        'предложение',
      ),
    );
  }

  for (const lesson of graph.lessons.values()) {
    need(lesson.trackId, graph.tracks, `урок "${lesson.id}"`, 'трек');

    lesson.steps.forEach((step, i) => {
      const where = `урок "${lesson.id}", шаг ${i + 1} (${step.kind})`;

      if (step.kind === 'dialog') {
        need(step.dialogId, graph.dialogs, where, 'диалог');
      } else {
        need(step.sentenceId, graph.sentences, where, 'предложение');
      }

      if (step.kind === 'teach') {
        need(step.patternId, graph.patterns, where, 'паттерн');

        for (const sid of step.siblingSentenceIds ?? []) {
          need(sid, graph.sentences, where, 'предложение');
        }
      }

      for (const nid of step.grammarNoteIds ?? []) {
        need(nid, graph.notes, where, 'заметка');
      }
    });
  }

  for (const note of graph.notes.values()) {
    const blocks = [...note.body, ...(note.deeper ?? [])];

    blocks.forEach((block, bi) => {
      (block.examples ?? []).forEach((ex, ei) => {
        const e = ex as {
          kind?: string;
          wrong?: unknown;
          right?: unknown;
          a?: { segments?: { romaji?: string; cyrillic?: string }[] };
          b?: { segments?: { romaji?: string; cyrillic?: string }[] };
        };
        const where = `заметка "${note.id}", блок ${bi + 1}, пример ${ei + 1}`;

        if (e.kind === 'wrong-right') {
          if (!e.wrong && !e.right) {
            problems.push({
              level: 'error',
              message: `${where}: wrong-right без сторон`,
            });
          } else if (e.right && !e.wrong) {
            problems.push({
              level: 'error',
              message: `${where}: right без wrong — используй phrase`,
            });
          } else if (e.wrong && !e.right) {
            problems.push({
              level: 'warning',
              message: `${where}: wrong без right (допустимо, но редко)`,
            });
          }

          return;
        }

        if (e.kind === 'contrast') {
          for (const [key, side] of [
            ['a', e.a],
            ['b', e.b],
          ] as const) {
            const segments = side?.segments ?? [];

            if (segments.length === 0) {
              problems.push({
                level: 'error',
                message: `${where}: contrast.${key} без сегментов`,
              });
              continue;
            }

            segments.forEach((s, si) => {
              (['romaji', 'cyrillic'] as const).forEach((field) => {
                const v = s[field];

                if (typeof v === 'string' && v !== v.trim()) {
                  problems.push({
                    level: 'warning',
                    message: `${where}: contrast.${key} сегмент ${si + 1} — пробелы по краям ${field}`,
                  });
                }
              });
            });
          }
        }
      });
    });
  }

  return problems;
}
