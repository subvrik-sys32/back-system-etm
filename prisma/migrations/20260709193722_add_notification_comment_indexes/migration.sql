-- CreateIndex
CREATE INDEX "Notification_commentId_idx" ON "Notification"("commentId");

-- CreateIndex
CREATE INDEX "Notification_userId_read_taskId_idx" ON "Notification"("userId", "read", "taskId");

-- CreateIndex
CREATE INDEX "Notification_userId_read_workflowStepId_idx" ON "Notification"("userId", "read", "workflowStepId");
