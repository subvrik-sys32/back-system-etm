import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common"

import {
  RolesService,
} from "./roles.service"

import {
  CreateRoleDto,
} from "./dto/create-role.dto"

import {
  UpdateRoleDto,
} from "./dto/update-role.dto"

import {
  UpdateRolePermissionsDto,
} from "./dto/update-role-permissions.dto"

import {
  JwtAuthGuard,
} from "@/modules/auth/guards/jwt-auth.guard"

import {
  PermissionsGuard,
} from "@/shared/guards/permissions.guard"

import {
  Permissions,
} from "@/shared/decorators/permissions.decorator"

import {
  PermissionCode,
} from "@/core/enums/permission-code.enum"

@UseGuards(
  JwtAuthGuard,
  PermissionsGuard,
)
@Controller("roles")
export class RolesController {

  constructor(

    private readonly rolesService:
      RolesService,

  ){}

  // A diferencia del resto de este controller: esto es solo lectura
  // (nombre/color/ícono de cada rol, sin detalle de permisos) y lo
  // necesita cualquiera que pueda ver la página de Usuarios
  // (RoleSelect al editar, panel de filtro por rol) — exigir
  // ROLE_MANAGE acá rompía esa página entera para cualquiera que no
  // fuera ADMIN, aunque nunca fueran a tocar nada de roles en sí.
  @Permissions(PermissionCode.USER_READ)
  @Get()

  findAll(){

    return this.rolesService
      .findAll()

  }

  @Permissions(PermissionCode.ROLE_MANAGE)
  @Post()

  create(

    @Body()
    dto:CreateRoleDto,

  ){

    return this.rolesService
      .create(dto)

  }

  @Permissions(PermissionCode.ROLE_MANAGE)
  @Patch(":id")

  update(

    @Param("id")
    id:string,

    @Body()
    dto:UpdateRoleDto,

  ){

    return this.rolesService
      .update(id,dto)

  }

  @Permissions(PermissionCode.ROLE_MANAGE)
  @Delete(":id")

  remove(

    @Param("id")
    id:string,

  ){

    return this.rolesService
      .remove(id)

  }

  // El detalle de permisos de un rol sí es sensible (expone qué
  // puede hacer cada rol en detalle) — se queda en ROLE_MANAGE,
  // solo lo usa la pantalla "Roles y Permisos" (ya gateada igual en
  // el nav).
  @Permissions(PermissionCode.ROLE_MANAGE)
  @Get(":id/permissions")

  findPermissions(

    @Param("id")
    id:string,

  ){

    return this.rolesService
      .findPermissions(id)

  }

  @Permissions(PermissionCode.ROLE_MANAGE)
  @Patch(":id/permissions")

  updatePermissions(

    @Param("id")
    id:string,

    @Body()
    dto:UpdateRolePermissionsDto,

  ){

    return this.rolesService
      .updatePermissions(id,dto.permissionIds)

  }

}