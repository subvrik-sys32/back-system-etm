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

import {
  Type,
} from "class-transformer"

import {
  ValidateNested,
} from "class-validator"

import {
  TaskMaterialLineDto,
} from "./task-material-line.dto"

export class CreateTaskDto {

  @IsString()
  projectId!: string

  @IsString()
  reference!: string

  @IsOptional()
  @Min(1)
  pieces?: number

  @IsOptional()
  @IsNumber()
  @Min(1)
  lotNumber?: number

  // Solo exige mínimo 1 si Ensamble (EN) está en la ruta — antes
  // era un @Min(1) incondicional, así que rechazaba cualquier tarea
  // SIN Ensamble en su ruta (el frontend manda 0 en ese caso, que
  // es lo correcto).
  @ValidateIf(o => o.route?.includes(ProcessCode.EN))
  @Min(1)
  assemblyCount!: number

  @IsNumber()
  @Min(0)
  paintKg!: number

  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(
    ProcessCode,
    {
      each: true,
    },
  )
  route!: ProcessCode[]

  @IsString()
  priorityId!: string

  @IsOptional()
  @IsString()
  materialId?: string

  @IsOptional()
  @IsString()
  thicknessId?: string

  /** Multi-material: cada línea material+espesor+piezas. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskMaterialLineDto)
  materials?: TaskMaterialLineDto[]

  @IsOptional()
  @IsString()
  colorId?: string

  @IsOptional()
  @IsString()
  plRt?: string

  @IsOptional()
  @IsDateString()
  deliveryDate?: string

}