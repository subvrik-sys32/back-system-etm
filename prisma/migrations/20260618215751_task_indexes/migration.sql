/*
  Warnings:

  - A unique constraint covering the columns `[taskNumber]` on the table `Task` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[taskId,processCode]` on the table `WorkflowStep` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE INDEX "Project_clientId_idx" ON "Project"("clientId");

-- CreateIndex
CREATE INDEX "Project_pmId_idx" ON "Project"("pmId");

-- CreateIndex
CREATE UNIQUE INDEX "Task_taskNumber_key" ON "Task"("taskNumber");

-- CreateIndex
CREATE INDEX "Task_projectId_idx" ON "Task"("projectId");

-- CreateIndex
CREATE INDEX "WorkflowStep_taskId_idx" ON "WorkflowStep"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowStep_taskId_processCode_key" ON "WorkflowStep"("taskId", "processCode");
