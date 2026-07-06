import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common"
import { CommentRepository } from "./repositories/comment.repository"
import { RealtimeService } from "@/modules/realtime/realtime.service"

@Injectable()
export class CommentsService{

  constructor(
    private readonly commentRepository:CommentRepository,
    private readonly realtime:RealtimeService,
  ){}

  findAllByTask(taskId:string){
    return this.commentRepository.findAllByTask(taskId)
  }

  async create(taskId:string,message:string,userId:string){

    const comment=await this.commentRepository.create(taskId,userId,message)

    this.realtime.publish({
      entity:"COMMENT",
      action:"CREATED",
      id:comment.id,
      payload:comment,
      excludeUserId:userId,
    })

    return comment
  }

  async update(id:string,message:string,userId:string){

    const existing=await this.commentRepository.findById(id)

    if(!existing){
      throw new NotFoundException("Comment not found")
    }

    if(existing.userId!==userId){
      throw new ForbiddenException("No podés editar un comentario ajeno.")
    }

    const comment=await this.commentRepository.update(id,message)

    this.realtime.publish({
      entity:"COMMENT",
      action:"UPDATED",
      id:comment.id,
      payload:comment,
      excludeUserId:userId,
    })

    return comment
  }

  async remove(id:string,userId:string){

    const existing=await this.commentRepository.findById(id)

    if(!existing){
      throw new NotFoundException("Comment not found")
    }

    if(existing.userId!==userId){
      throw new ForbiddenException("No podés eliminar un comentario ajeno.")
    }

    await this.commentRepository.softDelete(id)

    this.realtime.publish({
      entity:"COMMENT",
      action:"DELETED",
      id,
      payload:{ id, taskId:existing.taskId },
      excludeUserId:userId,
    })

    return { id }
  }

}