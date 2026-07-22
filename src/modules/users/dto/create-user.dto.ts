import {
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

  @IsString()
  icon!: string

  @IsString()
  color!: string

  @IsOptional()
  @IsBoolean()
  active?: boolean

}