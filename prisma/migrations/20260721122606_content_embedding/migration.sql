-- CreateTable
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "ContentEmbedding" (
    "kind" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "textHash" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "embedding" vector(2560) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentEmbedding_pkey" PRIMARY KEY ("kind","entityId")
);
