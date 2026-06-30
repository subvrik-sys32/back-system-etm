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
  MaterialsService,
} from "./materials.service"

import {
  CreateMaterialDto,
} from "./dto/create-material.dto"

import {
  UpdateMaterialDto,
} from "./dto/update-material.dto"

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
@Controller("materials")
export class MaterialsController {

  constructor(

    private readonly materialsService:
      MaterialsService,

  ){}

  @Permissions(
    PermissionCode.MASTER_DATA_READ,
  )
  @Get()
  findAll(){

    return this.materialsService
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

    return this.materialsService
      .findOne(id)

  }

  @Permissions(
    PermissionCode.MASTER_DATA_UPDATE,
  )
  @Post()
  create(

    @Body()
    dto:CreateMaterialDto,

  ){

    return this.materialsService
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
    dto:UpdateMaterialDto,

  ){

    return this.materialsService
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

    return this.materialsService
      .remove(id)

  }

}