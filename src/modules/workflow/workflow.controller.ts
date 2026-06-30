import {
  Body,
  Controller,
  Param,
  Patch,
  UseGuards,
} from "@nestjs/common"

import { WorkflowService } from "./workflow.service"
import { WorkflowActionDto } from "./dto/workflow-action.dto"
import { UpdateWorkflowStepDto } from "./dto/update-workflow-step.dto"

import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard"
import { PermissionsGuard } from "@/shared/guards/permissions.guard"

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("workflow")
export class WorkflowController {

  constructor(
    private readonly workflowService: WorkflowService,
  ) {}

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateWorkflowStepDto,
  ) {
    return this.workflowService.update(id, dto)
  }

  @Patch(":id/start")
  start(@Param("id") id: string) {
    return this.workflowService.start(id)
  }

  @Patch(":id/pause")
  pause(@Param("id") id: string) {
    return this.workflowService.pause(id)
  }

  @Patch(":id/resume")
  resume(@Param("id") id: string) {
    return this.workflowService.resume(id)
  }

  @Patch(":id/complete")
  complete(
    @Param("id") id: string,
    @Body() dto: WorkflowActionDto,
  ) {
    return this.workflowService.complete(id, dto)
  }

  @Patch(":id/review")
  review(@Param("id") id: string) {
    return this.workflowService.review(id)
  }

  @Patch(":id/reopen")
  reopen(@Param("id") id: string) {
    return this.workflowService.reopen(id)
  }
}