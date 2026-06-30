import {
  Prisma,
  WorkflowStatus,
} from "@prisma/client"

import { PrismaService } from "@/infra/database/prisma/prisma.service"

export async function updateWorkflowStep(
  prisma:PrismaService,
  id:string,
  data:Prisma.WorkflowStepUpdateInput,
){

  const workflowStep=
    await prisma.workflowStep.update({

      where:{ id },

      data,

      include:{
        operator:true,
      },

    })

  return{

    taskId:
      workflowStep.taskId,

    workflowStep,

  }

}

export async function reviewTransaction(
  prisma:PrismaService,
  id:string,
  nextStepId?:string,
){

  return prisma.$transaction(

    async tx=>{

      const workflowStep=
        await tx.workflowStep.update({

          where:{ id },

          data:{
            status:WorkflowStatus.REVIEWED,
            reviewedAt:new Date(),
          },

          include:{
            operator:true,
          },

        })

      if(nextStepId){

        await tx.workflowStep.update({

          where:{
            id:nextStepId,
          },

          data:{
            status:WorkflowStatus.PENDING,
          },

        })

      }

      return{

        taskId:
          workflowStep.taskId,

        workflowStep,

      }

    },

  )

}

export async function reopenTransaction(
  prisma:PrismaService,
  id:string,
  nextStepId?:string,
){

  return prisma.$transaction(

    async tx=>{

      const workflowStep=
        await tx.workflowStep.update({

          where:{ id },

          data:{
            status:WorkflowStatus.PROGRESS,
            completedAt:null,
            reviewedAt:null,
          },

          include:{
            operator:true,
          },

        })

      if(nextStepId){

        await tx.workflowStep.update({

          where:{
            id:nextStepId,
          },

          data:{
            status:WorkflowStatus.QUEUE,
          },

        })

      }

      return{

        taskId:
          workflowStep.taskId,

        workflowStep,

      }

    },

  )

}