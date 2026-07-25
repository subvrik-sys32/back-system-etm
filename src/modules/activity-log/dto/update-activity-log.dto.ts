import { IsEnum } from "class-validator"
import { DayShift } from "@prisma/client"

// Único campo editable por ahora: la franja (shift). Es lo que
// habilita "arrastrar una actividad mal posicionada a otra franja
// disponible" — no se permite tocar activityType/project/task/note
// desde acá, eso sigue siendo "borrar y volver a crear" a propósito
// (evita reabrir la superficie de edición completa por un caso de
// uso que solo necesita mover el slot).
export class UpdateActivityLogDto {

  @IsEnum(DayShift)
  shift!: DayShift

}