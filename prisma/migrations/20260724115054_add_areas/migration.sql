/*
  Warnings:

  - A unique constraint covering the columns `[workflowStepId]` on the table `ActivityLog` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ActivityDepartment" AS ENUM ('PRODUCCION', 'INGENIERIA');

-- CreateEnum
CREATE TYPE "ActivityLogSource" AS ENUM ('MANUAL', 'AUTO');

-- AlterTable
ALTER TABLE "ActivityLog" ADD COLUMN     "source" "ActivityLogSource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "workflowStepId" TEXT,
ALTER COLUMN "shift" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ActivityType" ADD COLUMN     "department" "ActivityDepartment" NOT NULL DEFAULT 'PRODUCCION';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "areaId" TEXT;

-- CreateTable
CREATE TABLE "Area" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "processCode" "ProcessCode",
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Area_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Area_code_key" ON "Area"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityLog_workflowStepId_key" ON "ActivityLog"("workflowStepId");

-- CreateIndex
CREATE INDEX "ActivityLog_source_idx" ON "ActivityLog"("source");

-- CreateIndex
CREATE INDEX "ActivityType_department_idx" ON "ActivityType"("department");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_workflowStepId_fkey" FOREIGN KEY ("workflowStepId") REFERENCES "WorkflowStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;
