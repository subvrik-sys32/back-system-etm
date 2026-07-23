import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator"

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