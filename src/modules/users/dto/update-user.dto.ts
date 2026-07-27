import {
  ArrayNotEmpty,
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

export class UpdateUserDto {

  @IsOptional()
  @IsString()
  username?: string

  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsEmail()
  email?: string

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string

  // undefined = no tocar los roles actuales; un array reemplaza el
  // conjunto completo — pero nunca puede quedar vacío (a diferencia
  // de areaIds), un usuario siempre necesita al menos un rol.
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  roleIds?: string[]

  @IsOptional()
  @IsEnum(JobLevel)
  level?: JobLevel

  // Array vacío = "limpiar todas las áreas", undefined = "no
  // tocar" (mismo criterio que level arriba) — antes era un solo
  // areaId (nullable), ahora puede pertenecer a varias a la vez.
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  areaIds?: string[]

  @IsOptional()
  @IsString()
  icon?: string

  @IsOptional()
  @IsString()
  color?: string

  @IsOptional()
  @IsBoolean()
  active?: boolean

}