import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator"

export class CreateActivityLogDto {

  @IsNotEmpty()
  @IsString()
  activityTypeId!: string

  // Opcionales — vinculan la entrada a trabajo real ya existente en
  // el sistema. Pensado sobre todo para el tipo "Produciendo", pero
  // sin restricción a nivel de datos: cualquier tipo puede
  // vincularse si tiene sentido.
  @IsOptional()
  @IsString()
  projectId?: string

  @IsOptional()
  @IsString()
  taskId?: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string

}