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
@Permissions(PermissionCode.ROLE_MANAGE)
@Controller("roles")
export class RolesController {

  constructor(

    private readonly rolesService:
      RolesService,

  ){}

  @Get()

  findAll(){

    return this.rolesService
      .findAll()

  }

  @Post()

  create(

    @Body()
    dto:CreateRoleDto,

  ){

    return this.rolesService
      .create(dto)

  }

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

  @Delete(":id")

  remove(

    @Param("id")
    id:string,

  ){

    return this.rolesService
      .remove(id)

  }

  @Get(":id/permissions")

  findPermissions(

    @Param("id")
    id:string,

  ){

    return this.rolesService
      .findPermissions(id)

  }

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