import { Prisma } from "@prisma/client"

import { PrismaService } from "@/infra/database/prisma/prisma.service"

const includeTask={

  project:{
    include:{
      client:true,
      stage:true,
      status:true,
      pm:{
        select:{
          id:true,
          username:true,
          name:true,
          email:true,
          active:true,
          createdAt:true,
          updatedAt:true,
        },
      },
    },
  },

  priority:true,
  material:true,
  thickness:true,
  color:true,

  workflowSteps:{
    include:{
      operator:true,
    },
    orderBy:{
      order:"asc" as const,
    },
  },

} satisfies Prisma.TaskInclude

export async function getTaskWithRelations(
  prisma:PrismaService,
  taskId:string,
){

  return prisma.task.findUnique({

    where:{
      id:taskId,
    },

    relationLoadStrategy:"join",

    include:includeTask,

  })

}