import { ArrayMinSize, IsArray, IsIn, IsString } from "class-validator"

export class SummonWorkflowStepsDto {

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  stepIds!: string[]

  @IsString()
  operatorId!: string

  // ASSIGN: se le pone operatorId ya mismo (asignación directa).
  // INVITE: queda como invitación pendiente hasta que el operario
  // la acepte desde su Mis tareas — ver WorkflowService.summon().
  @IsIn(["ASSIGN", "INVITE"])
  mode!: "ASSIGN" | "INVITE"

}