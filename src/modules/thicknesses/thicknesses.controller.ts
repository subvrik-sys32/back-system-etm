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
  ThicknessesService,
} from "./thicknesses.service"

import {
  CreateThicknessDto,
} from "./dto/create-thickness.dto"

import {
  UpdateThicknessDto,
} from "./dto/update-thickness.dto"

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
@Controller("thicknesses")
export class ThicknessesController {

  constructor(

    private readonly thicknessesService:
      ThicknessesService,

  ){}

  @Permissions(
    PermissionCode.MASTER_DATA_READ,
  )
  @Get()
  findAll(){

    return this.thicknessesService
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

    return this.thicknessesService
      .findOne(id)

  }

  @Permissions(
    PermissionCode.MASTER_DATA_UPDATE,
  )
  @Post()
  create(

    @Body()
    dto:CreateThicknessDto,

  ){

    return this.thicknessesService
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
    dto:UpdateThicknessDto,

  ){

    return this.thicknessesService
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

    return this.thicknessesService
      .remove(id)

  }

}