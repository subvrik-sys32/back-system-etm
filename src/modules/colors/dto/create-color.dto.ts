import {
  IsBoolean,
  IsOptional,
  IsString,
} from "class-validator"

export class CreateColorDto {

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