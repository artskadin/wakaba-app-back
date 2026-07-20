import { ruText, validateSelectQuery } from '../db-readonly.lib';

describe('ruText', () => {
  it('строку возвращает как есть', () => {
    expect(ruText('привет')).toBe('привет');
  });

  it('из локализованного объекта берет ru', () => {
    expect(ruText({ ru: 'чай', en: 'tea' })).toBe('чай');
  });

  it('fallback на en, когда нету ru', () => {
    expect(ruText({ en: 'tea' })).toBe('tea');
  });

  it('null и undefined превращает в прочерк', () => {
    expect(ruText(null)).toBe('-');
    expect(ruText(undefined)).toBe('-');
  });

  it('неожиданную форму показывает как JSON, а не падает', () => {
    expect(ruText({ fr: 'thé' })).toBe('{"fr":"thé"}');
  });
});

describe('validateSelectQuery', () => {
  it.each([
    ['SELECT 1', 'SELECT 1'],
    ['  select id from "Token"  ', 'select id from "Token"'],
    ['SELECT 1;', 'SELECT 1'],
    [
      'WITH x AS (SELECT 1) SELECT * FROM x',
      'WITH x AS (SELECT 1) SELECT * FROM x',
    ],
  ])('пропускает валидный запрос: %s', (input, expected) => {
    expect(validateSelectQuery(input)).toBe(expected);
  });

  it.each([
    ['SELECT 1; SELECT 2', /один statement/],
    ['DELETE FROM "Token"', /Только SELECT/],
    ['EXPLAIN SELECT 1', /Только SELECT/],
    ['WITH x AS (DELETE FROM "Token" RETURNING *) SELECT * FROM x', /пишущие/],
    ['SELECT * FROM "Token"; DROP TABLE "Token"', /один statement/],
  ])('отклоняет: %s', (input, expected) => {
    expect(() => validateSelectQuery(input)).toThrow(expected);
  });

  it.each([
    'SELECT * FROM "User"',
    'SELECT * FROM "RefreshToken"',
    'SELECT * FROM "UserSettings"',
    'SELECT * FROM "LessonProgress"',
    'SELECT * FROM "Favourite"',
    'select "tokenHash" from "refreshtoken"',
  ])('закрывает пользовательскую таблицу: %s', (sql) => {
    expect(() => validateSelectQuery(sql)).toThrow(/контент-скоуп/);
  });

  it('НЕ трогает контентные таблицы с похожими именами', () => {
    expect(() =>
      validateSelectQuery('SELECT * FROM "LessonStep"'),
    ).not.toThrow();
  });
});
