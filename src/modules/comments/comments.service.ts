import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common"
import { randomUUID } from "crypto"
import sharp from "sharp"
import { CommentRepository } from "./repositories/comment.repository"
import { RealtimeService } from "@/modules/realtime/realtime.service"
import { NotificationsService } from "@/modules/notifications/notifications.service"
import { SupabaseStorageService } from "@/infra/storage/supabase-storage.service"
import { PermissionCode } from "@/core/enums/permission-code.enum"
import type { CurrentUserType } from "@/shared/types/current-user.types"

const COMMENT_PHOTOS_BUCKET = "comment-photos"

@Injectable()
export class CommentsService{

  private readonly logger = new Logger(CommentsService.name)

  constructor(
    private readonly commentRepository:CommentRepository,
    private readonly realtime:RealtimeService,
    private readonly notificationsService:NotificationsService,
    private readonly storage:SupabaseStorageService,
  ){}

  findAllByTask(taskId:string){
    return this.commentRepository.findAllByTask(taskId)
  }

  findAllByWorkflowStep(workflowStepId:string){
    return this.commentRepository.findAllByWorkflowStep(workflowStepId)
  }

  findAllByProject(projectId:string){
    return this.commentRepository.findAllByProject(projectId)
  }

  // Estado agregado de lectura del comentario.
  // Devuelve el total de destinatarios, cuántos ya lo leyeron y un
  // estado calculado:
  //
  // SENT          → nadie lo leyó.
  // READ_PARTIAL  → algunos lo leyeron.
  // READ_ALL      → todos lo leyeron.
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
    payload:
      | { id:string; taskId:string; projectId:null; workflowStepId:string|null; message:string; hasImage?:boolean }
      | { id:string; taskId:null; projectId:string; workflowStepId:null; message:string; hasImage?:boolean },
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

  // Comprime antes de subir — una foto de celular sin comprimir
  // (varios MB) no debería viajar tal cual a Storage ni transferirse
  // completa cada vez que se carga el historial de comentarios.
  // 1600px de lado máximo, WebP calidad 82: de sobra para ver el
  // detalle de lo compartido, muy por debajo del tamaño original.
  private async uploadCommentPhoto(imageBase64:string):Promise<string>{

    const commaIndex=imageBase64.indexOf(",")

    const rawBase64=
      commaIndex>=0
        ?imageBase64.slice(commaIndex+1)
        :imageBase64

    const inputBuffer=
      Buffer.from(rawBase64,"base64")

    const compressed=await sharp(inputBuffer)
      .resize(1600,1600,{
        fit:"inside",
        withoutEnlargement:true,
      })
      .webp({ quality:82 })
      .toBuffer()

    const path=`${randomUUID()}.webp`

    await this.storage.uploadFile(
      COMMENT_PHOTOS_BUCKET,
      path,
      compressed,
      "image/webp",
    )

    return this.storage.getPublicUrl(
      COMMENT_PHOTOS_BUCKET,
      path,
    )

  }

  async createForTask(taskId:string,message:string|undefined,userId:string,imageBase64?:string){

    if(!message?.trim()&&!imageBase64){
      throw new BadRequestException("El comentario necesita texto o una foto.")
    }

    const imageUrl=
      imageBase64
        ?await this.uploadCommentPhoto(imageBase64)
        :null

    const comment=await this.commentRepository.createForTask(taskId,userId,message??"",imageUrl)

    this.realtime.publish({
      entity:"COMMENT",
      action:"CREATED",
      id:comment.id,
      payload:comment,
      excludeUserId:userId,
    })

    this.fireNotifyComment(
      { id:comment.id, taskId:comment.taskId!, projectId:null, workflowStepId:null, message:comment.message, hasImage:!!imageUrl },
      userId,
    )

    return comment
  }

  async createForWorkflowStep(workflowStepId:string,message:string|undefined,userId:string,imageBase64?:string){

    if(!message?.trim()&&!imageBase64){
      throw new BadRequestException("El comentario necesita texto o una foto.")
    }

    const taskId=await this.commentRepository.getWorkflowStepTaskId(workflowStepId)

    if(!taskId){
      throw new NotFoundException("Workflow step not found")
    }

    const imageUrl=
      imageBase64
        ?await this.uploadCommentPhoto(imageBase64)
        :null

    const comment=await this.commentRepository.createForWorkflowStep(taskId,workflowStepId,userId,message??"",imageUrl)

    this.realtime.publish({
      entity:"COMMENT",
      action:"CREATED",
      id:comment.id,
      payload:comment,
      excludeUserId:userId,
    })

    this.fireNotifyComment(
      { id:comment.id, taskId:comment.taskId!, projectId:null, workflowStepId, message:comment.message, hasImage:!!imageUrl },
      userId,
    )

    return comment
  }

  async createForProject(projectId:string,message:string|undefined,userId:string,imageBase64?:string){

    if(!message?.trim()&&!imageBase64){
      throw new BadRequestException("El comentario necesita texto o una foto.")
    }

    const imageUrl=
      imageBase64
        ?await this.uploadCommentPhoto(imageBase64)
        :null

    const comment=await this.commentRepository.createForProject(projectId,userId,message??"",imageUrl)

    this.realtime.publish({
      entity:"COMMENT",
      action:"CREATED",
      id:comment.id,
      payload:comment,
      excludeUserId:userId,
    })

    // Antes NO se notificaba acá porque el modelo Notification exigía
    // taskId obligatorio. Ahora taskId/projectId son mutuamente
    // excluyentes (igual que en Comment), así que un comentario de
    // proyecto con @mención genera notificación como cualquier otro.
    this.fireNotifyComment(
      { id:comment.id, taskId:null, projectId:comment.projectId!, workflowStepId:null, message:comment.message, hasImage:!!imageUrl },
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
    target:{ scope:"task"; taskId:string } | { scope:"workflowStep"; workflowStepId:string } | { scope:"project"; projectId:string },
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
      payload:{ id, taskId:existing.taskId, workflowStepId:existing.workflowStepId, projectId:existing.projectId },
      excludeUserId:user.id,
    })

    return { id }
  }

}