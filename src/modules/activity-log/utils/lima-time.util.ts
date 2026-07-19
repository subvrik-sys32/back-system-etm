// Perú no tiene horario de verano, así que el offset UTC-5 es fijo
// todo el año. Usamos Intl en vez de asumir la TZ del servidor,
// porque el servidor corre en UTC (o cualquier otra) y no en
// "America/Lima" — depender de date.getHours() ahí rompía el
// cálculo de turno para cualquier usuario en Perú.
const LIMA_TIME_ZONE = "America/Lima"

/**
 * Hora local de Lima (0-23) para una fecha dada.
 */
export function getLimaHour(date: Date): number {

  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: LIMA_TIME_ZONE,
    hour: "numeric",
    hour12: false,
  }).format(date)

  // Intl puede devolver "24" para medianoche en vez de "0" según el
  // runtime — se normaliza a 0-23.
  const hour = Number(formatted)

  return hour === 24 ? 0 : hour

}

/**
 * Medianoche (00:00) de "hoy" en hora Lima, expresada como instante
 * UTC real — para poder compararla contra loggedAt en la query de
 * Prisma.
 */
export function getStartOfTodayInLima(date: Date = new Date()): Date {

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: LIMA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)

  const year = parts.find(p => p.type === "year")!.value
  const month = parts.find(p => p.type === "month")!.value
  const day = parts.find(p => p.type === "day")!.value

  // Lima es UTC-5 fijo → medianoche Lima = 05:00 UTC del mismo día.
  return new Date(`${year}-${month}-${day}T05:00:00.000Z`)

}