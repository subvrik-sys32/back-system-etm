import { NotFoundException } from "@nestjs/common"
import { PrismaService } from "@/infra/database/prisma/prisma.service"

export async function getStepForUpdate(
  prisma:PrismaService,
  id:string,
){

  const step=
    await prisma.workflowStep.findUnique({

      where:{ id },

      select:{

        id:true,

        taskId:true,

      },

    })

  if(!step){

    throw new NotFoundException(

      "Workflow step not found",

    )

  }

  return step

}

export async function getStepForStart(
  prisma:PrismaService,
  id:string,
){

  const step=await prisma.workflowStep.findUnique({
    where:{ id },
    select:{
      id:true,
      taskId:true,
      status:true,
      operatorId:true,
      startedAt:true,
    },
  })

  if(!step){
    throw new NotFoundException(
      "Workflow step not found",
    )
  }

  return step

}

export async function getStepForComplete(
  prisma:PrismaService,
  id:string,
){

  const step=await prisma.workflowStep.findUnique({
    where:{ id },
    select:{
      id:true,
      taskId:true,
      status:true,
      operatorId:true,
      processCode:true,
    },
  })

  if(!step){
    throw new NotFoundException(
      "Workflow step not found",
    )
  }

  return step

}

export async function getStepForReview(
  prisma:PrismaService,
  id:string,
){

  const step=await prisma.workflowStep.findUnique({
    where:{ id },
    select:{
      id:true,
      taskId:true,
      order:true,
      status:true,
      task:{
        select:{
          workflowSteps:{
            select:{
              id:true,
              order:true,
              status:true,
            },
            orderBy:{
              order:"asc",
            },
          },
        },
      },
    },
  })

  if(!step){
    throw new NotFoundException(
      "Workflow step not found",
    )
  }

  return step

}

export async function getStepForReopen(
  prisma:PrismaService,
  id:string,
){

  const step=await prisma.workflowStep.findUnique({
    where:{ id },
    select:{
      id:true,
      taskId:true,
      order:true,
      status:true,
      task:{
        select:{
          workflowSteps:{
            select:{
              id:true,
              order:true,
              status:true,
            },
            orderBy:{
              order:"asc",
            },
          },
        },
      },
    },
  })

  if(!step){
    throw new NotFoundException(
      "Workflow step not found",
    )
  }

  return step

}