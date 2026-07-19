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

import { ActivityLogService } from "./activity-log.service"
import { CreateActivityLogDto } from "./dto/create-activity-log.dto"
import { CreateActivityTypeDto } from "./dto/create-activity-type.dto"
import { UpdateActivityTypeDto } from "./dto/update-activity-type.dto"

import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard"
import { PermissionsGuard } from "@/shared/guards/permissions.guard"
import { Permissions } from "@/shared/decorators/permissions.decorator"
import { CurrentUser } from "@/shared/decorators/current-user.decorator"
import type { CurrentUserType } from "@/shared/types/current-user.types"
import { PermissionCode } from "@/core/enums/permission-code.enum"

@UseGuards(
  JwtAuthGuard,
  PermissionsGuard,
)
@Controller()
export class ActivityLogController {

  constructor(
    private readonly activityLogService: ActivityLogService,
  ) {}

  // ---- Tipos de actividad ----

  @Permissions(PermissionCode.ACTIVITY_LOG_READ)
  @Get("activity-types")
  findAllTypes(@Query("includeInactive") includeInactive?: string) {
    return this.activityLogService.findAllTypes(includeInactive === "1")
  }

  @Permissions(PermissionCode.ACTIVITY_TYPE_MANAGE)
  @Post("activity-types")
  createType(@Body() dto: CreateActivityTypeDto) {
    return this.activityLogService.createType(dto)
  }

  @Permissions(PermissionCode.ACTIVITY_TYPE_MANAGE)
  @Patch("activity-types/:id")
  updateType(
    @Param("id") id: string,
    @Body() dto: UpdateActivityTypeDto,
  ) {
    return this.activityLogService.updateType(id, dto)
  }

  @Permissions(PermissionCode.ACTIVITY_TYPE_MANAGE)
  @Delete("activity-types/:id")
  removeType(@Param("id") id: string) {
    return this.activityLogService.removeType(id)
  }

  // ---- Entradas de bitácora ----

  @Permissions(PermissionCode.ACTIVITY_LOG_CREATE)
  @Post("activity-log")
  create(
    @Body() dto: CreateActivityLogDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.activityLogService.create(user.id, dto)
  }

  @Permissions(PermissionCode.ACTIVITY_LOG_READ)
  @Get("activity-log/me/today")
  findMyToday(@CurrentUser() user: CurrentUserType) {
    return this.activityLogService.findMyToday(user.id)
  }

  @Permissions(PermissionCode.ACTIVITY_LOG_READ_ANY)
  @Get("activity-log")
  findAll(
    @Query("userId") userId?: string,
    @Query("projectId") projectId?: string,
    @Query("taskId") taskId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.activityLogService.findAll({
      userId,
      projectId,
      taskId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    })
  }

}