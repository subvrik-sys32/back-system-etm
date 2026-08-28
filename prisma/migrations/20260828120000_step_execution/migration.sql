-- CreateEnum
CREATE TYPE "StepExecution" AS ENUM ('IN_HOUSE', 'OUTSOURCED');

-- AlterTable
ALTER TABLE "WorkflowStep" ADD COLUMN "execution" "StepExecution" NOT NULL DEFAULT 'IN_HOUSE';
