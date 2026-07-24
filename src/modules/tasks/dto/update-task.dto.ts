import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from "class-validator"

import {
  ProcessCode,
} from "@prisma/client"

export class UpdateTaskDto {

  @IsOptional()
  @IsString()
  projectId?:string

  @IsOptional()
  @IsString()
  reference?:string

  @IsOptional()
  @Min(1)
  pieces?:number

  @IsOptional()
  @Min(1)
  lotNumber?:number

  // Solo exige mínimo 1 si Ensamble (EN) está en la ruta enviada en
  // este mismo payload — @IsOptional() no alcanzaba acá porque el
  // form manda 0 explícito (no undefined) cuando no hay Ensamble.
  @IsOptional()
  @ValidateIf(o => o.route?.includes(ProcessCode.EN))
  @Min(1)
  assemblyCount?:number

  @IsOptional()
  @IsNumber()
  @Min(0)
  paintKg?:number

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(
    ProcessCode,
    {
      each:true,
    },
  )
  route?:ProcessCode[]

  @IsOptional()
  @IsString()
  priorityId?:string

  @IsOptional()
  @IsString()
  materialId?:string

  @IsOptional()
  @IsString()
  thicknessId?:string

  @IsOptional()
  @IsString()
  colorId?:string

  @IsOptional()
  @IsString()
  plRt?:string

  @IsOptional()
  @IsDateString()
  deliveryDate?:string

}