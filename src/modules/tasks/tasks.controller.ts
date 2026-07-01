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
  TasksService,
} from "./tasks.service"

import {
  CreateTaskDto,
} from "./dto/create-task.dto"

import {
  UpdateTaskDto,
} from "./dto/update-task.dto"

import {
  ReorderTaskDto,
} from "./dto/reorder-task.dto"

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
@Controller("tasks")
export class TasksController {

  constructor(
    private readonly tasksService:TasksService,
  ){}

  @Permissions(
    PermissionCode.TASK_READ,
  )
  @Get()
  findAll(){

    return this.tasksService.findAll()

  }

  @Permissions(
    PermissionCode.TASK_READ,
  )
  @Get(":id")
  findOne(
    @Param("id")
    id:string,
  ){

    return this.tasksService.findOne(
      id,
    )

  }

  @Permissions(
    PermissionCode.TASK_CREATE,
  )
  @Post()
  create(

    @Body()
    dto:CreateTaskDto,

    @CurrentUser()
    user:CurrentUserType,

  ){

    return this.tasksService.create(
      dto,
      user.id,
    )

  }

  @Permissions(
    PermissionCode.TASK_UPDATE,
  )
  @Patch("reorder")
  reorder(

    @Body()
    dto:ReorderTaskDto,

    @CurrentUser()
    user:CurrentUserType,

  ){

    return this.tasksService.reorder(
      dto.items,
      user.id,
    )

  }

  @Permissions(
    PermissionCode.TASK_UPDATE,
  )
  @Patch(":id")
  update(

    @Param("id")
    id:string,

    @Body()
    dto:UpdateTaskDto,

    @CurrentUser()
    user:CurrentUserType,

  ){

    return this.tasksService.update(
      id,
      dto,
      user.id,
    )

  }

  @Permissions(
    PermissionCode.TASK_DELETE,
  )
  @Delete(":id")
  remove(

    @Param("id")
    id:string,

    @CurrentUser()
    user:CurrentUserType,

  ){

    return this.tasksService.remove(
      id,
      user.id,
    )

  }

}