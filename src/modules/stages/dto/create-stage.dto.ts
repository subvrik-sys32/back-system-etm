import {
  IsBoolean,
  IsOptional,
  IsString,
} from "class-validator"

export class CreateStageDto {

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