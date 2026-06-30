import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
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

  @IsOptional()
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