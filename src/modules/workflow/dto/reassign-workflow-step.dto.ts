import { IsString, IsNotEmpty } from "class-validator"

export class ReassignWorkflowStepDto {
  @IsString()
  @IsNotEmpty()
  stepId!: string

  @IsString()
  @IsNotEmpty()
  operatorId!: string
}
