import { ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common"
import { CommentRepository } from "./repositories/comment.repository"
import { RealtimeService } from "@/modules/realtime/realtime.service"
import { NotificationsService } from "@/modules/notifications/notifications.service"
import { PermissionCode } from "@/core/enums/permission-code.enum"
import type { CurrentUserType } from "@/shared/types/current-user.types"

@Injectable()
export class CommentsService{

  private readonly logger = new Logger(CommentsService.name)

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

  // Estado de lectura agregado de un comentario ({ total, readCount,
  // allRead }), usado por el front para pintar el "doble check".
  getReadStatus(commentId:string){
    return this.notificationsService.getCommentReadStatus(commentId)
  }

  // Dispara la notificación SIN bloquear la respuesta al front. Antes,
  // el `await` acá hacía que el usuario esperara todo lo que
  // notifyComment tardara (buscar destinatarios, crear registros,
  // enviar push/email) para recién ver su comentario reflejado. El
  // comentario ya está guardado y publicado por realtime en este punto;
  // la notificación es un efecto secundario que puede resolverse un
  // instante después sin que nadie lo note.
  //
  // .catch() es obligatorio: sin él, un rechazo acá se vuelve un
  // "unhandled promise rejection" que puede tumbar el proceso en Node
  // según la configuración, o like at least ensuciar los logs sin
  // contexto.
  private fireNotifyComment(
    payload:{ id:string; taskId:string; workflowStepId:string|null; message:string },
    userId:string,
  ){

    this.notificationsService
      .notifyComment(payload, userId)
      .catch(error => {

        this.logger.error(
          `Fallo al notificar el comentario ${payload.id}`,
          error instanceof Error ? error.stack : error,
        )

      })

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

    this.fireNotifyComment(
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

    this.fireNotifyComment(
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

  markAsRead(
    target:{ scope:"task"; taskId:string } | { scope:"workflowStep"; workflowStepId:string },
    userId:string,
  ){
    return this.notificationsService.markTargetAsRead(userId,target)
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

    // Igual que arriba: esto es un efecto secundario de limpieza, no
    // necesita bloquear la respuesta de borrado.
    this.notificationsService
      .deleteByCommentId(id)
      .catch(error => {

        this.logger.error(
          `Fallo al limpiar notificaciones del comentario ${id}`,
          error instanceof Error ? error.stack : error,
        )

      })

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