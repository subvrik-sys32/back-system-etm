import {
  IsBoolean,
  IsOptional,
  IsString,
} from "class-validator"

export class UpdateColorDto {

  @IsOptional()
  @IsString()
  name?: string

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