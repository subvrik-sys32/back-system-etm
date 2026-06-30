import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator"

export class CreateClientDto{

  @IsString()
  @MaxLength(200)
  name!:string

  @IsString()
  icon!:string

  @IsString()
  color!:string

  @IsOptional()
  @IsBoolean()
  active?:boolean

}