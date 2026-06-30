/*
  Warnings:

  - A unique constraint covering the columns `[code]` on the table `Color` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[code]` on the table `Thickness` will be added. If there are existing duplicate values, this will fail.
  - Made the column `code` on table `Color` required. This step will fail if there are existing NULL values in that column.
  - Made the column `code` on table `Thickness` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Color" ALTER COLUMN "code" SET NOT NULL;

-- AlterTable
ALTER TABLE "Thickness" ALTER COLUMN "code" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Color_code_key" ON "Color"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Thickness_code_key" ON "Thickness"("code");
