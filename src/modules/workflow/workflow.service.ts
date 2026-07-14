import { BadRequestException, Injectable } from "@nestjs/common"
import { WorkflowStatus } from "@prisma/client"

import { PrismaService } from "@/infra/database/prisma/prisma.service"
import { RealtimeService } from "@/modules/realtime/realtime.service"

import { WorkflowActionDto } from "./dto/workflow-action.dto"
import { UpdateWorkflowStepDto } from "./dto/update-workflow-step.dto"

import { OperatorCacheService } from "./services/operator-cache.service"

import {
  getStepForComplete,
  getStepForReview,
  getStepForReopen,
  getStepForStart,
  getStepForUpdate,
} from "./queries/workflow.queries"

import {
  updateWorkflowStep,
  reviewTransaction,
  reopenTransaction,
} from "./mutations/workflow.mutations"

import {
  validateCompleted,
  validateCompletePayload,
  validateEditable,
  validateOperatorAssigned,
  validatePaused,
  validatePending,
  validateProgress,
  validateReopen,
} from "./validators/workflow.validators"

type WorkflowDelta = {
  taskId: string
  updated: unknown[]
}

@Injectable()
export class WorkflowService {

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly operatorCache: OperatorCacheService,
  ) {}

  private publishDelta(
    { taskId, updated }: WorkflowDelta,
    userId: string,
  ) {

    const payload = { taskId, updated }

    this.realtime.publish({
      entity: "WORKFLOW",
      action: "UPDATED",
      id: taskId,
      payload,
      excludeUserId: userId,
    })

    this.realtime.publish({
      entity: "PROCESS",
      action: "UPDATED",
      id: taskId,
      payload,
      excludeUserId: userId,
    })

    return payload

  }

  private async transitionStatus(
    id: string,
    userId: string,
    expected: (status: WorkflowStatus) => void,
    data: (step: {
      status: WorkflowStatus
      operatorId: string | null
      startedAt: Date | null
    }) => Record<string, unknown>,
  ) {

    const step = await getStepForStart(
      this.prisma,
      id,
    )

    expected(step.status)

    const payload = data(step)

    const result = await updateWorkflowStep(
      this.prisma,
      this.operatorCache,
      id,
      payload,
    )

    return this.publishDelta(
      result,
      userId,
    )

  }

  async update(
    id: string,
    dto: UpdateWorkflowStepDto,
    userId: string,
  ) {

    const step = await getStepForUpdate(
      this.prisma,
      id,
    )

    validateEditable(
      step.status,
    )

    // Si se está asignando un operario, verificamos que no esté
    // trabajando en otro proceso activo (PROGRESS) al mismo tiempo.
    if (dto.operatorId) {

      const activeStep =
        await this.prisma.workflowStep.findFirst({

          where: {
            operatorId: dto.operatorId,
            status: WorkflowStatus.PROGRESS,
            id: { not: id },
            task: {
              deletedAt: null,
            },
          },

          select: {
            id: true,
            processCode: true,
          },

        })

      if (activeStep) {

        throw new BadRequestException(
          "El operario ya está trabajando en otro proceso activo.",
        )

      }

    }

    const result = await updateWorkflowStep(
      this.prisma,
      this.operatorCache,
      id,
      {
        ...(dto.operatorId !== undefined && { operatorId: dto.operatorId }),
        ...(dto.piecesOutput !== undefined && { piecesOutput: dto.piecesOutput }),
        ...(dto.plRtReal !== undefined && { plRtReal: dto.plRtReal }),
        ...(dto.paintKgReal !== undefined && { paintKgReal: dto.paintKgReal }),
      },
    )

    return this.publishDelta(
      result,
      userId,
    )

  }

  async start(
    id: string,
    userId: string,
  ) {

    return this.transitionStatus(

      id,

      userId,

      status => {
        validatePending(status)
      },

      step => {

        validateOperatorAssigned(
          step.operatorId,
          "Debe asignar un operario antes de iniciar el proceso.",
        )

        return {
          status: WorkflowStatus.PROGRESS,
          startedAt: step.startedAt ?? new Date(),
        }

      },

    )

  }

  async pause(
    id: string,
    userId: string,
  ) {

    return this.transitionStatus(
      id,
      userId,
      status => validateProgress(status),
      () => ({
        status: WorkflowStatus.PAUSED,
      }),
    )

  }

  async resume(
    id: string,
    userId: string,
  ) {

    return this.transitionStatus(
      id,
      userId,
      status => validatePaused(status),
      () => ({
        status: WorkflowStatus.PROGRESS,
      }),
    )

  }

  async complete(
    id: string,
    dto: WorkflowActionDto,
    userId: string,
  ) {

    const step = await getStepForComplete(
      this.prisma,
      id,
    )

    validateProgress(step.status)

    validateOperatorAssigned(
      step.operatorId,
      "Debe registrar un operario.",
    )

    validateCompletePayload(
      step.processCode,
      dto,
    )

    const result = await updateWorkflowStep(
      this.prisma,
      this.operatorCache,
      id,
      {
        status: WorkflowStatus.COMPLETED,
        completedAt: new Date(),
        piecesOutput: dto.piecesOutput ?? null,
        plRtReal: dto.plRtReal ?? null,
        paintKgReal: dto.paintKgReal ?? null,
      },
    )

    return this.publishDelta(
      result,
      userId,
    )

  }

  async review(
    id: string,
    userId: string,
  ) {

    const step = await getStepForReview(
      this.prisma,
      id,
    )

    validateCompleted(
      step.status,
    )

    const nextStep = step.task.workflowSteps.find(
      item => item.order === step.order + 1,
    )

    const eligibleNextId =
      nextStep && nextStep.status === WorkflowStatus.QUEUE
        ? nextStep.id
        : undefined

    const result = await reviewTransaction(
      this.prisma,
      id,
      eligibleNextId,
    )

    return this.publishDelta(
      result,
      userId,
    )

  }

  async reopen(
    id: string,
    userId: string,
  ) {

    const step = await getStepForReopen(
      this.prisma,
      id,
    )

    validateReopen(
      step.status,
    )

    const nextStep = step.task.workflowSteps.find(
      item => item.order === step.order + 1,
    )

    const eligibleNextId =
      nextStep && (
        nextStep.status === WorkflowStatus.PENDING ||
        nextStep.status === WorkflowStatus.QUEUE
      )
        ? nextStep.id
        : undefined

    const result = await reopenTransaction(
      this.prisma,
      id,
      eligibleNextId,
    )

    return this.publishDelta(
      result,
      userId,
    )

  }

}