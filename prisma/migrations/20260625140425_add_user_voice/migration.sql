-- CreateEnum
CREATE TYPE "Voice" AS ENUM ('m', 'f');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "voice" "Voice" NOT NULL DEFAULT 'm';
