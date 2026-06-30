/*
  Warnings:

  - Made the column `code` on table `Role` required. This step will fail if there are existing NULL values in that column.
  - Made the column `color` on table `Role` required. This step will fail if there are existing NULL values in that column.
  - Made the column `icon` on table `Role` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Role" ALTER COLUMN "code" SET NOT NULL,
ALTER COLUMN "color" SET NOT NULL,
ALTER COLUMN "icon" SET NOT NULL;
