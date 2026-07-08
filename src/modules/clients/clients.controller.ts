import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common"

import {
  ClientsService,
} from "./clients.service"

import {
  CreateClientDto,
} from "./dto/create-client.dto"

import {
  UpdateClientDto,
} from "./dto/update-client.dto"

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

import {
  RealtimeEntity,
  EntityRealtimeInterceptor,
} from "@/modules/realtime/entity-realtime.interceptor"

@UseGuards(
  JwtAuthGuard,
  PermissionsGuard,
)
@RealtimeEntity("CLIENT")
@UseInterceptors(EntityRealtimeInterceptor)
@Controller("clients")
export class ClientsController {

  constructor(

    private readonly clientsService:
      ClientsService,

  ){}

  @Get()
  findAll(){

    return this.clientsService
      .findAll()

  }

  @Get(":id")
  findOne(

    @Param("id")
    id:string,

  ){

    return this.clientsService
      .findOne(id)

  }

  @Permissions(
    PermissionCode.MASTER_DATA_UPDATE,
  )
  @Post()
  create(

    @Body()
    dto:CreateClientDto,

  ){

    return this.clientsService
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
    dto:UpdateClientDto,

  ){

    return this.clientsService
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

    return this.clientsService
      .remove(id)

  }

}