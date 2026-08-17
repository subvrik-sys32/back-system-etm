import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common"
import { EngineeringProcessCode } from "@prisma/client"

import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard"
import { PermissionsGuard } from "@/shared/guards/permissions.guard"
import { Permissions } from "@/shared/decorators/permissions.decorator"
import { CurrentUser } from "@/shared/decorators/current-user.decorator"
import type { CurrentUserType } from "@/shared/types/current-user.types"
import { PermissionCode } from "@/core/enums/permission-code.enum"

import { EngineeringTasksService } from "./engineering-tasks.service"
import { CreateEngineeringTaskDto } from "./dto/create-engineering-task.dto"
import { UpdateEngineeringTaskDto } from "./dto/update-engineering-task.dto"

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("engineering-tasks")
export class EngineeringTasksController {
  constructor(private readonly service: EngineeringTasksService) {}

  @Permissions(PermissionCode.TASK_READ)
  @Get()
  findAll(
    @Query("projectId") projectId?: string,
    @Query("processCode") processCode?: EngineeringProcessCode,
    @Query("assigneeId") assigneeId?: string,
  ) {
    return this.service.findAll({ projectId, processCode, assigneeId })
  }

  @Permissions(PermissionCode.TASK_READ)
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id)
  }

  @Permissions(PermissionCode.TASK_CREATE)
  @Post()
  create(
    @Body() dto: CreateEngineeringTaskDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.service.create(dto, user.id)
  }

  @Permissions(PermissionCode.TASK_UPDATE)
  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateEngineeringTaskDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.service.update(id, dto, user.id)
  }

  @Permissions(PermissionCode.TASK_DELETE)
  @Delete(":id")
  remove(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.service.remove(id, user.id)
  }
}
