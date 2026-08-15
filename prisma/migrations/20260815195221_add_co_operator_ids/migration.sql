-- AlterTable
ALTER TABLE "WorkflowStep" ADD COLUMN     "coOperatorIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
