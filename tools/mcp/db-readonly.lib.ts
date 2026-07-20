export function ruText(v: unknown): string {
  if (v == null) return '-';
  if (typeof v === 'string') return v;
  const o = v as Record<string, unknown>;
  return String(o.ru ?? o.en ?? JSON.stringify(v));
}

const FORBIDDEN_KEYWORDS_RE =
  /\b(insert|update|delete|truncate|drop|alter|create|grant|revoke|copy|vacuum)\b/i;

const USER_TABLES_RE =
  /"(User|RefreshToken|UserSettings|LessonProgress|Favourite)"/i;

export function validateSelectQuery(sql: string): string {
  const s = sql.trim().replace(/;\s*$/, '');

  if (s.includes(';')) {
    throw new Error('Только один statement за вызов');
  }

  if (!/^(select|with)\b/i.test(s)) {
    throw new Error('Только SELECT или WITH ... SELECT');
  }

  if (FORBIDDEN_KEYWORDS_RE.test(s)) {
    throw new Error(
      'Запрос содержит пишущие ключевые слова — доступ только на чтение',
    );
  }

  if (USER_TABLES_RE.test(s)) {
    throw new Error(
      'Таблицы пользователей недоступны этому инструменту (контент-скоуп)',
    );
  }

  return s;
}
