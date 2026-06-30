import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from "class-validator"

export class UpdateUserDto {

  @IsOptional()
  @IsString()
  username?:string

  @IsOptional()
  @IsString()
  name?:string

  @IsOptional()
  @IsEmail()
  email?:string

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?:string

  @IsOptional()
  @IsUUID()
  roleId?:string

  @IsOptional()
  @IsString()
  icon?:string

  @IsOptional()
  @IsString()
  color?:string

  @IsOptional()
  @IsBoolean()
  active?:boolean

}