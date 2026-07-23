import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator"

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

  // Si va siempre visible como botón directo en el picker (true) o
  // agrupado dentro de "Otros" (false/no viene) — se administra
  // 100% desde acá, el front no tiene ningún código hardcodeado.
  @IsOptional()
  @IsBoolean()
  pinned?: boolean

}