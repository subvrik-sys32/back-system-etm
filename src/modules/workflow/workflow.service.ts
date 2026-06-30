import { Injectable } from "@nestjs/common"
import { WorkflowStatus } from "@prisma/client"

import { PrismaService } from "@/infra/database/prisma/prisma.service"

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

import {
  updateWorkflowStep,
} from "./mutations/workflow.mutations"

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
export class WorkflowService{

  constructor(
    private readonly prisma:PrismaService,
  ){}

  async update(
    id:string,
    dto:UpdateWorkflowStepDto,
  ){

    await getStepForUpdate(
      this.prisma,
      id,
    )

    return updateWorkflowStep(
      this.prisma,
      id,
      {

        ...(dto.operatorId!==undefined&&{
          operatorId:dto.operatorId,
        }),

        ...(dto.piecesOutput!==undefined&&{
          piecesOutput:dto.piecesOutput,
        }),

        ...(dto.plRtReal!==undefined&&{
          plRtReal:dto.plRtReal,
        }),

        ...(dto.paintKgReal!==undefined&&{
          paintKgReal:dto.paintKgReal,
        }),

      },
    )

  }

  async start(
    id:string,
  ){

    const step=
      await getStepForStart(
        this.prisma,
        id,
      )

    validatePending(
      step.status,
    )

    validateOperatorAssigned(
      step.operatorId,
      "Debe asignar un operario antes de iniciar el proceso.",
    )

    return updateWorkflowStep(
      this.prisma,
      id,
      {
        status:WorkflowStatus.PROGRESS,
        startedAt:
          step.startedAt??
          new Date(),
      },
    )

  }

  async pause(
    id:string,
  ){

    const step=
      await getStepForStart(
        this.prisma,
        id,
      )

    validateProgress(
      step.status,
    )

    return updateWorkflowStep(
      this.prisma,
      id,
      {
        status:WorkflowStatus.PAUSED,
      },
    )

  }

  async resume(
    id:string,
  ){

    const step=
      await getStepForStart(
        this.prisma,
        id,
      )

    validatePaused(
      step.status,
    )

    return updateWorkflowStep(
      this.prisma,
      id,
      {
        status:WorkflowStatus.PROGRESS,
      },
    )

  }

  async complete(
    id:string,
    dto:WorkflowActionDto,
  ){

    const step=
      await getStepForComplete(
        this.prisma,
        id,
      )

    validateProgress(
      step.status,
    )

    validateOperatorAssigned(
      step.operatorId,
      "Debe registrar un operario.",
    )

    validateCompletePayload(
      step.processCode,
      dto,
    )

    return updateWorkflowStep(
      this.prisma,
      id,
      {
        status:WorkflowStatus.COMPLETED,
        completedAt:new Date(),
        piecesOutput:dto.piecesOutput??null,
        plRtReal:dto.plRtReal??null,
        paintKgReal:dto.paintKgReal??null,
      },
    )

  }

  async review(
    id:string,
  ){

    const step=
      await getStepForReview(
        this.prisma,
        id,
      )

    validateCompleted(
      step.status,
    )

    const nextStep=
      step.task.workflowSteps.find(
        item=>
          item.order===step.order+1,
      )

    await this.prisma.$transaction(

      async tx=>{

        await tx.workflowStep.update({

          where:{ id },

          data:{
            status:WorkflowStatus.REVIEWED,
            reviewedAt:new Date(),
          },

        })

        if(

          nextStep&&

          nextStep.status===WorkflowStatus.QUEUE

        ){

          await tx.workflowStep.update({

            where:{
              id:nextStep.id,
            },

            data:{
              status:WorkflowStatus.PENDING,
            },

          })

        }

      },

    )

    const task=
      await getTaskWithRelations(
        this.prisma,
        step.taskId,
      )

    return{

      taskId:step.taskId,

      task,

    }

  }

  async reopen(
    id:string,
  ){

    const step=
      await getStepForReopen(
        this.prisma,
        id,
      )

    validateReopen(
      step.status,
    )

    const nextStep=
      step.task.workflowSteps.find(
        item=>
          item.order===step.order+1,
      )

    await this.prisma.$transaction(

      async tx=>{

        await tx.workflowStep.update({

          where:{ id },

          data:{
            status:WorkflowStatus.PROGRESS,
            completedAt:null,
            reviewedAt:null,
          },

        })

        if(

          nextStep&&

          (

            nextStep.status===WorkflowStatus.PENDING||

            nextStep.status===WorkflowStatus.QUEUE

          )

        ){

          await tx.workflowStep.update({

            where:{
              id:nextStep.id,
            },

            data:{
              status:WorkflowStatus.QUEUE,
            },

          })

        }

      },

    )

    const task=
      await getTaskWithRelations(
        this.prisma,
        step.taskId,
      )

    return{

      taskId:step.taskId,

      task,

    }

  }

}