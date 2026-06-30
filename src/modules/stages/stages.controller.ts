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

  @Permissions(
    PermissionCode.MASTER_DATA_READ,
  )
  @Get()
  findAll(){

    return this.stagesService
      .findAll()

  }

  @Permissions(
    PermissionCode.MASTER_DATA_READ,
  )
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

  ){

    return this.stagesService
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
    dto:UpdateStageDto,

  ){

    return this.stagesService
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

    return this.stagesService
      .remove(id)

  }

}