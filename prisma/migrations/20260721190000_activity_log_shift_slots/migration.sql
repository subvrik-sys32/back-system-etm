-- Bitácora: de 3 franjas (MORNING/AFTERNOON/NIGHT, ilimitadas) a 6
-- franjas atómicas de 1 registro c/u (MORNING_1, MORNING_2, LUNCH,
-- AFTERNOON_1, AFTERNOON_2, NIGHT). No hay mapeo 1:1 entre lo viejo y
-- lo nuevo (MORNING se parte en 2, por ejemplo), así que en vez de
-- traducir el valor viejo de "shift" se recalcula directo desde
-- "loggedAt" -- exactamente la misma fuente de verdad que usa
-- ActivityLogService.getShiftForDate() para las entradas nuevas, así
-- que las entradas viejas terminan clasificadas con el mismo
-- criterio que las nuevas.

-- 1. Enum nuevo con las 6 franjas.
CREATE TYPE "DayShift_new" AS ENUM ('MORNING_1', 'MORNING_2', 'LUNCH', 'AFTERNOON_1', 'AFTERNOON_2', 'NIGHT');

-- 2. Columna temporal con el enum nuevo.
ALTER TABLE "ActivityLog" ADD COLUMN "shift_new" "DayShift_new";

-- 3. Backfill: Lima es UTC-5 fijo (sin horario de verano), así que
-- "loggedAt" (guardado en UTC) menos 5 horas da la hora local de
-- Lima -- mismo criterio que getLimaHour()/getLimaMinutesOfDay().
UPDATE "ActivityLog"
SET "shift_new" = (
  CASE
    WHEN (
      EXTRACT(HOUR FROM ("loggedAt" - INTERVAL '5 hours')) * 60
      + EXTRACT(MINUTE FROM ("loggedAt" - INTERVAL '5 hours'))
    ) < 11 * 60 THEN 'MORNING_1'
    WHEN (
      EXTRACT(HOUR FROM ("loggedAt" - INTERVAL '5 hours')) * 60
      + EXTRACT(MINUTE FROM ("loggedAt" - INTERVAL '5 hours'))
    ) < 13 * 60 THEN 'MORNING_2'
    WHEN (
      EXTRACT(HOUR FROM ("loggedAt" - INTERVAL '5 hours')) * 60
      + EXTRACT(MINUTE FROM ("loggedAt" - INTERVAL '5 hours'))
    ) < 14 * 60 THEN 'LUNCH'
    WHEN (
      EXTRACT(HOUR FROM ("loggedAt" - INTERVAL '5 hours')) * 60
      + EXTRACT(MINUTE FROM ("loggedAt" - INTERVAL '5 hours'))
    ) < 16 * 60 THEN 'AFTERNOON_1'
    WHEN (
      EXTRACT(HOUR FROM ("loggedAt" - INTERVAL '5 hours')) * 60
      + EXTRACT(MINUTE FROM ("loggedAt" - INTERVAL '5 hours'))
    ) < 18 * 60 THEN 'AFTERNOON_2'
    ELSE 'NIGHT'
  END
)::"DayShift_new";

-- 4. Ya no puede haber NULLs (todas las filas existentes tenían un
-- shift viejo, así que todas recibieron un shift_new).
ALTER TABLE "ActivityLog" ALTER COLUMN "shift_new" SET NOT NULL;

-- 5. Reemplazar la columna y el tipo viejos por los nuevos.
ALTER TABLE "ActivityLog" DROP COLUMN "shift";
ALTER TABLE "ActivityLog" RENAME COLUMN "shift_new" TO "shift";

DROP TYPE "DayShift";
ALTER TYPE "DayShift_new" RENAME TO "DayShift";