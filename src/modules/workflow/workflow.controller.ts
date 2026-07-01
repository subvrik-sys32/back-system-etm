import {
  Body,
  Controller,
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
  JwtAuthGuard,
} from "@/modules/auth/guards/jwt-auth.guard"

import {
  PermissionsGuard,
} from "@/shared/guards/permissions.guard"

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