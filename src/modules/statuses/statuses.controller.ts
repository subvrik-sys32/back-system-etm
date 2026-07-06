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
  StatusesService,
} from "./statuses.service"

import {
  CreateStatusDto,
} from "./dto/create-status.dto"

import {
  UpdateStatusDto,
} from "./dto/update-status.dto"

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
@Controller("statuses")
export class StatusesController {

  constructor(

    private readonly statusesService:
      StatusesService,

  ){}

  @Get()
  findAll(){

    return this.statusesService
      .findAll()

  }

  @Get(":id")
  findOne(

    @Param("id")
    id:string,

  ){

    return this.statusesService
      .findOne(id)

  }

  @Permissions(
    PermissionCode.MASTER_DATA_UPDATE,
  )
  @Post()
  create(

    @Body()
    dto:CreateStatusDto,

  ){

    return this.statusesService
      .create(dto)

  }

  @Permissions(
    PermissionCode.MASTER_DATA_UPDATE,
  )
  @Patch(":id")
  update(

    @Param("id")
    id:string,

    @Body()
    dto:UpdateStatusDto,

  ){

    return this.statusesService
      .update(
        id,
        dto,
      )

  }

  @Permissions(
    PermissionCode.MASTER_DATA_UPDATE,
  )
  @Delete(":id")
  remove(

    @Param("id")
    id:string,

  ){

    return this.statusesService
      .remove(id)

  }

}