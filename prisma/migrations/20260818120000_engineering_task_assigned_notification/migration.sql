-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ENGINEERING_TASK_ASSIGNED';

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "engineeringTaskId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Notification_userId_read_engineeringTaskId_idx" ON "Notification"("userId", "read", "engineeringTaskId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Notification"
    ADD CONSTRAINT "Notification_engineeringTaskId_fkey"
    FOREIGN KEY ("engineeringTaskId") REFERENCES "EngineeringTask"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
