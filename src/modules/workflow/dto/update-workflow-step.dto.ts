import { IsNumber, IsOptional, IsString } from "class-validator"

export class UpdateWorkflowStepDto {

  @IsOptional()
  @IsString()
  operatorId?: string

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