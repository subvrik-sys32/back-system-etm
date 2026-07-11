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
  PrioritiesService,
} from "./priorities.service"

import {
  CreatePriorityDto,
} from "./dto/create-priority.dto"

import {
  UpdatePriorityDto,
} from "./dto/update-priority.dto"

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
  CurrentUser,
} from "@/shared/decorators/current-user.decorator"

import type {
  CurrentUserType,
} from "@/shared/types/current-user.types"

import {
  PermissionCode,
} from "@/core/enums/permission-code.enum"

@UseGuards(
  JwtAuthGuard,
  PermissionsGuard,
)
@Controller("priorities")
export class PrioritiesController {

  constructor(

    private readonly prioritiesService:
      PrioritiesService,

  ){}

  @Get()
  findAll(){

    return this.prioritiesService
      .findAll()

  }

  @Get(":id")
  findOne(

    @Param("id")
    id:string,

  ){

    return this.prioritiesService
      .findOne(id)

  }

  @Permissions(
    PermissionCode.MASTER_DATA_UPDATE,
  )
  @Post()
  create(

    @Body()
    dto:CreatePriorityDto,

    @CurrentUser()
    user:CurrentUserType,

  ){

    return this.prioritiesService
      .create(dto, user.id)

  }

  @Permissions(
    PermissionCode.MASTER_DATA_UPDATE,
  )
  @Patch(":id")
  update(

    @Param("id")
    id:string,

    @Body()
    dto:UpdatePriorityDto,

    @CurrentUser()
    user:CurrentUserType,

  ){

    return this.prioritiesService
      .update(
        id,
        dto,
        user.id,
      )

  }

  @Permissions(
    PermissionCode.MASTER_DATA_UPDATE,
  )
  @Delete(":id")
  remove(

    @Param("id")
    id:string,

    @CurrentUser()
    user:CurrentUserType,

  ){

    return this.prioritiesService
      .remove(id, user.id)

  }

}