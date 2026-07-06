-- DropForeignKey
ALTER TABLE "Comment" DROP CONSTRAINT "Comment_workflowStepId_fkey";

-- CreateIndex
CREATE INDEX "Comment_workflowStepId_idx" ON "Comment"("workflowStepId");

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_workflowStepId_fkey" FOREIGN KEY ("workflowStepId") REFERENCES "WorkflowStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;
