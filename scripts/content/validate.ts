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
  graph.lessons.forEach((_, id) => claim(id, 'lessons'));
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

  return problems;
}
