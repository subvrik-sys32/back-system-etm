import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator"
import { DayShift } from "@prisma/client"

// Campos opcionales: mover franja y/o editar contenido.
// AUTO no se edita desde el service (Forbidden).
export class UpdateActivityLogDto {

  @IsOptional()
  @IsEnum(DayShift)
  shift?: DayShift

  @IsOptional()
  @IsString()
  activityTypeId?: string

  @IsOptional()
  @IsString()
  projectId?: string

  @IsOptional()
  @IsString()
  taskId?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null

}