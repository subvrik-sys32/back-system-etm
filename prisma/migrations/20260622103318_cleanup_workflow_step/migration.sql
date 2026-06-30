/*
  Warnings:

  - You are about to drop the column `completedById` on the `WorkflowStep` table. All the data in the column will be lost.
  - You are about to drop the column `startedById` on the `WorkflowStep` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "WorkflowStep" DROP CONSTRAINT "WorkflowStep_completedById_fkey";

-- DropForeignKey
ALTER TABLE "WorkflowStep" DROP CONSTRAINT "WorkflowStep_startedById_fkey";

-- AlterTable
ALTER TABLE "WorkflowStep" DROP COLUMN "completedById",
DROP COLUMN "startedById",
ADD COLUMN     "paintKgReal" DOUBLE PRECISION,
ADD COLUMN     "piecesOutput" INTEGER,
ADD COLUMN     "plRtReal" DOUBLE PRECISION,
ADD COLUMN     "reviewedAt" TIMESTAMP(3);
