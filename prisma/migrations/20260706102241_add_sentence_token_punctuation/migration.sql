-- AlterTable
ALTER TABLE "GrammarNote" ALTER COLUMN "title" DROP NOT NULL;

-- AlterTable
ALTER TABLE "SentenceToken" ADD COLUMN     "after" TEXT,
ADD COLUMN     "before" TEXT;
