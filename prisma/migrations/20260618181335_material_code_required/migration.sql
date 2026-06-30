/*
  Warnings:

  - A unique constraint covering the columns `[code]` on the table `Material` will be added. If there are existing duplicate values, this will fail.
  - Made the column `code` on table `Material` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Material" ALTER COLUMN "code" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Material_code_key" ON "Material"("code");
