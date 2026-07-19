import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator"

export class CreateActivityTypeDto {

  @IsNotEmpty()
  @IsString()
  @MaxLength(60)
  label!: string

  @IsNotEmpty()
  @IsString()
  icon!: string

  @IsNotEmpty()
  @IsString()
  color!: string

  @IsOptional()
  @IsInt()
  order?: number

}