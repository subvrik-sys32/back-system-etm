import {
  Controller,
  Get,
  UseGuards,
} from "@nestjs/common"

import {
  PermissionsService,
} from "./permissions.service"

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
@Controller("permissions")
export class PermissionsController {

  constructor(

    private readonly permissionsService:
      PermissionsService,

  ){}

  @Get()

  findAll(){

    return this.permissionsService
      .findAll()

  }

}