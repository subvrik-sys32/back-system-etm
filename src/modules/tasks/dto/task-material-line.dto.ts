import { IsInt, IsString, Min } from "class-validator"

export class TaskMaterialLineDto {
  @IsString()
  materialId!: string

  @IsString()
  thicknessId!: string

  @IsInt()
  @Min(1)
  pieces!: number
}
