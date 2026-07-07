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

import { CommentsService } from "./comments.service"
import { CreateCommentDto } from "./dto/create-comment.dto"
import { UpdateCommentDto } from "./dto/update-comment.dto"
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
export class CommentsController {

  constructor(
    private readonly commentsService:CommentsService,
  ){}

  // ---- Nivel Tarea ----

  @Permissions(PermissionCode.COMMENT_READ)
  @Get("tasks/:taskId/comments")
  findAllByTask(@Param("taskId") taskId:string){
    return this.commentsService.findAllByTask(taskId)
  }

  @Permissions(PermissionCode.COMMENT_CREATE)
  @Post("tasks/:taskId/comments")
  createForTask(
    @Param("taskId") taskId:string,
    @Body() dto:CreateCommentDto,
    @CurrentUser() user:CurrentUserType,
  ){
    return this.commentsService.createForTask(taskId,dto.message,user.id)
  }

  // ---- Nivel Proceso (WorkflowStep) ----

  @Permissions(PermissionCode.COMMENT_READ)
  @Get("workflow-steps/:workflowStepId/comments")
  findAllByWorkflowStep(@Param("workflowStepId") workflowStepId:string){
    return this.commentsService.findAllByWorkflowStep(workflowStepId)
  }

  @Permissions(PermissionCode.COMMENT_CREATE)
  @Post("workflow-steps/:workflowStepId/comments")
  createForWorkflowStep(
    @Param("workflowStepId") workflowStepId:string,
    @Body() dto:CreateCommentDto,
    @CurrentUser() user:CurrentUserType,
  ){
    return this.commentsService.createForWorkflowStep(workflowStepId,dto.message,user.id)
  }

  // ---- Compartido ----

  @Permissions(PermissionCode.COMMENT_UPDATE)
  @Patch("comments/:id")
  update(
    @Param("id") id:string,
    @Body() dto:UpdateCommentDto,
    @CurrentUser() user:CurrentUserType,
  ){
    return this.commentsService.update(id,dto.message,user.id)
  }

  @Permissions(PermissionCode.COMMENT_DELETE)
  @Delete("comments/:id")
  remove(
    @Param("id") id:string,
    @CurrentUser() user:CurrentUserType,
  ){
    return this.commentsService.remove(id,user)
  }

}