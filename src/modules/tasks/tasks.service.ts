import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common"
import { Prisma } from "@prisma/client"
import { PrismaService } from "@/infra/database/prisma/prisma.service"
import { CreateTaskDto } from "./dto/create-task.dto"
import { UpdateTaskDto } from "./dto/update-task.dto"
import { ReorderTaskItemDto } from "./dto/reorder-task.dto"
import { buildWorkflow, hasWorkflowStarted } from "@/modules/workflow/engine/rebuild-workflow"
import { RealtimeService } from "@/modules/realtime/realtime.service"

@Injectable()
export class TasksService{
  constructor(  
    private readonly prisma:PrismaService,
    private readonly realtime:RealtimeService,
    ){}

  private readonly includeRelations={
    project:{
      include:{
        client:true,
        stage:true,
        status:true,
        pm:{
          select:{
            id:true,
            name:true,
            color:true,
            icon:true,
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
        operator:{
          select:{
            id:true,
            name:true,
            color:true,
            icon:true,
          },
        },
      },
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

  async create(
    dto: CreateTaskDto,
    userId: string,
  ) {

    let lotNumber = dto.lotNumber

    if (lotNumber == null) {
      lotNumber = await this.getNextLotValue(dto.projectId)
    }

    const duplicatedLot = await this.prisma.task.findFirst({
      where: {
        projectId: dto.projectId,
        lotNumber,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    })

    if (duplicatedLot) {
      throw new BadRequestException(
        `El lote L${lotNumber} ya existe para este proyecto.`,
      )
    }

    const [lastTask, totalTasks] = await Promise.all([
      this.prisma.task.findFirst({
        orderBy: {
          taskNumber: "desc",
        },
        select: {
          taskNumber: true,
        },
      }),
      this.prisma.task.count({
        where: {
          deletedAt: null,
        },
      }),
    ])

    const task = await this.prisma.task.create({
      data: {
        taskNumber: (lastTask?.taskNumber ?? 0) + 1,
        projectId: dto.projectId,
        reference: dto.reference.trim(),
        pieces: dto.pieces,
        lotNumber,
        assemblyCount: dto.assemblyCount,
        paintKg: dto.paintKg,
        route: dto.route,
        priorityId: dto.priorityId,
        materialId: dto.materialId,
        thicknessId: dto.thicknessId,
        colorId: dto.colorId ?? null,
        plRt: dto.plRt ?? null,
        deliveryDate: dto.deliveryDate
          ? new Date(dto.deliveryDate)
          : null,
        position: totalTasks + 1,
        createdById: userId,
        updatedById: userId,
        workflowSteps: {
          create: buildWorkflow(dto.route),
        },
      },
      include: this.includeRelations,
    })

    this.realtime.publish({
      entity: "TASK",
      action: "CREATED",
      id: task.id,
      payload: task,
      excludeUserId: userId,
    })

    return task

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
      throw new BadRequestException("La ruta no puede modificarse porque la producción ya inició o finalizó.")
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

    const task=
      await this.prisma.task.findUnique({
        where:{ id },
        relationLoadStrategy:"join",
        include:this.includeRelations,
      })

    if(task){
      this.realtime.publish({
        entity:"TASK",
        action:"UPDATED",
        id:task.id,
        payload:task,
        excludeUserId:userId,
      })
    }
    return task
  }

  async reorder(
    items: ReorderTaskItemDto[],
    userId:string,
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

    // Antes: acá se hacía this.findAll() completo (con TODOS los
    // includes pesados: project+client+stage+status+pm+priority+
    // material+thickness+color+workflowSteps+operator) SOLO para
    // poder mandar el nuevo orden por realtime — reordenar 2 tareas
    // en un drag-and-drop disparaba el mismo payload gigante que
    // cargar la tabla entera. Lo único que en verdad cambió es
    // "position" en cada tarea reordenada — eso es lo único que se
    // manda ahora.
    //
    // También se sacó el segundo publish (entity:"PROCESS",
    // action:"UPDATED") que estaba acá: mandaba el mismo array de
    // tareas, pero processHandler.ts espera un WorkflowResponse
    // individual (lo que usan start/pause/resume/etc) — mismatch de
    // tipos, no hacía nada útil, solo duplicaba el envío del mismo
    // payload pesado por la red a cada cliente conectado.
    this.realtime.publish({
      entity:"TASK",
      action:"REORDERED",
      id:"bulk",
      payload:items,
      excludeUserId:userId,
    })

    return items
  }

  async remove(id:string,userId:string){
    const exists=await this.prisma.task.findUnique({
      where:{ id },
      select:{ id:true },
    })

    if(!exists){
      throw new NotFoundException("Task not found")
    }

    const task=
      await this.prisma.task.update({
        where:{ id },
        data:{
          deletedAt:new Date(),
          updatedById:userId,
        },

      })

    this.realtime.publish({
      entity:"TASK",
      action:"DELETED",
      id,
      excludeUserId:userId,
    })

    return task
  }

  private async getNextLotValue(
    projectId: string,
  ): Promise<number> {

    const lastTask = await this.prisma.task.findFirst({
      where: {
        projectId,
        deletedAt: null,
      },
      orderBy: {
        lotNumber: "desc",
      },
      select: {
        lotNumber: true,
      },
    })

    return (lastTask?.lotNumber ?? 0) + 1

  }

  async getNextLot(
    projectId: string,
  ) {

    return {
      nextLot: await this.getNextLotValue(projectId),
    }

  }
}