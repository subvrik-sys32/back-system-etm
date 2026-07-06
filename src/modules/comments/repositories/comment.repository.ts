import { Injectable } from "@nestjs/common"
import { PrismaService } from "@/infra/database/prisma/prisma.service"
import { commentInclude } from "../entities/comment.entity"

@Injectable()
export class CommentRepository{

  constructor(private readonly prisma:PrismaService){}

  findAllByTask(taskId:string){
    return this.prisma.comment.findMany({
      where:{ taskId, deletedAt:null },
      include:commentInclude,
      orderBy:{ createdAt:"desc" },
    })
  }

  findById(id:string){
    return this.prisma.comment.findFirst({
      where:{ id, deletedAt:null },
      include:commentInclude,
    })
  }

  create(taskId:string,userId:string,message:string){
    return this.prisma.comment.create({
      data:{ taskId, userId, message:message.trim() },
      include:commentInclude,
    })
  }

  update(id:string,message:string){
    return this.prisma.comment.update({
      where:{ id },
      data:{ message:message.trim() },
      include:commentInclude,
    })
  }

  softDelete(id:string){
    return this.prisma.comment.update({
      where:{ id },
      data:{ deletedAt:new Date() },
    })
  }

}