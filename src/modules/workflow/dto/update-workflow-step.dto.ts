import { IsArray, IsEnum, IsNumber, IsOptional, IsString } from "class-validator"
import { StepExecution } from "@prisma/client"

export class UpdateWorkflowStepDto {

  @IsOptional()
  @IsString()
  operatorId?: string | null

  /** Operarios adicionales (no primary). */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  coOperatorIds?: string[]

  @IsOptional()
  @IsEnum(StepExecution)
  execution?: StepExecution

  @IsOptional()
  @IsNumber()
  piecesOutput?: number

  @IsOptional()
  @IsNumber()
  plRtReal?: number

  @IsOptional()
  @IsNumber()
  paintKgReal?: number
}
