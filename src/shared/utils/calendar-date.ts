/**
 * Fechas de calendario (deliveryDate, etc.): sin hora ni zona.
 *
 * Contrato API: siempre string "YYYY-MM-DD" | null.
 * DB (Postgres DATE / Prisma @db.Date): día civil, sin timestamp.
 *
 * Nunca usar `new Date("YYYY-MM-DD")` a secas: en JS es UTC 00:00
 * y al formatear en UTC−5 el día “baja” uno.
 */

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})/

/** Parsea "YYYY-MM-DD" → Date UTC a medianoche (Prisma @db.Date). */
export function parseDateOnly(
  value?: string | null,
): Date | null {
  if (value == null || value === "") return null

  const match = DATE_ONLY.exec(String(value).trim())
  if (!match) {
    throw new Error(`Fecha inválida (se espera YYYY-MM-DD): ${value}`)
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  // UTC medianoche: con columna DATE solo se persiste el día.
  return new Date(Date.UTC(year, month - 1, day))
}

/** Date | ISO → "YYYY-MM-DD" para el contrato API. */
export function formatDateOnly(
  value?: Date | string | null,
): string | null {
  if (value == null || value === "") return null

  if (typeof value === "string") {
    const match = DATE_ONLY.exec(value.trim())
    return match ? match[0] : value.slice(0, 10)
  }

  // Prisma @db.Date / DATE → JS Date en UTC 00:00
  return value.toISOString().slice(0, 10)
}

/** Aplana deliveryDate en una entidad (y project anidado si existe). */
export function withCalendarDates<T extends Record<string, unknown>>(
  entity: T,
): T {
  const next = { ...entity } as Record<string, unknown>

  if ("deliveryDate" in next) {
    next.deliveryDate = formatDateOnly(
      next.deliveryDate as Date | string | null,
    )
  }

  const project = next.project
  if (project && typeof project === "object") {
    next.project = withCalendarDates(
      project as Record<string, unknown>,
    )
  }

  return next as T
}
