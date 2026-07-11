/*
  Warnings:

  - You are about to drop the column `deletedAt` on the `EngineeringFile` table. All the data in the column will be lost.
  - You are about to drop the column `projectId` on the `EngineeringFile` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "EngineeringFile" DROP COLUMN "deletedAt",
DROP COLUMN "projectId",
ADD COLUMN     "metadata" JSONB;
