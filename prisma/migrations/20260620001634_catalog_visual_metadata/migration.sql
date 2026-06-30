/*
  Warnings:

  - Made the column `hex` on table `Color` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "color" TEXT,
ADD COLUMN     "icon" TEXT;

-- AlterTable
ALTER TABLE "Color" ADD COLUMN     "icon" TEXT,
ALTER COLUMN "hex" SET NOT NULL;

-- AlterTable
ALTER TABLE "Material" ADD COLUMN     "color" TEXT,
ADD COLUMN     "icon" TEXT;

-- AlterTable
ALTER TABLE "Priority" ADD COLUMN     "icon" TEXT;

-- AlterTable
ALTER TABLE "Stage" ADD COLUMN     "color" TEXT,
ADD COLUMN     "icon" TEXT;

-- AlterTable
ALTER TABLE "Status" ADD COLUMN     "color" TEXT,
ADD COLUMN     "icon" TEXT;

-- AlterTable
ALTER TABLE "Thickness" ADD COLUMN     "color" TEXT,
ADD COLUMN     "icon" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "color" TEXT,
ADD COLUMN     "icon" TEXT;
