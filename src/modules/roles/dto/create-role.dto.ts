import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from "class-validator"

export class CreateRoleDto {

  // Mayúsculas y guion bajo — mismo formato que ADMIN/OPERARIO/etc,
  // porque el sistema de seed y algunos guards existentes referencian
  // roles POR CODE (ej. rolePermissionsSeed[role.code]).
  @IsNotEmpty()
  @IsString()
  @MaxLength(40)
  @Matches(/^[A-Z_]+$/, {
    message: "code solo puede tener mayúsculas y guion bajo",
  })
  code!: string

  @IsNotEmpty()
  @IsString()
  @MaxLength(60)
  name!: string

  @IsNotEmpty()
  @IsString()
  icon!: string

  @IsNotEmpty()
  @IsString()
  color!: string

  @IsOptional()
  @IsBoolean()
  active?: boolean

}