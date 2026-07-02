import {
  Prisma,
  WorkflowStatus,
} from "@prisma/client"

import { PrismaService } from "@/infra/database/prisma/prisma.service"

import { OperatorCacheService } from "../services/operator-cache.service"
import { OperatorLite } from "../constants/operator-select.constant"

type WorkflowStepDelta = Prisma.WorkflowStepGetPayload<{}> & {
  operator?: OperatorLite | null
}

export async function updateWorkflowStep(
  prisma: PrismaService,
  operatorCache: OperatorCacheService,
  id: string,
  data: Prisma.WorkflowStepUpdateInput,
) {

  const workflowStep = await prisma.workflowStep.update({

    where: { id },

    data,

  })

  const touchedOperator = "operatorId" in data

  let delta: WorkflowStepDelta = workflowStep

  if (touchedOperator) {

    const operator = workflowStep.operatorId
      ? await operatorCache.get(workflowStep.operatorId)
      : null

    delta = {
      ...workflowStep,
      operator,
    }

  }

  return {

    taskId: workflowStep.taskId,

    updated: [
      delta,
    ],

  }

}

export async function reviewTransaction(
  prisma: PrismaService,
  id: string,
  nextStepId?: string,
) {

  return prisma.$transaction(

    async tx => {

      const workflowStep = await tx.workflowStep.update({

        where: { id },

        data: {
          status: WorkflowStatus.REVIEWED,
          reviewedAt: new Date(),
        },

      })

      const nextStep = nextStepId

        ? await tx.workflowStep.update({

            where: {
              id: nextStepId,
            },

            data: {
              status: WorkflowStatus.PENDING,
            },

          })

        : null

      return {

        taskId: workflowStep.taskId,

        updated: nextStep

          ? [
              workflowStep,
              nextStep,
            ]

          : [
              workflowStep,
            ],

      }

    },

  )

}

export async function reopenTransaction(
  prisma: PrismaService,
  id: string,
  nextStepId?: string,
) {

  return prisma.$transaction(

    async tx => {

      const workflowStep = await tx.workflowStep.update({

        where: { id },

        data: {
          status: WorkflowStatus.PROGRESS,
          completedAt: null,
          reviewedAt: null,
        },

      })

      const nextStep = nextStepId

        ? await tx.workflowStep.update({

            where: {
              id: nextStepId,
            },

            data: {
              status: WorkflowStatus.QUEUE,
            },

          })

        : null

      return {

        taskId: workflowStep.taskId,

        updated: nextStep

          ? [
              workflowStep,
              nextStep,
            ]

          : [
              workflowStep,
            ],

      }

    },

  )

}