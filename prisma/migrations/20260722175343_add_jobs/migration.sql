-- CreateEnum
CREATE TYPE "JobLevel" AS ENUM ('GENERAL', 'OPERARIO', 'SUPERVISOR');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "level" "JobLevel" NOT NULL DEFAULT 'GENERAL';
