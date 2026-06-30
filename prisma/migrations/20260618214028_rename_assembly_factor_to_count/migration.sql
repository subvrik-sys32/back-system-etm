/*
  Warnings:

  - You are about to drop the column `assemblyFactor` on the `Task` table. All the data in the column will be lost.
  - Added the required column `assemblyCount` to the `Task` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Task" DROP COLUMN "assemblyFactor",
ADD COLUMN     "assemblyCount" INTEGER NOT NULL;
