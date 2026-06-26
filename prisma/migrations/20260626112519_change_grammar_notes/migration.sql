/*
  Warnings:

  - You are about to drop the column `audioKey` on the `Sentence` table. All the data in the column will be lost.
  - You are about to drop the column `audioKey` on the `Token` table. All the data in the column will be lost.
  - You are about to drop the `GrammarExample` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "GrammarExample" DROP CONSTRAINT "GrammarExample_grammarNoteId_fkey";

-- AlterTable
ALTER TABLE "Sentence" DROP COLUMN "audioKey";

-- AlterTable
ALTER TABLE "Token" DROP COLUMN "audioKey";

-- DropTable
DROP TABLE "GrammarExample";

-- DropEnum
DROP TYPE "GrammarExampleKind";

-- CreateTable
CREATE TABLE "SentenceGrammarNote" (
    "sentenceId" TEXT NOT NULL,
    "grammarNoteId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SentenceGrammarNote_pkey" PRIMARY KEY ("sentenceId","grammarNoteId")
);

-- AddForeignKey
ALTER TABLE "SentenceGrammarNote" ADD CONSTRAINT "SentenceGrammarNote_sentenceId_fkey" FOREIGN KEY ("sentenceId") REFERENCES "Sentence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SentenceGrammarNote" ADD CONSTRAINT "SentenceGrammarNote_grammarNoteId_fkey" FOREIGN KEY ("grammarNoteId") REFERENCES "GrammarNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
