import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
} from "@nestjs/common"

import {
  WorkflowService,
} from "./workflow.service"

import {
  WorkflowActionDto,
} from "./dto/workflow-action.dto"

import {
  UpdateWorkflowStepDto,
} from "./dto/update-workflow-step.dto"

import {
  WORKFLOW_BUSINESS,
} from "./business/workflow.business"

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

import {
  CurrentUser,
} from "@/shared/decorators/current-user.decorator"

import type {
  CurrentUserType,
} from "@/shared/types/current-user.types"

@UseGuards(
  JwtAuthGuard,
  PermissionsGuard,
)
@Controller("workflow")
export class WorkflowController{

  constructor(
    private readonly workflowService:WorkflowService,
  ){}

  @Permissions(
    PermissionCode.WORKFLOW_UPDATE,
  )
  @Get("requirements")
  getRequirements(){

    return Object.fromEntries(

      Object.entries(WORKFLOW_BUSINESS).map(
        ([processCode,config])=>[

          processCode,

          config.requiredFields,

        ],
      ),

    )

  }

  @Permissions(
    PermissionCode.WORKFLOW_UPDATE,
  )
  @Patch(":id")
  update(

    @Param("id")
    id:string,

    @Body()
    dto:UpdateWorkflowStepDto,

    @CurrentUser()
    user:CurrentUserType,

  ){

    return this.workflowService.update(

      id,

      dto,

      user.id,

    )

  }

  @Permissions(
    PermissionCode.WORKFLOW_UPDATE,
  )
  @Patch(":id/start")
  start(

    @Param("id")
    id:string,

    @CurrentUser()
    user:CurrentUserType,

  ){

    return this.workflowService.start(

      id,

      user.id,

    )

  }

  @Permissions(
    PermissionCode.WORKFLOW_UPDATE,
  )
  @Patch(":id/pause")
  pause(

    @Param("id")
    id:string,

    @CurrentUser()
    user:CurrentUserType,

  ){

    return this.workflowService.pause(

      id,

      user.id,

    )

  }

  @Permissions(
    PermissionCode.WORKFLOW_UPDATE,
  )
  @Patch(":id/resume")
  resume(

    @Param("id")
    id:string,

    @CurrentUser()
    user:CurrentUserType,

  ){

    return this.workflowService.resume(

      id,

      user.id,

    )

  }

  @Permissions(
    PermissionCode.WORKFLOW_UPDATE,
  )
  @Patch(":id/complete")
  complete(

    @Param("id")
    id:string,

    @Body()
    dto:WorkflowActionDto,

    @CurrentUser()
    user:CurrentUserType,

  ){

    return this.workflowService.complete(

      id,

      dto,

      user.id,

    )

  }

  @Permissions(
    PermissionCode.WORKFLOW_REVIEW,
  )
  @Patch(":id/review")
  review(

    @Param("id")
    id:string,

    @CurrentUser()
    user:CurrentUserType,

  ){

    return this.workflowService.review(

      id,

      user.id,

    )

  }

  @Permissions(
    PermissionCode.WORKFLOW_REVIEW,
  )
  @Patch(":id/reopen")
  reopen(

    @Param("id")
    id:string,

    @CurrentUser()
    user:CurrentUserType,

  ){

    return this.workflowService.reopen(

      id,

      user.id,

    )

  }

}