import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common"
import { Prisma } from "@prisma/client"
import { PrismaService } from "@/infra/database/prisma/prisma.service"
import { CreateTaskDto } from "./dto/create-task.dto"
import { UpdateTaskDto } from "./dto/update-task.dto"
import { ReorderTaskItemDto } from "./dto/reorder-task.dto"
import { buildWorkflow, hasWorkflowStarted, assertRouteOnlyAdds, planWorkflowMerge } from "@/modules/workflow/engine/rebuild-workflow"
import { RealtimeService } from "@/modules/realtime/realtime.service"
import { parseDateOnly, withCalendarDates } from "@/shared/utils/calendar-date"

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
    createdBy:{
      select:{
        id:true,
        name:true,
        color:true,
        icon:true,
      },
    },
    updatedBy:{
      select:{
        id:true,
        name:true,
        color:true,
        icon:true,
      },
    },
    materialLines:{
      include:{
        material:true,
        thickness:true,
        detailAssets:{
          where:{ deletedAt:null, kind:"DXF" as const },
          take:1,
        },
      },
      orderBy:{ sortOrder:"asc" as const },
    },
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
        _count:{
          select:{
            comments:{
              where:{ deletedAt:null },
            },
          },
        },
      },
      orderBy:{ order:"asc" as const },
    },
    // commentCount de la TAREA: solo mensajes con scope task
    // (workflowStepId null). Los de proceso llevan taskId+stepId
    // y se cuentan en workflowStep.commentCount.
    _count:{
      select:{
        comments:{
          where:{
            deletedAt:null,
            workflowStepId:null,
          },
        },
        detailAssets:{
          where:{ deletedAt:null },
        },
      },
    },
  } satisfies Prisma.TaskInclude


  /** Normaliza líneas de material y denormaliza primary + total pieces. */
  private resolveMaterialLines(dto: {
    materials?: Array<{ materialId: string; thicknessId: string; pieces: number }>
    materialId?: string
    thicknessId?: string
    pieces?: number
  }) {
    const lines =
      dto.materials && dto.materials.length > 0
        ? dto.materials.map((l, i) => ({
            materialId: l.materialId,
            thicknessId: l.thicknessId,
            pieces: l.pieces,
            sortOrder: i,
          }))
        : dto.materialId && dto.thicknessId && dto.pieces
          ? [
              {
                materialId: dto.materialId,
                thicknessId: dto.thicknessId,
                pieces: dto.pieces,
                sortOrder: 0,
              },
            ]
          : null

    if (!lines || lines.length === 0) {
      throw new BadRequestException(
        "Se requiere al menos un material con espesor y piezas.",
      )
    }

    const totalPieces = lines.reduce((s, l) => s + l.pieces, 0)
    const primary = [...lines].sort((a, b) => b.pieces - a.pieces)[0]

    return {
      lines,
      totalPieces,
      materialId: primary.materialId,
      thicknessId: primary.thicknessId,
    }
  }



  private withCommentCount<T extends Record<string, unknown>>(
    row: NonNullable<T>,
  ): Omit<NonNullable<T>, "_count"> & {
    commentCount: number
    detailAssetCount: number
  } {
    const raw = row as NonNullable<T> & {
      _count?: { comments?: number; detailAssets?: number }
      workflowSteps?: Array<
        { _count?: { comments?: number } } & Record<string, unknown>
      >
    }
    const { _count, workflowSteps, ...rest } = raw
    const countBag = _count ?? {}
    const steps = workflowSteps?.map((step) => {
      const { _count: stepCount, ...stepRest } = step
      return {
        ...stepRest,
        commentCount: stepCount?.comments ?? 0,
      }
    })
    const base = {
      ...(rest as Omit<T, "_count" | "workflowSteps">),
      ...(steps ? { workflowSteps: steps } : {}),
      commentCount: countBag.comments ?? 0,
      detailAssetCount: countBag.detailAssets ?? 0,
    }

    // deliveryDate (tarea + project anidado) → "YYYY-MM-DD" | null
    return withCalendarDates(base as Record<string, unknown>) as typeof base
  }

  async findAll(){
    const rows = await this.prisma.task.findMany({
      where:{
        deletedAt:null,
        project:{ deletedAt:null },
      },
      include:this.includeRelations,
      orderBy:{ position:"asc" },
    })
    return rows.map((row) => this.withCommentCount(row))
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

    const found = task
    return this.withCommentCount(found)
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

    const resolved = this.resolveMaterialLines(dto)

    const task = await this.prisma.task.create({
      data: {
        taskNumber: (lastTask?.taskNumber ?? 0) + 1,
        projectId: dto.projectId,
        reference: dto.reference.trim(),
        pieces: resolved.totalPieces,
        lotNumber,
        assemblyCount: dto.assemblyCount,
        paintKg: dto.paintKg,
        route: dto.route,
        priorityId: dto.priorityId,
        materialId: resolved.materialId,
        thicknessId: resolved.thicknessId,
        colorId: dto.colorId ?? null,
        plRt: dto.plRt ?? null,
        deliveryDate: parseDateOnly(dto.deliveryDate ?? null),
        position: totalTasks + 1,
        createdById: userId,
        updatedById: userId,
        materialLines: {
          create: resolved.lines,
        },
        workflowSteps: {
          create: buildWorkflow(dto.route),
        },
      },
      include: this.includeRelations,
    })

    const mapped = this.withCommentCount(task)

    this.realtime.publish({
      entity: "TASK",
      action: "CREATED",
      id: task.id,
      payload: mapped,
      excludeUserId: userId,
    })

    return mapped

  }

  async update(id:string,dto:UpdateTaskDto,userId:string){
    const exists=await this.prisma.task.findUnique({
      where:{ id },
      select:{
        id:true,
        route:true,
        workflowSteps:{
          select:{
            id:true,
            processCode:true,
            status:true,
            operatorId:true,
            startedAt:true,
            completedAt:true,
            reviewedAt:true,
            piecesOutput:true,
            plRtReal:true,
            paintKgReal:true,
            order:true,
          },
        },
      },
    })

    if(!exists){
      throw new NotFoundException("Task not found")
    }

    const routeChanged=dto.route!==undefined&&JSON.stringify(dto.route)!==JSON.stringify(exists.route)
    const started=hasWorkflowStarted(exists.workflowSteps)

    if(routeChanged&&started){
      try{
        assertRouteOnlyAdds(exists.route,dto.route!)
      }catch(e){
        throw new BadRequestException(
          e instanceof Error
            ? e.message
            : "No se pueden quitar procesos de la ruta una vez iniciada la producción.",
        )
      }
    }

    const {
      materials,
      materialId,
      thicknessId,
      pieces,
      deliveryDate,
      ...restDto
    } = dto

    let materialPatch: {
      materialId?: string
      thicknessId?: string
      pieces?: number
    } = {}
    let linesToWrite: Array<{
      materialId: string
      thicknessId: string
      pieces: number
      sortOrder: number
    }> | null = null

    if (materials && materials.length > 0) {
      const resolved = this.resolveMaterialLines({ materials })
      materialPatch = {
        materialId: resolved.materialId,
        thicknessId: resolved.thicknessId,
        pieces: resolved.totalPieces,
      }
      linesToWrite = resolved.lines
    } else if (materialId || thicknessId || pieces !== undefined) {
      materialPatch = {
        ...(materialId ? { materialId } : {}),
        ...(thicknessId ? { thicknessId } : {}),
        ...(pieces !== undefined ? { pieces } : {}),
      }
    }

    const updateData = {
      ...restDto,
      ...materialPatch,
      updatedById: userId,
      deliveryDate:
        deliveryDate !== undefined
          ? parseDateOnly(deliveryDate)
          : undefined,
    }

    await this.prisma.$transaction(async tx=>{
      await tx.task.update({
        where:{ id },
        data:updateData,
      })

      if (linesToWrite) {
        await tx.taskMaterialLine.deleteMany({ where: { taskId: id } })
        await tx.taskMaterialLine.createMany({
          data: linesToWrite.map((l) => ({ ...l, taskId: id })),
        })
      }

      if(!routeChanged) return

      if(started){
        // Solo agregar: conservar pasos existentes, crear los nuevos
        const { toKeep, toCreate, toDelete } = planWorkflowMerge(
          dto.route!,
          exists.workflowSteps,
        )

        if(toDelete.length>0){
          await tx.workflowStep.deleteMany({
            where:{ id:{ in: toDelete } },
          })
        }

        for(const step of toKeep){
          await tx.workflowStep.update({
            where:{ id: step.id },
            data:{ order: step.order },
          })
        }

        if(toCreate.length>0){
          await tx.workflowStep.createMany({
            data: toCreate.map(step=>({
              ...step,
              taskId: id,
            })),
          })
        }
      } else {
        // Ruta aún no iniciada: rebuild completo
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

    if (!task) {
      throw new NotFoundException("Task not found")
    }

    const mapped = this.withCommentCount(task)

    this.realtime.publish({
      entity: "TASK",
      action: "UPDATED",
      id: task.id,
      payload: mapped,
      excludeUserId: userId,
    })

    return mapped
  }

  async reorder(
    items: ReorderTaskItemDto[],
    userId:string,
  ){
    if(items.length===0){
      return items
    }

    // Mismo fix que en ProjectsService.reorder: N updates dentro de
    // un $transaction([...]) se comían el timeout DEFAULT de Prisma
    // de 5000ms para la transacción completa (P2028) con listas de
    // varios ítems, tirando 500 tras ~5s de espera. Un solo UPDATE
    // con CASE WHEN resuelve todas las posiciones en un round-trip.
    const ids=Prisma.join(items.map(item=>item.id))

    const positionCases=Prisma.join(
      items.map(item=>
        Prisma.sql`WHEN ${item.id} THEN ${item.position}`,
      ),
      " ",
    )

    await this.prisma.$executeRaw`
      UPDATE "Task"
      SET "position"=CASE "id" ${positionCases} END
      WHERE "id" IN (${ids})
    `

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