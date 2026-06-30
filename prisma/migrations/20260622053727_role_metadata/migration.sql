/*
  Warnings:

  - A unique constraint covering the columns `[code]` on the table `Role` will be added. If there are existing duplicate values, this will fail.
  - Made the column `color` on table `Client` required. This step will fail if there are existing NULL values in that column.
  - Made the column `icon` on table `Client` required. This step will fail if there are existing NULL values in that column.
  - Made the column `icon` on table `Color` required. This step will fail if there are existing NULL values in that column.
  - Made the column `color` on table `Material` required. This step will fail if there are existing NULL values in that column.
  - Made the column `icon` on table `Material` required. This step will fail if there are existing NULL values in that column.
  - Made the column `color` on table `Priority` required. This step will fail if there are existing NULL values in that column.
  - Made the column `icon` on table `Priority` required. This step will fail if there are existing NULL values in that column.
  - Made the column `color` on table `Stage` required. This step will fail if there are existing NULL values in that column.
  - Made the column `icon` on table `Stage` required. This step will fail if there are existing NULL values in that column.
  - Made the column `color` on table `Status` required. This step will fail if there are existing NULL values in that column.
  - Made the column `icon` on table `Status` required. This step will fail if there are existing NULL values in that column.
  - Made the column `color` on table `Thickness` required. This step will fail if there are existing NULL values in that column.
  - Made the column `icon` on table `Thickness` required. This step will fail if there are existing NULL values in that column.
  - Made the column `color` on table `User` required. This step will fail if there are existing NULL values in that column.
  - Made the column `icon` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "Role_name_key";

-- AlterTable
ALTER TABLE "Client" ALTER COLUMN "color" SET NOT NULL,
ALTER COLUMN "icon" SET NOT NULL;

-- AlterTable
ALTER TABLE "Color" ALTER COLUMN "icon" SET NOT NULL;

-- AlterTable
ALTER TABLE "Material" ALTER COLUMN "color" SET NOT NULL,
ALTER COLUMN "icon" SET NOT NULL;

-- AlterTable
ALTER TABLE "Priority" ALTER COLUMN "color" SET NOT NULL,
ALTER COLUMN "icon" SET NOT NULL;

-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "code" TEXT,
ADD COLUMN     "color" TEXT,
ADD COLUMN     "icon" TEXT;

-- AlterTable
ALTER TABLE "Stage" ALTER COLUMN "color" SET NOT NULL,
ALTER COLUMN "icon" SET NOT NULL;

-- AlterTable
ALTER TABLE "Status" ALTER COLUMN "color" SET NOT NULL,
ALTER COLUMN "icon" SET NOT NULL;

-- AlterTable
ALTER TABLE "Thickness" ALTER COLUMN "color" SET NOT NULL,
ALTER COLUMN "icon" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "color" SET NOT NULL,
ALTER COLUMN "icon" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");
