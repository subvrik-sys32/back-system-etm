import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator"
import { ActivityDepartment } from "@prisma/client"

export class UpdateActivityTypeDto {

  @IsOptional()
  @IsString()
  @MaxLength(60)
  label?: string

  @IsOptional()
  @IsString()
  icon?: string

  @IsOptional()
  @IsString()
  color?: string

  @IsOptional()
  @IsInt()
  order?: number

  @IsOptional()
  @IsBoolean()
  active?: boolean

  @IsOptional()
  @IsBoolean()
  pinned?: boolean

  @IsOptional()
  @IsEnum(ActivityDepartment)
  department?: ActivityDepartment

  @IsOptional()
  @IsString()
  @MaxLength(40)
  code?: string

}