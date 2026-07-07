import { Injectable } from "@nestjs/common"
import { PrismaService } from "@/infra/database/prisma/prisma.service"
import { notificationInclude } from "../entities/notification.entity"

@Injectable()
export class NotificationRepository{

  constructor(private readonly prisma:PrismaService){}

  findAllForUser(userId:string, params:{ cursor?:string; take:number }){
    return this.prisma.notification.findMany({
      where:{ userId },
      include:notificationInclude,
      orderBy:{ createdAt:"desc" },
      take:params.take+1,
      ...(params.cursor
        ? { cursor:{ id:params.cursor }, skip:1 }
        : {}),
    })
  }

  countUnread(userId:string){
    return this.prisma.notification.count({
      where:{ userId, read:false },
    })
  }

  async findById(id:string,userId:string){
    return this.prisma.notification.findFirst({
      where:{ id, userId },
    })
  }

  markAsRead(id:string){
    return this.prisma.notification.update({
      where:{ id },
      data:{ read:true },
      include:notificationInclude,
    })
  }

  markAllAsRead(userId:string){
    return this.prisma.notification.updateMany({
      where:{ userId, read:false },
      data:{ read:true },
    })
  }

  createMany(data:{
    userId:string
    actorId:string
    type:"MENTION"|"COMMENT"
    taskId:string
    workflowStepId:string|null
    commentId:string
    messageSnippet:string
  }[]){
    return this.prisma.notification.createMany({ data })
  }

  findManyByComment(commentId:string){
    return this.prisma.notification.findMany({
      where:{ commentId },
      include:notificationInclude,
    })
  }

  resolveUserIdsByUsernames(usernames:string[]){
    return this.prisma.user.findMany({
      where:{
        username:{ in:usernames, mode:"insensitive" },
        deletedAt:null,
      },
      select:{ id:true, username:true },
    })
  }

  async getTaskParticipants(taskId:string){

    const task=await this.prisma.task.findUnique({
      where:{ id:taskId },
      select:{
        createdById:true,
        updatedById:true,
        project:{ select:{ pmId:true } },
      },
    })

    if(!task)return null

    const [commentAuthors,stepOperators]=await Promise.all([
      this.prisma.comment.findMany({
        where:{ taskId, deletedAt:null },
        distinct:["userId"],
        select:{ userId:true },
      }),
      this.prisma.workflowStep.findMany({
        where:{ taskId, operatorId:{ not:null } },
        distinct:["operatorId"],
        select:{ operatorId:true },
      }),
    ])

    return {
      createdById:task.createdById,
      updatedById:task.updatedById,
      pmId:task.project?.pmId??null,
      commentAuthorIds:commentAuthors.map(c=>c.userId),
      operatorIds:stepOperators
        .map(s=>s.operatorId)
        .filter((id):id is string=>!!id),
    }

  }

  delete(id:string,userId:string){
    return this.prisma.notification.deleteMany({
      where:{ id, userId },
    })
  }

  deleteAllForUser(userId:string){
    return this.prisma.notification.deleteMany({
      where:{ userId },
    })
  }

  deleteByCommentId(commentId:string){
    return this.prisma.notification.deleteMany({
      where:{ commentId },
    })
  }

}