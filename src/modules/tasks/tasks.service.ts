import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common"
import { Prisma } from "@prisma/client"
import { PrismaService } from "@/infra/database/prisma/prisma.service"
import { CreateTaskDto } from "./dto/create-task.dto"
import { UpdateTaskDto } from "./dto/update-task.dto"
import { ReorderTaskItemDto } from "./dto/reorder-task.dto"
import { buildWorkflow, hasWorkflowStarted } from "@/modules/workflow/engine/rebuild-workflow"

@Injectable()
export class TasksService{
  constructor(private readonly prisma:PrismaService){}

  private readonly includeRelations={
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
      include:{ operator:true },
      orderBy:{ order:"asc" as const },
    },
  } satisfies Prisma.TaskInclude

  async findAll(){
    return this.prisma.task.findMany({
      where:{
        deletedAt:null,
        project:{ deletedAt:null },
      },
      include:this.includeRelations,
      orderBy:{ position:"asc" },
    })
  }

  async findOne(id:string){
    const task=await this.prisma.task.findFirst({
      where:{
        id,
        deletedAt:null,
        project:{ deletedAt:null },
      },
      relationLoadStrategy:"join",
      include:this.includeRelations,
    })

    if(!task){
      throw new NotFoundException("Task not found")
    }

    return task
  }

  async create(dto:CreateTaskDto,userId:string){
    const[lastTask,totalTasks]=await Promise.all([
      this.prisma.task.findFirst({
        orderBy:{ taskNumber:"desc" },
      }),
      this.prisma.task.count({
        where:{ deletedAt:null },
      }),
    ])

    return this.prisma.task.create({
      data:{
        taskNumber:(lastTask?.taskNumber??0)+1,
        projectId:dto.projectId,
        reference:dto.reference.trim(),
        pieces:dto.pieces,
        lotNumber:dto.lotNumber,
        assemblyCount:dto.assemblyCount,
        paintKg:dto.paintKg,
        route:dto.route,
        priorityId:dto.priorityId,
        materialId:dto.materialId,
        thicknessId:dto.thicknessId,
        colorId:dto.colorId??null,
        plRt:dto.plRt??null,
        deliveryDate:dto.deliveryDate?new Date(dto.deliveryDate):null,
        position:totalTasks+1,
        createdById:userId,
        updatedById:userId,
        workflowSteps:{
          create:buildWorkflow(dto.route),
        },
      },
      include:this.includeRelations,
    })
  }

  async update(id:string,dto:UpdateTaskDto,userId:string){
    const exists=await this.prisma.task.findUnique({
      where:{ id },
      select:{
        id:true,
        route:true,
        workflowSteps:{
          select:{ status:true },
        },
      },
    })

    if(!exists){
      throw new NotFoundException("Task not found")
    }

    const routeChanged=dto.route!==undefined&&JSON.stringify(dto.route)!==JSON.stringify(exists.route)

    if(routeChanged&&hasWorkflowStarted(exists.workflowSteps)){
      throw new BadRequestException("La ruta no puede modificarse porque la producción ya inició.")
    }

    const updateData={
      ...dto,
      updatedById:userId,
      deliveryDate:dto.deliveryDate?new Date(dto.deliveryDate):undefined,
    }

    await this.prisma.$transaction(async tx=>{
      await tx.task.update({
        where:{ id },
        data:updateData,
      })

      if(routeChanged){
        await tx.workflowStep.deleteMany({
          where:{ taskId:id },
        })

        await tx.workflowStep.createMany({
          data:buildWorkflow(dto.route!).map(step=>({
            ...step,
            taskId:id,
          })),
        })
      }
    })

    return this.prisma.task.findUnique({
      where:{ id },
      relationLoadStrategy:"join",
      include:this.includeRelations,
    })
  }

  async reorder(
    items:ReorderTaskItemDto[],
  ){

    await this.prisma.$transaction(

      items.map(
        item=>

          this.prisma.task.update({

            where:{
              id:item.id,
            },

            data:{
              position:item.position,
            },

          }),

      ),

    )

    return this.findAll()

  }

  async remove(id:string,userId:string){
    const exists=await this.prisma.task.findUnique({
      where:{ id },
      select:{ id:true },
    })

    if(!exists){
      throw new NotFoundException("Task not found")
    }

    return this.prisma.task.update({
      where:{ id },
      data:{
        deletedAt:new Date(),
        updatedById:userId,
      },
    })
  }
}