import {
  Prisma,
  WorkflowStatus,
} from "@prisma/client"

import { PrismaService } from "@/infra/database/prisma/prisma.service"

const operatorSelect={

  id:true,
  username:true,
  name:true,
  email:true,
  icon:true,
  color:true,
  active:true,

} satisfies Prisma.UserSelect

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
        operator:{
          select:operatorSelect,
        },
      },

    })

  return{

    taskId:
      workflowStep.taskId,

    updated:[
      workflowStep,
    ],

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
            operator:{
              select:operatorSelect,
            },
          },

        })

      const nextStep=

        nextStepId

          ?await tx.workflowStep.update({

              where:{
                id:nextStepId,
              },

              data:{
                status:WorkflowStatus.PENDING,
              },

              include:{
                operator:{
                  select:operatorSelect,
                },
              },

            })

          :null

      return{

        taskId:
          workflowStep.taskId,

        updated:
          nextStep
            ?[workflowStep,nextStep]
            :[workflowStep],

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
            operator:{
              select:operatorSelect,
            },
          },

        })

      const nextStep=

        nextStepId

          ?await tx.workflowStep.update({

              where:{
                id:nextStepId,
              },

              data:{
                status:WorkflowStatus.QUEUE,
              },

              include:{
                operator:{
                  select:operatorSelect,
                },
              },

            })

          :null

      return{

        taskId:
          workflowStep.taskId,

        updated:
          nextStep
            ?[workflowStep,nextStep]
            :[workflowStep],

      }

    },

  )

}