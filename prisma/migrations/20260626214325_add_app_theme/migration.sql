-- CreateEnum
CREATE TYPE "Theme" AS ENUM ('light', 'dark');

-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN     "theme" "Theme" NOT NULL DEFAULT 'light';
