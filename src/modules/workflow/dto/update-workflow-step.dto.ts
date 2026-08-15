import { IsArray, IsNumber, IsOptional, IsString } from "class-validator"

export class UpdateWorkflowStepDto {

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