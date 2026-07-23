import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common"
import { Prisma } from "@prisma/client"

import { PrismaService } from "@/infra/database/prisma/prisma.service"
import { RealtimeService } from "@/modules/realtime/realtime.service"

import { CreateProjectDto } from "./dto/create-project.dto"
import { UpdateProjectDto } from "./dto/update-project.dto"
import { ReorderProjectItemDto } from "./dto/reorder-project.dto"

@Injectable()
export class ProjectsService{

  constructor(
    private readonly prisma:PrismaService,
    private readonly realtime:RealtimeService,
  ){}

  private readonly includeRelations={
    client:true,
    // ANTES: include:{role:true} sin select/omit — Prisma devuelve
    // TODOS los campos escalares del modelo User cuando no hay
    // select/omit explícito, incluido passwordHash. Se estaba
    // mandando el hash de contraseña del PM al frontend en cada
    // fetch de proyectos. select explícito con solo lo que se
    // renderiza de verdad (badge nombre+color+ícono).
    pm:{
      select:{
        id:true,
        name:true,
        color:true,
        icon:true,
      },
    },
    stage:true,
    status:true,
  }

  async findAll(){
    return this.prisma.project.findMany({
      where:{ deletedAt:null },
      include:this.includeRelations,
      orderBy:{ position:"asc" },
    })
  }

  async findOne(id:string){
    const project=await this.prisma.project.findFirst({
      where:{ id, deletedAt:null },
      relationLoadStrategy:"join",
      include:this.includeRelations,
    })

    if(!project){
      throw new NotFoundException("Project not found")
    }

    return project
  }

  async create(dto:CreateProjectDto,userId:string){

    const trimmedCode=dto.projectCode.trim()

    const existing=await this.prisma.project.findFirst({
      where:{ projectCode:trimmedCode, deletedAt:null },
      select:{ id:true },
    })

    if(existing){
      throw new BadRequestException(
        `Project code "${trimmedCode}" already exists`,
      )
    }

    const[lastProject,totalProjects]=await Promise.all([
      this.prisma.project.findFirst({
        orderBy:{ sequence:"desc" },
        select:{ sequence:true },
      }),
      this.prisma.project.count({ where:{ deletedAt:null } }),
    ])

    const project=await this.prisma.project.create({
      data:{
        projectCode:trimmedCode,
        name:dto.name.trim(),
        clientId:dto.clientId,
        pmId:dto.pmId,
        stageId:dto.stageId,
        statusId:dto.statusId,
        deliveryDate:dto.deliveryDate?new Date(dto.deliveryDate):null,
        sequence:(lastProject?.sequence??0)+1,
        position:totalProjects+1,
        createdById:userId,
        updatedById:userId,
      },
      include:this.includeRelations,
    })

    this.realtime.publish({
      entity:"PROJECT",
      action:"CREATED",
      id:project.id,
      payload:project,
      excludeUserId:userId,
    })

    return project
  }

  async update(id:string,dto:UpdateProjectDto,userId:string){

    const exists=await this.prisma.project.findUnique({
      where:{ id, deletedAt:null },
      select:{ id:true },
    })

    if(!exists){
      throw new NotFoundException("Project not found")
    }

    const updateData={
      ...dto,
      updatedById:userId,
      deliveryDate:dto.deliveryDate?new Date(dto.deliveryDate):undefined,
    }

    await this.prisma.project.update({
      where:{ id },
      data:updateData,
    })

    const project=await this.prisma.project.findUnique({
      where:{ id },
      relationLoadStrategy:"join",
      include:this.includeRelations,
    })

    if(project){
      this.realtime.publish({
        entity:"PROJECT",
        action:"UPDATED",
        id:project.id,
        payload:project,
        excludeUserId:userId,
      })
    }

    return project
  }

  async reorder(items:ReorderProjectItemDto[],userId:string){

    if(items.length===0){
      return items
    }

    // Antes: N updates individuales dentro de un $transaction([...]).
    // Cada UPDATE es un round-trip aparte a la DB, y el $transaction
    // (interactiva o de array) tiene un timeout DEFAULT de Prisma de
    // 5000ms para toda la operación. Con varios ítems (o latencia
    // normal de red/pooler) eso se comía el timeout y tiraba
    // PrismaClientKnownRequestError P2028 -> 500, con el request
    // "colgado" ~5s antes de fallar.
    //
    // Ahora: un solo UPDATE con CASE WHEN que actualiza todas las
    // posiciones en un único round-trip, sin importar cuántos ítems
    // se reordenen.
    const ids=Prisma.join(items.map(item=>item.id))

    const positionCases=Prisma.join(
      items.map(item=>
        Prisma.sql`WHEN ${item.id} THEN ${item.position}`,
      ),
      " ",
    )

    await this.prisma.$executeRaw`
      UPDATE "Project"
      SET "position"=CASE "id" ${positionCases} END
      WHERE "id" IN (${ids})
    `

    // Mismo problema que tenía Tasks: acá se hacía this.findAll()
    // completo (con client+pm+stage+status incluidos) solo para
    // mandar el nuevo orden por realtime. El handler del frontend
    // (project-handler.ts, caso REORDERED) solo necesita id+position
    // de las que en verdad cambiaron.
    this.realtime.publish({
      entity:"PROJECT",
      action:"REORDERED",
      id:"bulk",
      payload:items,
      excludeUserId:userId,
    })

    return items
  }

  async remove(id:string,userId:string){

    // findOne() completo (con client+pm+stage+status) era
    // innecesario acá — solo hace falta confirmar que exista.
    const exists=await this.prisma.project.findUnique({
      where:{ id },
      select:{ id:true },
    })

    if(!exists){
      throw new NotFoundException("Project not found")
    }

    const deletedAt=new Date()

    await this.prisma.$transaction(

      async tx=>{

        await tx.task.updateMany({

          where:{
            projectId:id,
            deletedAt:null,
          },

          data:{
            deletedAt,
            updatedById:userId,
          },

        })

        // Sin include acá: el publish de PROJECT/DELETED de más
        // abajo solo manda el id (project-handler.ts, caso DELETED,
        // solo usa event.id para sacarlo de la cache) — nadie
        // consume las relaciones de este resultado.
        return tx.project.update({

          where:{ id },

          data:{
            deletedAt,
            updatedById:userId,
          },

        })

      },

    )

    this.realtime.publish({

      entity:"PROJECT",

      action:"DELETED",

      id,

      excludeUserId:userId,

    })

    this.realtime.publish({

      entity:"TASK",

      action:"DELETED",

      id:"cascade",

      payload:{
        cascade:true,
        projectId:id,
      },

      excludeUserId:userId,

    })

    return { id }

  }

}