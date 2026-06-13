-- CreateEnum
CREATE TYPE "StepKind" AS ENUM ('teach', 'assemble', 'speak', 'listen', 'dialog');

-- CreateEnum
CREATE TYPE "GrammarExampleKind" AS ENUM ('transform', 'phrase', 'plain');

-- CreateEnum
CREATE TYPE "Register" AS ENUM ('casual', 'neutral', 'polite', 'humble');

-- CreateEnum
CREATE TYPE "TokenType" AS ENUM ('noun', 'pronoun', 'verb', 'adjective', 'adverb', 'particle', 'ending', 'prefix', 'number', 'counter', 'expression', 'other');

-- CreateEnum
CREATE TYPE "Speaker" AS ENUM ('user', 'staff');

-- CreateTable
CREATE TABLE "Track" (
    "id" TEXT NOT NULL,
    "title" JSONB NOT NULL,
    "description" JSONB NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Track_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "title" JSONB NOT NULL,
    "context" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "position" INTEGER NOT NULL DEFAULT 0,
    "changelog" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonStep" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "kind" "StepKind" NOT NULL,
    "sentenceId" TEXT,
    "dialogId" TEXT,
    "patternId" TEXT,

    CONSTRAINT "LessonStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonStepSibling" (
    "lessonStepId" TEXT NOT NULL,
    "sentenceId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "LessonStepSibling_pkey" PRIMARY KEY ("lessonStepId","sentenceId")
);

-- CreateTable
CREATE TABLE "Pattern" (
    "id" TEXT NOT NULL,
    "explanation" JSONB NOT NULL,
    "slotType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrammarNote" (
    "id" TEXT NOT NULL,
    "title" JSONB NOT NULL,
    "body" JSONB NOT NULL,
    "deeper" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GrammarNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatternGrammarNote" (
    "patternId" TEXT NOT NULL,
    "grammarNoteId" TEXT NOT NULL,

    CONSTRAINT "PatternGrammarNote_pkey" PRIMARY KEY ("patternId","grammarNoteId")
);

-- CreateTable
CREATE TABLE "GrammarExample" (
    "id" TEXT NOT NULL,
    "grammarNoteId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "kind" "GrammarExampleKind" NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "GrammarExample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SynonymGroup" (
    "id" TEXT NOT NULL,
    "meaning" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SynonymGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SynonymMember" (
    "id" TEXT NOT NULL,
    "synonymGroupId" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "register" "Register",
    "note" JSONB,

    CONSTRAINT "SynonymMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Token" (
    "id" TEXT NOT NULL,
    "surface" TEXT NOT NULL,
    "reading" TEXT NOT NULL,
    "romaji" TEXT NOT NULL,
    "cyrillic" TEXT NOT NULL,
    "gloss" JSONB NOT NULL,
    "type" "TokenType" NOT NULL,
    "audioKey" TEXT,
    "grammarNoteId" TEXT,
    "synonymGroupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sentence" (
    "id" TEXT NOT NULL,
    "patternId" TEXT,
    "translation" JSONB NOT NULL,
    "romaji" TEXT NOT NULL,
    "cyrillicGuide" JSONB NOT NULL,
    "audioKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sentence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SentenceToken" (
    "id" TEXT NOT NULL,
    "sentenceId" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "slotType" TEXT,
    "isFocusSlot" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SentenceToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dialog" (
    "id" TEXT NOT NULL,
    "title" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dialog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DialogTurn" (
    "id" TEXT NOT NULL,
    "dialogId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "speaker" "Speaker" NOT NULL,
    "sentenceId" TEXT NOT NULL,

    CONSTRAINT "DialogTurn_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonStep" ADD CONSTRAINT "LessonStep_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonStep" ADD CONSTRAINT "LessonStep_sentenceId_fkey" FOREIGN KEY ("sentenceId") REFERENCES "Sentence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonStep" ADD CONSTRAINT "LessonStep_dialogId_fkey" FOREIGN KEY ("dialogId") REFERENCES "Dialog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonStep" ADD CONSTRAINT "LessonStep_patternId_fkey" FOREIGN KEY ("patternId") REFERENCES "Pattern"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonStepSibling" ADD CONSTRAINT "LessonStepSibling_lessonStepId_fkey" FOREIGN KEY ("lessonStepId") REFERENCES "LessonStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonStepSibling" ADD CONSTRAINT "LessonStepSibling_sentenceId_fkey" FOREIGN KEY ("sentenceId") REFERENCES "Sentence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatternGrammarNote" ADD CONSTRAINT "PatternGrammarNote_patternId_fkey" FOREIGN KEY ("patternId") REFERENCES "Pattern"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatternGrammarNote" ADD CONSTRAINT "PatternGrammarNote_grammarNoteId_fkey" FOREIGN KEY ("grammarNoteId") REFERENCES "GrammarNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrammarExample" ADD CONSTRAINT "GrammarExample_grammarNoteId_fkey" FOREIGN KEY ("grammarNoteId") REFERENCES "GrammarNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SynonymMember" ADD CONSTRAINT "SynonymMember_synonymGroupId_fkey" FOREIGN KEY ("synonymGroupId") REFERENCES "SynonymGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SynonymMember" ADD CONSTRAINT "SynonymMember_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "Token"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Token" ADD CONSTRAINT "Token_grammarNoteId_fkey" FOREIGN KEY ("grammarNoteId") REFERENCES "GrammarNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Token" ADD CONSTRAINT "Token_synonymGroupId_fkey" FOREIGN KEY ("synonymGroupId") REFERENCES "SynonymGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sentence" ADD CONSTRAINT "Sentence_patternId_fkey" FOREIGN KEY ("patternId") REFERENCES "Pattern"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SentenceToken" ADD CONSTRAINT "SentenceToken_sentenceId_fkey" FOREIGN KEY ("sentenceId") REFERENCES "Sentence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SentenceToken" ADD CONSTRAINT "SentenceToken_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "Token"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DialogTurn" ADD CONSTRAINT "DialogTurn_dialogId_fkey" FOREIGN KEY ("dialogId") REFERENCES "Dialog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DialogTurn" ADD CONSTRAINT "DialogTurn_sentenceId_fkey" FOREIGN KEY ("sentenceId") REFERENCES "Sentence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
