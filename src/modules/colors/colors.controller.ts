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
  ColorsService,
} from "./colors.service"

import {
  CreateColorDto,
} from "./dto/create-color.dto"

import {
  UpdateColorDto,
} from "./dto/update-color.dto"

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
@Controller("colors")
export class ColorsController {

  constructor(

    private readonly colorsService:
      ColorsService,

  ){}

  @Permissions(
    PermissionCode.MASTER_DATA_READ,
  )
  @Get()
  findAll(){

    return this.colorsService
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

    return this.colorsService
      .findOne(id)

  }

  @Permissions(
    PermissionCode.MASTER_DATA_UPDATE,
  )
  @Post()
  create(

    @Body()
    dto:CreateColorDto,

    @CurrentUser()
    user:CurrentUserType,

  ){

    return this.colorsService
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
    dto:UpdateColorDto,

    @CurrentUser()
    user:CurrentUserType,

  ){

    return this.colorsService
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

    return this.colorsService
      .remove(id, user.id)

  }

}