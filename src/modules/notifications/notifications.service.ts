import { Injectable } from "@nestjs/common"
import { NotificationRepository } from "./repositories/notification.repository"
import { NotificationWithRelations } from "./entities/notification.entity"
import { RealtimeService } from "@/modules/realtime/realtime.service"
import { extractMentionedUsernames } from "@/modules/comments/utils/parse-mentions"
import { PrismaService } from "@/infra/database/prisma/prisma.service"

type CommentContext={
  id:string
  taskId:string
  workflowStepId:string|null
  message:string
  hasImage?:boolean
}

const DEFAULT_PAGE_SIZE=20

@Injectable()
export class NotificationsService{

  constructor(
    private readonly notificationRepository:NotificationRepository,
    private readonly realtime:RealtimeService,
    private readonly prisma:PrismaService,
  ){}

  private enrichNotification(
    notification:NotificationWithRelations,
  ){

    const history=
      notification.task.workflowSteps.length>0 &&
      notification.task.workflowSteps.every(
        step=>step.status==="REVIEWED",
      )

    return{

      ...notification,

      route:{

        module:
          notification.workflowStep
            ?"processes"
            :"tasks",

        processCode:
          notification.workflowStep?.processCode,

        history,

      },

    }

  }

  async findAllForUser(userId:string,cursor?:string,take=DEFAULT_PAGE_SIZE){

    const rows=await this.notificationRepository.findAllForUser(userId,{ cursor,take })

    const hasMore=rows.length>take
    const items=hasMore?rows.slice(0,take):rows
    const nextCursor=hasMore?items[items.length-1].id:null

    return{

      items:items.map(
        notification=>
          this.enrichNotification(
            notification,
          ),
      ),

      nextCursor,

    }

  }

  async getUnreadCount(userId:string){
    const count=await this.notificationRepository.countUnread(userId)
    return { count }
  }

  async markAsRead(id:string,userId:string){

    const existing=await this.notificationRepository.findById(id,userId)
    if(!existing)return null

    const updated=await this.notificationRepository.markAsRead(id)

    // Si esta notificación pertenece a un comentario, recalculamos y
    // publicamos el estado de lectura agregado, para que el autor del
    // comentario vea el "doble check" actualizarse en vivo.
    if(updated?.commentId){

      const status=await this.getCommentReadStatus(updated.commentId)

      this.realtime.publish({
        entity:"COMMENT_READ_STATUS",
        action:"UPDATED",
        id:updated.commentId,
        payload:{ commentId:updated.commentId,...status },
      })

    }

    return updated
      ?this.enrichNotification(updated)
      :null

  }

  async getCommentReadStatus(commentId:string){

    const rows=await this.notificationRepository.getReadStatusByComment(commentId)

    const total=rows.length
    const readCount=rows.filter(r=>r.read).length

    let status:"SENT"|"READ_PARTIAL"|"READ_ALL"

    if(readCount===0){

      status="SENT"

    }else if(readCount===total){

      status="READ_ALL"

    }else{

      status="READ_PARTIAL"

    }

    return{
      total,
      readCount,
      status,
    }

  }

  async markAllAsRead(userId:string){

    // Antes de marcar, averiguamos qué comentarios se van a ver
    // afectados, para poder recalcular y publicar su doble check
    // después. Una vez marcado como leído, ya no podríamos distinguir
    // "estaba sin leer" de "siempre estuvo leído".
    const unreadComments=await this.notificationRepository.findUnreadCommentIdsForUser(userId)

    await this.notificationRepository.markAllAsRead(userId)

    for(const { commentId } of unreadComments){
      const status=await this.getCommentReadStatus(commentId)
      this.realtime.publish({
        entity:"COMMENT_READ_STATUS",
        action:"UPDATED",
        id:commentId,
        payload:{ commentId,...status },
      })
    }

    return { success:true }

  }

  async remove(id:string,userId:string){

    const result=await this.notificationRepository.delete(id,userId)
    if(result.count===0)return null

    this.realtime.publishToUser(userId,{
      entity:"NOTIFICATION",
      action:"DELETED",
      id,
      payload:{ id },
    })

    return { id }

  }

