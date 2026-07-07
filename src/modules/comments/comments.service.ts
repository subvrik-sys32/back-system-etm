import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common"
import { CommentRepository } from "./repositories/comment.repository"
import { RealtimeService } from "@/modules/realtime/realtime.service"
import { NotificationsService } from "@/modules/notifications/notifications.service"
import { PermissionCode } from "@/core/enums/permission-code.enum"
import type { CurrentUserType } from "@/shared/types/current-user.types"

@Injectable()
export class CommentsService{

  constructor(
    private readonly commentRepository:CommentRepository,
    private readonly realtime:RealtimeService,
    private readonly notificationsService:NotificationsService,
  ){}

  findAllByTask(taskId:string){
    return this.commentRepository.findAllByTask(taskId)
  }

  findAllByWorkflowStep(workflowStepId:string){
    return this.commentRepository.findAllByWorkflowStep(workflowStepId)
  }

  async createForTask(taskId:string,message:string,userId:string){

    const comment=await this.commentRepository.createForTask(taskId,userId,message)

    this.realtime.publish({
      entity:"COMMENT",
      action:"CREATED",
      id:comment.id,
      payload:comment,
      excludeUserId:userId,
    })

    await this.notificationsService.notifyComment(
      { id:comment.id, taskId:comment.taskId, workflowStepId:null, message:comment.message },
      userId,
    )

    return comment
  }

  async createForWorkflowStep(workflowStepId:string,message:string,userId:string){

    const taskId=await this.commentRepository.getWorkflowStepTaskId(workflowStepId)

    if(!taskId){
      throw new NotFoundException("Workflow step not found")
    }

    const comment=await this.commentRepository.createForWorkflowStep(taskId,workflowStepId,userId,message)

    this.realtime.publish({
      entity:"COMMENT",
      action:"CREATED",
      id:comment.id,
      payload:comment,
      excludeUserId:userId,
    })

    await this.notificationsService.notifyComment(
      { id:comment.id, taskId:comment.taskId, workflowStepId, message:comment.message },
      userId,
    )

    return comment
  }

  async update(id:string,message:string,userId:string){

    const existing=await this.commentRepository.findById(id)
    if(!existing)throw new NotFoundException("Comment not found")
    if(existing.userId!==userId)throw new ForbiddenException("No podés editar un comentario ajeno.")

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

  async remove(id:string,user:CurrentUserType){

    const existing=await this.commentRepository.findById(id)
    if(!existing)throw new NotFoundException("Comment not found")

    const isOwner=existing.userId===user.id
    const canDeleteAny=(user.permissions??[]).includes(PermissionCode.COMMENT_DELETE_ANY)

    if(!isOwner&&!canDeleteAny){
      throw new ForbiddenException("No podés eliminar un comentario ajeno.")
    }

    await this.commentRepository.softDelete(id)
    await this.notificationsService.deleteByCommentId(id)

    this.realtime.publish({
      entity:"COMMENT",
      action:"DELETED",
      id,
      payload:{ id, taskId:existing.taskId, workflowStepId:existing.workflowStepId },
      excludeUserId:user.id,
    })

    return { id }
  }

}