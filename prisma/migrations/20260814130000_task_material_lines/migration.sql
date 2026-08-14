-- CreateTable
CREATE TABLE IF NOT EXISTS "TaskMaterialLine" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "thicknessId" TEXT NOT NULL,
    "pieces" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "TaskMaterialLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TaskMaterialLine_taskId_idx" ON "TaskMaterialLine"("taskId");

ALTER TABLE "TaskMaterialLine" DROP CONSTRAINT IF EXISTS "TaskMaterialLine_taskId_fkey";
ALTER TABLE "TaskMaterialLine" ADD CONSTRAINT "TaskMaterialLine_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskMaterialLine" DROP CONSTRAINT IF EXISTS "TaskMaterialLine_materialId_fkey";
ALTER TABLE "TaskMaterialLine" ADD CONSTRAINT "TaskMaterialLine_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TaskMaterialLine" DROP CONSTRAINT IF EXISTS "TaskMaterialLine_thicknessId_fkey";
ALTER TABLE "TaskMaterialLine" ADD CONSTRAINT "TaskMaterialLine_thicknessId_fkey" FOREIGN KEY ("thicknessId") REFERENCES "Thickness"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: one line per existing task
INSERT INTO "TaskMaterialLine" ("id", "taskId", "materialId", "thicknessId", "pieces", "sortOrder")
SELECT gen_random_uuid()::text, t."id", t."materialId", t."thicknessId", t."pieces", 0
FROM "Task" t
WHERE NOT EXISTS (
  SELECT 1 FROM "TaskMaterialLine" l WHERE l."taskId" = t."id"
);
