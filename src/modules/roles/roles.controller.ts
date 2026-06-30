import {
  Controller,
  Get,
  Param,
  UseGuards,
} from "@nestjs/common"

import {
  RolesService,
} from "./roles.service"

import {
  JwtAuthGuard,
} from "@/modules/auth/guards/jwt-auth.guard"

import {
  RolesGuard,
} from "@/shared/guards/roles.guard"

import {
  Roles,
} from "@/shared/decorators/roles.decorator"

@UseGuards(
  JwtAuthGuard,
  RolesGuard,
)
@Roles("ADMIN")
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

  @Get(":id/permissions")

  findPermissions(

    @Param("id")
    id:string,

  ){

    return this.rolesService
      .findPermissions(id)

  }

}