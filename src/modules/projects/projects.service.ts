import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common"

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
    pm:{
      include:{
        role:true,
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
    })

    if(existing){
      throw new BadRequestException(
        `Project code "${trimmedCode}" already exists`,
      )
    }

    const[lastProject,totalProjects]=await Promise.all([
      this.prisma.project.findFirst({ orderBy:{ sequence:"desc" } }),
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

    await this.findOne(id)

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

    await this.prisma.$transaction(
      items.map(item=>
        this.prisma.project.update({
          where:{ id:item.id },
          data:{ position:item.position },
        }),
      ),
    )

    const projects=await this.findAll()

    this.realtime.publish({
      entity:"PROJECT",
      action:"REORDERED",
      id:"bulk",
      payload:projects,
      excludeUserId:userId,
    })

    return projects
  }

  async remove(id:string,userId:string){

    await this.findOne(id)

    const deletedAt=new Date()

    const project=

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

          return tx.project.update({

            where:{ id },

            data:{
              deletedAt,
              updatedById:userId,
            },

            include:this.includeRelations,

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

    return project

  }

}