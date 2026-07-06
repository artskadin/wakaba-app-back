-- AlterTable
ALTER TABLE "PatternGrammarNote" ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "LessonStepGrammarNote" (
    "lessonStepId" TEXT NOT NULL,
    "grammarNoteId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LessonStepGrammarNote_pkey" PRIMARY KEY ("lessonStepId","grammarNoteId")
);

-- AddForeignKey
ALTER TABLE "LessonStepGrammarNote" ADD CONSTRAINT "LessonStepGrammarNote_lessonStepId_fkey" FOREIGN KEY ("lessonStepId") REFERENCES "LessonStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonStepGrammarNote" ADD CONSTRAINT "LessonStepGrammarNote_grammarNoteId_fkey" FOREIGN KEY ("grammarNoteId") REFERENCES "GrammarNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
