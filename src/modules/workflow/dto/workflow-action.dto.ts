import { IsNumber, IsOptional } from "class-validator"

export class WorkflowActionDto {

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