/*
  Warnings:

  - A unique constraint covering the columns `[code]` on the table `Client` will be added. If there are existing duplicate values, this will fail.
  - Made the column `code` on table `Client` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Client" ALTER COLUMN "code" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Client_code_key" ON "Client"("code");
