-- DropIndex
DROP INDEX "Task_projectId_idx";

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "route" "ProcessCode"[];
