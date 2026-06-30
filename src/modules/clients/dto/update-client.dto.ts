import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator"

export class UpdateClientDto {

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?:string

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