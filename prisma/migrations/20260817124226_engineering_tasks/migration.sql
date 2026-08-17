-- CreateEnum
CREATE TYPE "EngineeringProcessCode" AS ENUM ('MECHANICAL_DESIGN', 'ELECTRICAL_DESIGN', 'MECHANICAL_PLAN', 'ELECTRICAL_PLAN', 'LM_GEOS', 'CAM', 'BENDING', 'WELDING', 'PROCUREMENT');

-- CreateEnum
CREATE TYPE "EngineeringTaskStatus" AS ENUM ('QUEUE', 'PENDING', 'PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "EngineeringTask" (
    "id" TEXT NOT NULL,
    "taskNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "processCode" "EngineeringProcessCode" NOT NULL,
    "status" "EngineeringTaskStatus" NOT NULL DEFAULT 'QUEUE',
    "assigneeId" TEXT,
    "note" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EngineeringTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EngineeringTask_taskNumber_key" ON "EngineeringTask"("taskNumber");

-- CreateIndex
CREATE INDEX "EngineeringTask_projectId_idx" ON "EngineeringTask"("projectId");

-- CreateIndex
CREATE INDEX "EngineeringTask_processCode_idx" ON "EngineeringTask"("processCode");

-- CreateIndex
CREATE INDEX "EngineeringTask_assigneeId_idx" ON "EngineeringTask"("assigneeId");

-- CreateIndex
CREATE INDEX "EngineeringTask_status_idx" ON "EngineeringTask"("status");

-- AddForeignKey
ALTER TABLE "EngineeringTask" ADD CONSTRAINT "EngineeringTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngineeringTask" ADD CONSTRAINT "EngineeringTask_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngineeringTask" ADD CONSTRAINT "EngineeringTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngineeringTask" ADD CONSTRAINT "EngineeringTask_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
