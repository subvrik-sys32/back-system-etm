import { NotFoundException } from "@nestjs/common"
import { PrismaService } from "@/infra/database/prisma/prisma.service"

export async function getTaskWorkflowSteps(
  prisma:PrismaService,
  taskId:string,
){

  const task=
    await prisma.task.findUnique({

      where:{
        id:taskId,
      },

      select:{

        id:true,

        workflowSteps:{
          include:{
            operator:{
              select:{
                id:true,
                name:true,
                color:true,
                icon:true,
              },
            },
          },
          orderBy:{
            order:"asc" as const,
          },
        },

      },

    })

  if(!task){

    throw new NotFoundException(
      "Task not found",
    )

  }

  return task

}