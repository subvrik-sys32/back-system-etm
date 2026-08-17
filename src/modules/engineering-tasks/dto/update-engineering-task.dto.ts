import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateIf,
} from "class-validator"
import {
  EngineeringProcessCode,
  EngineeringTaskStatus,
} from "@prisma/client"

export class UpdateEngineeringTaskDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string

  @IsOptional()
  @IsEnum(EngineeringProcessCode)
  processCode?: EngineeringProcessCode

  @IsOptional()
  @IsEnum(EngineeringTaskStatus)
  status?: EngineeringTaskStatus

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  assigneeId?: string | null

  @IsOptional()
  @IsString()
  note?: string | null
}
