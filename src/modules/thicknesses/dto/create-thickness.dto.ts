import {
  IsBoolean,
  IsOptional,
  IsString,
} from "class-validator"

export class CreateThicknessDto {

  @IsString()
  name!: string

  @IsString()
  icon!: string

  @IsString()
  color!: string

  @IsOptional()
  @IsBoolean()
  active?: boolean

}