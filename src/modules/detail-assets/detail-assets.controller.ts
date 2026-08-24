import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from "@nestjs/common"
import { FileInterceptor } from "@nestjs/platform-express"

import { DetailAssetsService } from "./detail-assets.service"
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard"
import { PermissionsGuard } from "@/shared/guards/permissions.guard"
import { Permissions } from "@/shared/decorators/permissions.decorator"
import { CurrentUser } from "@/shared/decorators/current-user.decorator"
import type { CurrentUserType } from "@/shared/types/current-user.types"
import type { MulterFile } from "@/shared/types/multer-file"
import { PermissionCode } from "@/core/enums/permission-code.enum"

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class DetailAssetsController {
  constructor(private readonly service: DetailAssetsService) {}

  @Permissions(PermissionCode.PROJECT_READ)
  @Get("projects/:projectId/detail-assets")
  listProject(
    @Param("projectId") projectId: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.service.listForProject(projectId, user)
  }

  @Permissions(PermissionCode.TASK_READ)
  @Get("tasks/:taskId/detail-assets")
  listTask(
    @Param("taskId") taskId: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.service.listForTask(taskId, user)
  }

  @Permissions(PermissionCode.PROJECT_UPDATE)
  @Post("projects/:projectId/detail-assets/photo")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 8 * 1024 * 1024 } }),
  )
  uploadProjectPhoto(
    @Param("projectId") projectId: string,
    @UploadedFile() file: MulterFile,
    @CurrentUser() user: CurrentUserType,
  ) {
    if (!file) throw new BadRequestException("Falta file")
    return this.service.uploadProjectPhoto(projectId, file, user)
  }

  @Permissions(PermissionCode.TASK_UPDATE)
  @Post("tasks/:taskId/detail-assets/photo")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 8 * 1024 * 1024 } }),
  )
  uploadTaskPhoto(
    @Param("taskId") taskId: string,
    @UploadedFile() file: MulterFile,
    @CurrentUser() user: CurrentUserType,
  ) {
    if (!file) throw new BadRequestException("Falta file")
    return this.service.uploadTaskPhoto(taskId, file, user)
  }

  @Permissions(PermissionCode.PROJECT_UPDATE)
  @Post("projects/:projectId/detail-assets/note")
  upsertProjectNote(
    @Param("projectId") projectId: string,
    @Body() body: { text?: string },
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.service.upsertNote({ projectId }, body.text ?? "", user)
  }

  @Permissions(PermissionCode.TASK_UPDATE)
  @Post("tasks/:taskId/detail-assets/note")
  upsertTaskNote(
    @Param("taskId") taskId: string,
    @Body() body: { text?: string },
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.service.upsertNote({ taskId }, body.text ?? "", user)
  }

  /** Paso 2 tras guardar tarea: DXF amarrado a la línea de material. */
  @Permissions(PermissionCode.TASK_UPDATE)
  @Post("task-material-lines/:lineId/dxf")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 15 * 1024 * 1024 } }),
  )
  uploadDxf(
    @Param("lineId") lineId: string,
    @UploadedFile() file: MulterFile,
    @CurrentUser() user: CurrentUserType,
  ) {
    if (!file) throw new BadRequestException("Falta file")
    return this.service.uploadMaterialLineDxf(lineId, file, user)
  }

  @Delete("detail-assets/:id")
  remove(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.service.remove(id, user)
  }

  @Permissions(PermissionCode.TASK_DELETE)
  @Post("detail-assets/purge-dxf")
  purgeDxf(
    @CurrentUser() user: CurrentUserType,
    @Query("days") days?: string,
    @Query("dryRun") dryRun?: string,
  ) {
    return this.service.purgeDxf(user, {
      olderThanDays: days ? Number(days) : 7,
      dryRun: dryRun === "1" || dryRun === "true",
    })
  }
}