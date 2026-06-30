/*
  Warnings:

  - A unique constraint covering the columns `[code]` on the table `Priority` will be added. If there are existing duplicate values, this will fail.
  - Made the column `code` on table `Priority` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Priority" ALTER COLUMN "code" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Priority_code_key" ON "Priority"("code");
