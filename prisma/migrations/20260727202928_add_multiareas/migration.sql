/*
  Warnings:

  - You are about to drop the column `areaId` on the `User` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_areaId_fkey";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "areaId";

-- CreateTable
CREATE TABLE "_AreaToUser" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AreaToUser_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_AreaToUser_B_index" ON "_AreaToUser"("B");

-- AddForeignKey
ALTER TABLE "_AreaToUser" ADD CONSTRAINT "_AreaToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AreaToUser" ADD CONSTRAINT "_AreaToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
