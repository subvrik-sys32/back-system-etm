-- CreateEnum
CREATE TYPE "DetailAssetKind" AS ENUM ('PHOTO', 'NOTE', 'DXF');

-- CreateTable
CREATE TABLE "DetailAsset" (
    "id" TEXT NOT NULL,
    "kind" "DetailAssetKind" NOT NULL,
    "storageKey" TEXT,
    "publicUrl" TEXT,
    "mimeType" TEXT NOT NULL DEFAULT 'application/octet-stream',
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "originalName" TEXT NOT NULL DEFAULT '',
    "meta" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "projectId" TEXT,
    "taskId" TEXT,
    "materialLineId" TEXT,

    CONSTRAINT "DetailAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DetailAsset_projectId_idx" ON "DetailAsset"("projectId");

-- CreateIndex
CREATE INDEX "DetailAsset_taskId_idx" ON "DetailAsset"("taskId");

-- CreateIndex
CREATE INDEX "DetailAsset_materialLineId_idx" ON "DetailAsset"("materialLineId");

-- CreateIndex
CREATE INDEX "DetailAsset_kind_createdAt_idx" ON "DetailAsset"("kind", "createdAt");

-- AddForeignKey
ALTER TABLE "DetailAsset" ADD CONSTRAINT "DetailAsset_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetailAsset" ADD CONSTRAINT "DetailAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetailAsset" ADD CONSTRAINT "DetailAsset_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetailAsset" ADD CONSTRAINT "DetailAsset_materialLineId_fkey" FOREIGN KEY ("materialLineId") REFERENCES "TaskMaterialLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
