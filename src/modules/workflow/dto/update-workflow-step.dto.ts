import { IsArray, IsEnum, IsNumber, IsOptional, IsString } from "class-validator"
import { StepExecution } from "@prisma/client"

export class UpdateWorkflowStepDto {

  @IsOptional()
  @IsEnum(StepExecution)
  execution?: StepExecution

  @IsOptional()
  @IsString()
  operatorId?: string

  /** Operarios adicionales (no primary). */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  coOperatorIds?: string[]

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