import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from "class-validator"
import { EngineeringProcessCode } from "@prisma/client"

export class CreateEngineeringTaskDto {
  @IsString()
  @MinLength(1)
  title!: string

  @IsUUID()
  projectId!: string

  @IsEnum(EngineeringProcessCode)
  processCode!: EngineeringProcessCode

  @IsOptional()
  @IsUUID()
  assigneeId?: string

  @IsOptional()
  @IsString()
  note?: string
}
