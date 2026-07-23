-- AlterTable
ALTER TABLE "ActivityLog" ADD COLUMN     "photoUrl" TEXT;

-- AlterTable
ALTER TABLE "ActivityType" ADD COLUMN     "pinned" BOOLEAN NOT NULL DEFAULT false;
