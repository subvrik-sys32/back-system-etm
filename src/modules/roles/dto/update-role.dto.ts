import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator"

// "code" a propósito NO está acá — es inmutable después de creado.
// El seed y algunos guards referencian roles por code (ej.
// rolePermissionsSeed.ADMIN, @Roles("ADMIN")); permitir renombrarlo
// desde este endpoint podría desconectar un rol existente de esas
// referencias sin ningún aviso.
export class UpdateRoleDto {

  @IsOptional()
  @IsString()
  @MaxLength(60)
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