import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator"
import { DayShift } from "@prisma/client"

export class CreateActivityLogDto {

  @IsNotEmpty()
  @IsString()
  activityTypeId!: string

  @IsNotEmpty()
  @IsString()
  projectId!: string

  @IsOptional()
  @IsString()
  taskId?: string

  // Franja que la persona eligió a mano en el picker (tocó el "+"
  // de esa franja puntual). Si no viene (ej. otro flujo que no
  // pasa por el picker), el service cae a calcularla por la hora
  // real — ver ActivityLogService.create().
  @IsOptional()
  @IsEnum(DayShift)
  shift?: DayShift

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string

  // Data URI (data:image/...;base64,...) o base64 plano — se
  // comprime y sube a Supabase Storage en el service, igual que en
  // comentarios.
  @IsOptional()
  @IsString()
  photoBase64?: string

}