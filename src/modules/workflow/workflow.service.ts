import { Injectable } from "@nestjs/common"
import { WorkflowStatus } from "@prisma/client"

import { PrismaService } from "@/infra/database/prisma/prisma.service"
import { RealtimeService } from "@/modules/realtime/realtime.service"

import { WorkflowActionDto } from "./dto/workflow-action.dto"
import { UpdateWorkflowStepDto } from "./dto/update-workflow-step.dto"

import { getTaskWithRelations } from "./queries/workflow-task.query"

import {
  getStepForComplete,
  getStepForReview,
  getStepForReopen,
  getStepForStart,
  getStepForUpdate,
} from "./queries/workflow.queries"

import { updateWorkflowStep } from "./mutations/workflow.mutations"

import {
  validateCompleted,
  validateCompletePayload,
  validateOperatorAssigned,
  validatePaused,
  validatePending,
  validateProgress,
  validateReopen,
} from "./validators/workflow.validators"

@Injectable()
export class WorkflowService {

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  // Helper único: siempre trae el task actualizado, publica realtime,
  // y devuelve el mismo shape que espera el frontend.
  private async publishTask(taskId: string, userId: string) {

    const task = await getTaskWithRelations(this.prisma, taskId)

    this.realtime.publish({
      entity: "WORKFLOW",
      action: "UPDATED",
      id: task.id,
      payload: task,
      excludeUserId: userId,
    })

    this.realtime.publish({
      entity: "PROCESS",
      action: "UPDATED",
      id: task.id,
      payload: task,
      excludeUserId: userId,
    })

    return { taskId, task }
  }

  async update(id: string, dto: UpdateWorkflowStepDto, userId: string) {

    const step = await getStepForUpdate(this.prisma, id)

    await updateWorkflowStep(this.prisma, id, {
      ...(dto.operatorId !== undefined && { operatorId: dto.operatorId }),
      ...(dto.piecesOutput !== undefined && { piecesOutput: dto.piecesOutput }),
      ...(dto.plRtReal !== undefined && { plRtReal: dto.plRtReal }),
      ...(dto.paintKgReal !== undefined && { paintKgReal: dto.paintKgReal }),
    })

    return this.publishTask(step.taskId, userId)
  }

  async start(id: string, userId: string) {

    const step = await getStepForStart(this.prisma, id)

    validatePending(step.status)
    validateOperatorAssigned(
      step.operatorId,
      "Debe asignar un operario antes de iniciar el proceso.",
    )

    await updateWorkflowStep(this.prisma, id, {
      status: WorkflowStatus.PROGRESS,
      startedAt: step.startedAt ?? new Date(),
    })

    return this.publishTask(step.taskId, userId)
  }

  async pause(id: string, userId: string) {

    const step = await getStepForStart(this.prisma, id)

    validateProgress(step.status)

    await updateWorkflowStep(this.prisma, id, {
      status: WorkflowStatus.PAUSED,
    })

    return this.publishTask(step.taskId, userId)
  }

  async resume(id: string, userId: string) {

    const step = await getStepForStart(this.prisma, id)

    validatePaused(step.status)

    await updateWorkflowStep(this.prisma, id, {
      status: WorkflowStatus.PROGRESS,
    })

    return this.publishTask(step.taskId, userId)
  }

  async complete(id: string, dto: WorkflowActionDto, userId: string) {

    const step = await getStepForComplete(this.prisma, id)

    validateProgress(step.status)
    validateOperatorAssigned(step.operatorId, "Debe registrar un operario.")
    validateCompletePayload(step.processCode, dto)

    await updateWorkflowStep(this.prisma, id, {
      status: WorkflowStatus.COMPLETED,
      completedAt: new Date(),
      piecesOutput: dto.piecesOutput ?? null,
      plRtReal: dto.plRtReal ?? null,
      paintKgReal: dto.paintKgReal ?? null,
    })

    return this.publishTask(step.taskId, userId)
  }

  async review(id: string, userId: string) {

    const step = await getStepForReview(this.prisma, id)

    validateCompleted(step.status)

    const nextStep = step.task.workflowSteps.find(
      item => item.order === step.order + 1,
    )

    await this.prisma.$transaction(async tx => {

      await tx.workflowStep.update({
        where: { id },
        data: {
          status: WorkflowStatus.REVIEWED,
          reviewedAt: new Date(),
        },
      })

      if (nextStep && nextStep.status === WorkflowStatus.QUEUE) {
        await tx.workflowStep.update({
          where: { id: nextStep.id },
          data: { status: WorkflowStatus.PENDING },
        })
      }

    })

    return this.publishTask(step.taskId, userId)
  }

  async reopen(id: string, userId: string) {

    const step = await getStepForReopen(this.prisma, id)

    validateReopen(step.status)

    const nextStep = step.task.workflowSteps.find(
      item => item.order === step.order + 1,
    )

    await this.prisma.$transaction(async tx => {

      await tx.workflowStep.update({
        where: { id },
        data: {
          status: WorkflowStatus.PROGRESS,
          completedAt: null,
          reviewedAt: null,
        },
      })

      if (
        nextStep &&
        (nextStep.status === WorkflowStatus.PENDING ||
          nextStep.status === WorkflowStatus.QUEUE)
      ) {
        await tx.workflowStep.update({
          where: { id: nextStep.id },
          data: { status: WorkflowStatus.QUEUE },
        })
      }

    })

    return this.publishTask(step.taskId, userId)
  }

}