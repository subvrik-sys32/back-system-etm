import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from "class-validator"

export class CreateUserDto {

  @IsOptional()
  @IsString()
  username?:string

  @IsString()
  name!:string

  @IsEmail()
  email!:string

  @IsString()
  @MinLength(8)
  password!:string

  @IsUUID()
  roleId!:string

  @IsString()
  icon!:string

  @IsString()
  color!:string

  @IsOptional()
  @IsBoolean()
  active?:boolean

}