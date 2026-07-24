import {
  Controller,
  Get,
  UseGuards,
} from "@nestjs/common"

import {
  AreasService,
} from "./areas.service"

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
@Controller("areas")
export class AreasController {

  constructor(

    private readonly areasService:
      AreasService,

  ) {}

  // MASTER_DATA_READ, no un permiso nuevo — Area es master data
  // como Color/Material/Thickness, y ya lo tiene casi cualquier rol
  // (a diferencia de la Bitácora de Ingeniería, no hace falta
  // restringir por rol acá: listar las áreas no expone nada
  // sensible, y el selector de Perfil en el diálogo de usuario ya
  // solo lo usa quien tiene USER_UPDATE de por sí).
  @Permissions(
    PermissionCode.MASTER_DATA_READ,
  )
  @Get()
  findAll() {

    return this.areasService
      .findAll()

  }

}