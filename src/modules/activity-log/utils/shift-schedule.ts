import { DayShift } from "@prisma/client"
import {
  getLimaDateISO,
  getLimaMinutesOfDay,
  getStartOfTodayInLima,
  limaMinutesToUtc,
} from "./lima-time.util"

/**
 * Definición canónica de franjas — única fuente en el backend.
 * El front puede mostrar labels, pero el estado (upcoming/current/past)
 * y currentShift salen de GET /activity-log/shifts.
 */
export type ShiftSlotDef = {
  shift: DayShift
  startMinutes: number
  /** null = sin cierre (Noche) */
  endMinutes: number | null
  required: boolean
}

export const SHIFT_SLOT_DEFS: ShiftSlotDef[] = [
  {
    shift: DayShift.MORNING_1,
    startMinutes: 8 * 60 + 30,
    endMinutes: 11 * 60,
    required: true,
  },
  {
    shift: DayShift.MORNING_2,
    startMinutes: 11 * 60,
    endMinutes: 13 * 60,
    required: true,
  },
  {
    shift: DayShift.LUNCH,
    startMinutes: 13 * 60,
    endMinutes: 14 * 60,
    required: false,
  },
  {
    shift: DayShift.AFTERNOON_1,
    startMinutes: 14 * 60,
    endMinutes: 16 * 60,
    required: true,
  },
  {
    shift: DayShift.AFTERNOON_2,
    startMinutes: 16 * 60,
    endMinutes: 18 * 60,
    required: true,
  },
  {
    shift: DayShift.NIGHT,
    startMinutes: 18 * 60,
    endMinutes: null,
    required: false,
  },
]

export type SlotState = "upcoming" | "current" | "past"

export type ShiftSlotStatus = {
  shift: DayShift
  state: SlotState
  /** true si se puede registrar/mover a esta franja (current | past) */
  open: boolean
  startMinutes: number
  endMinutes: number | null
  required: boolean
}

export type ShiftScheduleResponse = {
  /** Día calendario Lima (YYYY-MM-DD) */
  date: string
  /** true si `date` es el día Lima actual */
  isToday: boolean
  currentShift: DayShift | null
  /** ISO UTC del reloj del server al armar la respuesta */
  serverNow: string
  /**
   * Próximo instante UTC en el que cambia el estado de alguna franja.
   * null si el día ya terminó (todo past) o es un día pasado.
   * El front agenda un refetch en este momento.
   */
  nextBoundaryAt: string | null
  slots: ShiftSlotStatus[]
}

export function getShiftForDate(date: Date): DayShift {
  const minutes = getLimaMinutesOfDay(date)

  if (minutes < 11 * 60) return DayShift.MORNING_1
  if (minutes < 13 * 60) return DayShift.MORNING_2
  if (minutes < 14 * 60) return DayShift.LUNCH
  if (minutes < 16 * 60) return DayShift.AFTERNOON_1
  if (minutes < 18 * 60) return DayShift.AFTERNOON_2

  return DayShift.NIGHT
}

function slotState(
  def: ShiftSlotDef,
  minutes: number,
  dayIsToday: boolean,
  dayIsPast: boolean,
): SlotState {
  // Día pasado: todo past (se puede registrar tarde según create()).
  if (dayIsPast) return "past"
  // Día futuro: todo upcoming (cerrado).
  if (!dayIsToday && !dayIsPast) return "upcoming"

  if (minutes < def.startMinutes) return "upcoming"
  if (def.endMinutes === null || minutes < def.endMinutes) return "current"
  return "past"
}

/**
 * Construye el schedule del día. `dateISO` opcional (YYYY-MM-DD);
 * sin él = hoy Lima.
 */
export function buildShiftSchedule(
  now: Date = new Date(),
  dateISO?: string,
): ShiftScheduleResponse {
  const todayISO = getLimaDateISO(now)
  const date = dateISO && /^\d{4}-\d{2}-\d{2}$/.test(dateISO) ? dateISO : todayISO
  const isToday = date === todayISO
  const dayIsPast = date < todayISO

  // Minutos Lima del "ahora" solo aplican si es hoy.
  const minutes = isToday ? getLimaMinutesOfDay(now) : dayIsPast ? 24 * 60 : 0

  const slots: ShiftSlotStatus[] = SHIFT_SLOT_DEFS.map(def => {
    const state = slotState(def, minutes, isToday, dayIsPast)
    return {
      shift: def.shift,
      state,
      open: state === "current" || state === "past",
      startMinutes: def.startMinutes,
      endMinutes: def.endMinutes,
      required: def.required,
    }
  })

  const currentShift = isToday ? getShiftForDate(now) : null

  // Próximo boundary solo tiene sentido en el día de hoy.
  let nextBoundaryAt: string | null = null
  if (isToday) {
    const boundaries = SHIFT_SLOT_DEFS.flatMap(def => {
      const list = [def.startMinutes]
      if (def.endMinutes != null) list.push(def.endMinutes)
      return list
    })
      .filter(m => m > minutes)
      .sort((a, b) => a - b)

    if (boundaries.length > 0) {
      nextBoundaryAt = limaMinutesToUtc(now, boundaries[0]).toISOString()
    } else {
      // Fin del día Lima → medianoche siguiente
      nextBoundaryAt = getStartOfTodayInLima(
        new Date(now.getTime() + 24 * 60 * 60 * 1000),
      ).toISOString()
    }
  }

  return {
    date,
    isToday,
    currentShift,
    serverNow: now.toISOString(),
    nextBoundaryAt,
    slots,
  }
}
