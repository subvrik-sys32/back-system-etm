/*
  Warnings:

  - A unique constraint covering the columns `[workflowStepId,activityTypeId]` on the table `ActivityLog` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "ActivityLog_workflowStepId_key";

-- CreateIndex
CREATE UNIQUE INDEX "ActivityLog_workflowStepId_activityTypeId_key" ON "ActivityLog"("workflowStepId", "activityTypeId");
