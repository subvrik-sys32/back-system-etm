/*
  Warnings:

  - You are about to drop the column `name` on the `EngineeringFile` table. All the data in the column will be lost.
  - You are about to drop the column `storagePath` on the `EngineeringFile` table. All the data in the column will be lost.
  - Added the required column `filename` to the `EngineeringFile` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "EngineeringFile" DROP COLUMN "name",
DROP COLUMN "storagePath",
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "filename" TEXT NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'UPLOADING';
