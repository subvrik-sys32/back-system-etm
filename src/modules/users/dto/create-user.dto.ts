import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from "class-validator"
import { JobLevel } from "@prisma/client"

export class CreateUserDto {

  @IsOptional()
  @IsString()
  username?: string

  @IsString()
  name!: string

  @IsEmail()
  email!: string

  @IsString()
  @MinLength(8)
  password!: string

  @IsUUID()
  roleId!: string

  @IsOptional()
  @IsEnum(JobLevel)
  level?: JobLevel

  // Array vacío/ausente = "OPERARIO pero todavía sin ningún área
  // elegida" — antes era un solo areaId (nullable), ahora puede
  // pertenecer a varias a la vez.
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  areaIds?: string[]

  @IsString()
  icon!: string

  @IsString()
  color!: string

  @IsOptional()
  @IsBoolean()
  active?: boolean

}