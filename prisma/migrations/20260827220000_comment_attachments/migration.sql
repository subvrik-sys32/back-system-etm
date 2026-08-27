-- AlterTable
ALTER TABLE "Comment" ADD COLUMN IF NOT EXISTS "attachmentUrl" TEXT;
ALTER TABLE "Comment" ADD COLUMN IF NOT EXISTS "attachmentName" TEXT;
ALTER TABLE "Comment" ADD COLUMN IF NOT EXISTS "attachmentMime" TEXT;
