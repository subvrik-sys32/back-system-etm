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

  findUnreadByTaskId(userId:string, taskId:string){
    return this.prisma.notification.findMany({
      where:{ userId, read:false, taskId, workflowStepId:null },
      select:{ id:true, commentId:true },
    })
  }

  findUnreadByWorkflowStepId(userId:string, workflowStepId:string){
    return this.prisma.notification.findMany({
      where:{ userId, read:false, workflowStepId },
      select:{ id:true, commentId:true },
    })
  }

  markManyAsRead(ids:string[]){
    return this.prisma.notification.updateMany({
      where:{ id:{ in:ids } },
      data:{ read:true },
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

  // Todos los usuarios activos del sistema, excepto el que comenta.
  // Es la base de un comentario "global": si no hay @mención, le
  // llega a todos.
  getAllActiveUserIds(excludeUserId:string){
    return this.prisma.user.findMany({
      where:{
        deletedAt:null,
        active:true,
        id:{ not:excludeUserId },
      },
      select:{ id:true },
    })
  }

  // Estado de lectura de un comentario: cuántos destinatarios ya lo
  // vieron. Es la base del "doble check" en el front.
  getReadStatusByComment(commentId:string){
    return this.prisma.notification.findMany({
      where:{ commentId },
      select:{ userId:true, read:true },
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
