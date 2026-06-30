/*
  Warnings:

  - You are about to drop the column `hex` on the `Color` table. All the data in the column will be lost.
  - Added the required column `color` to the `Color` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Color" DROP COLUMN "hex",
ADD COLUMN     "color" TEXT NOT NULL;
