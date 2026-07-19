import { IsBoolean, IsInt, IsOptional, IsString, MaxLength } from "class-validator"

export class UpdateActivityTypeDto {

  @IsOptional()
  @IsString()
  @MaxLength(60)
  label?: string

  @IsOptional()
  @IsString()
  icon?: string

  @IsOptional()
  @IsString()
  color?: string

  @IsOptional()
  @IsInt()
  order?: number

  @IsOptional()
  @IsBoolean()
  active?: boolean

}