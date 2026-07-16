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

export class CreateTaskDto {

  @IsString()
  projectId!: string

  @IsString()
  reference!: string

  @Min(1)
  pieces!: number

  @IsOptional()
  @IsNumber()
  @Min(1)
  lotNumber?: number

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

  @IsString()
  materialId!: string

  @IsString()
  thicknessId!: string

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