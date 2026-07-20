INSERT INTO "Track" (id, title, description, position, "updatedAt")
VALUES ('communication', '{"ru":"Общение"}', '{"ru":"Выжить в разговоре"}', 0, now());

INSERT INTO "GrammarNote" (id, title, body, "updatedAt")
VALUES ('wa-note', '{"ru":"Частица wa"}', '{"ru":"Маркер темы предложения"}', now()),
       ('potential', '{"ru":"Потенциальная форма"}', '{"ru":"форма могу/умею: hanasu -> hanaseru"}', now());

INSERT INTO "SynonymGroup" (id, meaning, "updatedAt")
VALUES ('drink-tea-group', '{"ru":"напитки"}', now());

INSERT INTO "Token" (id, surface, reading, romaji, cyrillic, gloss, type, "grammarNoteId", "synonymGroupId", "updatedAt")
VALUES ('wa', 'は', 'わ', 'wa', 'ва', '{"ru":"частица темы"}', 'particle', 'wa-note', NULL, now()),
    ('ka', 'か', 'か', 'ka', 'ка', '{"ru":"вопросительная частица"}', 'particle', NULL, NULL, now()),
    ('eigo', '英語', 'えいご', 'eigo', 'эйго', '{"ru":"английский язык"}', 'noun', NULL, NULL, now()),
    ('hanasemasu', '話せます', 'はなせます', 'hanasemasu', 'ханасэмасу', '{"ru":"могу говорить"}', 'verb', 'potential', NULL, now()),
    ('sukoshi', '少し', 'すこし', 'sukoshi', 'сукоси', '{"ru":"немного"}', 'adverb', NULL, NULL, now()),
    ('ocha', 'お茶', 'おちゃ', 'ocha', 'отя', '{"ru":"чай"}', 'noun', NULL, 'drink-tea-group', now()),
    ('sake', '酒', 'さけ', 'sake', 'сакэ', '{"ru":"сакэ"}', 'noun', NULL, 'drink-tea-group', now());

INSERT INTO "SynonymMember" (id, "synonymGroupId", "tokenId", register, note)
VALUES ('sm-ocha', 'drink-tea-group', 'ocha', 'neutral', '{"ru":"повседневный напиток"}'),
    ('sm-sake', 'drink-tea-group', 'sake', 'neutral', NULL);

INSERT INTO "Sentence" (id, translation, romaji, "cyrillicGuide", "updatedAt")
VALUES ('ask-speak-english', '{"ru":"Вы говорите по-английски?"}', 'eigo wa hanasemasu ka', '{"t":"эйго ва ханасэмасу ка"}', now()),
    ('speak-little-japanese', '{"ru":"Я немного говорю по-японски"}', 'nihongo wa sukoshi hanasemasu', '{"t":"нихонго ва сукоси ханасэмасу"}', now());

INSERT INTO "SentenceToken" (id, "sentenceId", "tokenId", position, before, after)
VALUES ('st-1', 'ask-speak-english', 'eigo', 0, NULL, NULL),
    ('st-2', 'ask-speak-english', 'wa', 1, NULL, NULL),
    ('st-3', 'ask-speak-english', 'hanasemasu', 2, NULL, NULL),
    ('st-4', 'ask-speak-english', 'ka', 3, NULL, '?'),
    ('st-5', 'speak-little-japanese', 'wa', 1, NULL, NULL),
    ('st-6', 'speak-little-japanese', 'sukoshi', 2, NULL, NULL),
    ('st-7', 'speak-little-japanese', 'hanasemasu', 3, NULL, NULL);

INSERT INTO "Pattern" (id, explanation, "slotType", "updatedAt")
VALUES ('speak-language', '{"ru":"X wa hanasemasu ka — спросить о языке"}', 'language', now());

INSERT INTO "SentencePattern" ("sentenceId", "patternId", "focusTokenIndex")
VALUES ('ask-speak-english', 'speak-language', 0);

INSERT INTO "SentenceGrammarNote" ("sentenceId", "grammarNoteId", position)
VALUES ('ask-speak-english', 'wa-note', 0);

INSERT INTO "Dialog" (id, title, "updatedAt")
VALUES ('language-help', '{"ru":"Помощь с языком"}', now());

INSERT INTO "DialogTurn" (id, "dialogId", position, speaker, "sentenceId")
VALUES ('dt-1', 'language-help', 0, 'user', 'ask-speak-english'),
    ('dt-2', 'language-help', 1, 'staff', 'speak-little-japanese');

INSERT INTO "Lesson" (id, "trackId", title, context, changelog, "updatedAt")
VALUES ('language-barrier', 'communication', '{"ru":"Языковой барьер"}', '{"ru":"Первый разговор"}', '[]', now());

INSERT INTO "LessonStep" (id, "lessonId", position, kind, "sentenceId", "dialogId", "patternId")
VALUES ('step-1', 'language-barrier', 0, 'teach', 'ask-speak-english', NULL, NULL),
    ('step-2', 'language-barrier', 1, 'assemble', NULL, NULL, 'speak-language'),
    ('step-3', 'language-barrier', 2, 'dialog', NULL, 'language-help', NULL);

INSERT INTO "LessonStepSibling" ("lessonStepId", "sentenceId", position)
VALUES ('step-1', 'speak-little-japanese', 0);

INSERT INTO "LessonStepGrammarNote" ("lessonStepId", "grammarNoteId", position)
VALUES ('step-1', 'wa-note', 0);