  async removeAll(userId:string){

    await this.notificationRepository.deleteAllForUser(userId)

    this.realtime.publishToUser(userId,{
      entity:"NOTIFICATION",
      action:"DELETED_ALL",
      payload:{},
    })

    return { success:true }

  }

  async deleteByCommentId(commentId:string){

    const notifications=await this.notificationRepository.findManyByComment(commentId)
    if(notifications.length===0)return

    await this.notificationRepository.deleteByCommentId(commentId)

    for(const notification of notifications){
      this.realtime.publishToUser(notification.userId,{
        entity:"NOTIFICATION",
        action:"DELETED",
        id:notification.id,
        payload:{ id:notification.id },
      })
    }

  }

  async notifyComment(comment:CommentContext,actorId:string){

    const usernames=extractMentionedUsernames(comment.message)

    const mentionedUsers=usernames.length
      ?await this.notificationRepository.resolveUserIdsByUsernames(usernames)
      :[]

    const mentionedUserIds=new Set(
      mentionedUsers
        .map(u=>u.id)
        .filter(id=>id!==actorId),
    )

    const snippet=comment.message.length>0
      ?(comment.message.length>140
        ?`${comment.message.slice(0,140)}...`
        :comment.message)
      :(comment.hasImage?"📷 Foto":"")

    // Si hay @menciones, el comentario deja de ser global: solo se
    // notifica a las personas mencionadas. Si no hay menciones, se
    // notifica a todos los usuarios activos (comentario global).
    const rows=mentionedUserIds.size>0
      ?Array.from(mentionedUserIds).map(userId=>({
        userId,
        actorId,
        type:"MENTION" as const,
        taskId:comment.taskId,
        workflowStepId:comment.workflowStepId,
        commentId:comment.id,
        messageSnippet:snippet,
      }))
      :(await this.notificationRepository.getAllActiveUserIds(actorId)).map(u=>({
        userId:u.id,
        actorId,
        type:"COMMENT" as const,
        taskId:comment.taskId,
        workflowStepId:comment.workflowStepId,
        commentId:comment.id,
        messageSnippet:snippet,
      }))

    if(rows.length===0)return

    await this.notificationRepository.createMany(rows)

    // Volvemos a preguntarle a la DB qué quedó creado (con todos los
    // campos que Prisma agrega por default: createdAt, isRead, etc.),
    // para que el payload de realtime tenga exactamente la misma forma
    // que el front ya espera en cualquier otro lado (findAllForUser).
    // Es una consulta extra, pero barata, y evita romper el shape sin
    // tener a la vista el tipo Notification del front.
    const created=await this.notificationRepository.findManyByComment(comment.id)

    for(const notification of created){
      this.realtime.publishToUser(notification.userId,{
        entity:"NOTIFICATION",
        action:"CREATED",
        id:notification.id,
        payload:this.enrichNotification(
          notification,
        ),
      })
    }

  }

  async markTargetAsRead(
    userId:string,
    target:{ scope:"task"; taskId:string } | { scope:"workflowStep"; workflowStepId:string },
  ){

    const unread=target.scope==="task"
      ?await this.notificationRepository.findUnreadByTaskId(userId,target.taskId)
      :await this.notificationRepository.findUnreadByWorkflowStepId(userId,target.workflowStepId)

    if(unread.length===0)return { success:true }

    const ids=unread.map(n=>n.id)
    await this.notificationRepository.markManyAsRead(ids)

    // Un mismo "abrir historial" puede marcar leídas notificaciones de
    // varios comentarios distintos: recalculamos y publicamos el doble
    // check de cada uno.
    const uniqueCommentIds=Array.from(new Set(unread.map(n=>n.commentId)))

    for(const commentId of uniqueCommentIds){
      const status=await this.getCommentReadStatus(commentId)
      this.realtime.publish({
        entity:"COMMENT_READ_STATUS",
        action:"UPDATED",
        id:commentId,
        payload:{ commentId,...status },
      })
    }

    // Para que la campana del propio usuario (que marcó como leído)
    // también refleje el cambio sin esperar el refetchInterval.
    this.realtime.publishToUser(userId,{
      entity:"NOTIFICATION",
      action:"BULK_READ",
      payload:{ ids },
    })

    return { success:true }

  }

}