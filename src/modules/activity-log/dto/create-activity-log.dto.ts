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

}