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
  StagesService,
} from "./stages.service"

import {
  CreateStageDto,
} from "./dto/create-stage.dto"

import {
  UpdateStageDto,
} from "./dto/update-stage.dto"

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
@Controller("stages")
export class StagesController {

  constructor(

    private readonly stagesService:
      StagesService,

  ){}

  @Get()
  findAll(){

    return this.stagesService
      .findAll()

  }

  @Get(":id")
  findOne(

    @Param("id")
    id:string,

  ){

    return this.stagesService
      .findOne(id)

  }

  @Permissions(
    PermissionCode.MASTER_DATA_UPDATE,
  )
  @Post()
  create(

    @Body()
    dto:CreateStageDto,

    @CurrentUser()
    user:CurrentUserType,

  ){

    return this.stagesService
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
    dto:UpdateStageDto,

    @CurrentUser()
    user:CurrentUserType,

  ){

    return this.stagesService
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

    return this.stagesService
      .remove(id, user.id)

  }

}