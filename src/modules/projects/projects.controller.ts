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
  ProjectsService,
} from "./projects.service"

import {
  CreateProjectDto,
} from "./dto/create-project.dto"

import {
  UpdateProjectDto,
} from "./dto/update-project.dto"

import {
  ReorderProjectDto,
} from "./dto/reorder-project.dto"

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
@Controller("projects")
export class ProjectsController{

  constructor(
    private readonly projectsService:ProjectsService,
  ){}

  @Permissions(
    PermissionCode.PROJECT_READ,
  )
  @Get()
  findAll(){

    return this.projectsService.findAll()

  }

  @Permissions(
    PermissionCode.PROJECT_READ,
  )
  @Get(":id")
  findOne(

    @Param("id")
    id:string,

  ){

    return this.projectsService.findOne(
      id,
    )

  }

  @Permissions(
    PermissionCode.PROJECT_CREATE,
  )
  @Post()
  create(

    @Body()
    dto:CreateProjectDto,

    @CurrentUser()
    user:CurrentUserType,

  ){

    return this.projectsService.create(
      dto,
      user.id,
    )

  }

  @Permissions(
    PermissionCode.PROJECT_UPDATE,
  )
  @Patch("reorder")
  reorder(

    @Body()
    dto:ReorderProjectDto,

    @CurrentUser()
    user:CurrentUserType,

  ){

    return this.projectsService.reorder(
      dto.items,
      user.id,
    )

  }

  @Permissions(
    PermissionCode.PROJECT_UPDATE,
  )
  @Patch(":id")
  update(

    @Param("id")
    id:string,

    @Body()
    dto:UpdateProjectDto,

    @CurrentUser()
    user:CurrentUserType,

  ){

    return this.projectsService.update(
      id,
      dto,
      user.id,
    )

  }

  @Permissions(
    PermissionCode.PROJECT_UPDATE,
  )
  @Delete(":id")
  remove(

    @Param("id")
    id:string,

    @CurrentUser()
    user:CurrentUserType,

  ){

    return this.projectsService.remove(
      id,
      user.id,
    )

  }

}