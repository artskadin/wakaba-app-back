/*
  Warnings:

  - You are about to drop the column `patternId` on the `Sentence` table. All the data in the column will be lost.
  - You are about to drop the column `isFocusSlot` on the `SentenceToken` table. All the data in the column will be lost.
  - You are about to drop the column `slotType` on the `SentenceToken` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Sentence" DROP CONSTRAINT "Sentence_patternId_fkey";

-- AlterTable
ALTER TABLE "Sentence" DROP COLUMN "patternId";

-- AlterTable
ALTER TABLE "SentenceToken" DROP COLUMN "isFocusSlot",
DROP COLUMN "slotType";

-- CreateTable
CREATE TABLE "SentencePattern" (
    "sentenceId" TEXT NOT NULL,
    "patternId" TEXT NOT NULL,
    "focusTokenIndex" INTEGER NOT NULL,

    CONSTRAINT "SentencePattern_pkey" PRIMARY KEY ("sentenceId","patternId")
);

-- AddForeignKey
ALTER TABLE "SentencePattern" ADD CONSTRAINT "SentencePattern_sentenceId_fkey" FOREIGN KEY ("sentenceId") REFERENCES "Sentence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SentencePattern" ADD CONSTRAINT "SentencePattern_patternId_fkey" FOREIGN KEY ("patternId") REFERENCES "Pattern"("id") ON DELETE CASCADE ON UPDATE CASCADE;
