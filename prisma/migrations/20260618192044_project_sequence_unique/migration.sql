/*
  Warnings:

  - A unique constraint covering the columns `[sequence]` on the table `Project` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Project_sequence_key" ON "Project"("sequence");
