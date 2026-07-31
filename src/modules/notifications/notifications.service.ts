import { Injectable, Logger } from "@nestjs/common"
import { NotificationRepository } from "./repositories/notification.repository"
import { NotificationWithRelations } from "./entities/notification.entity"
import { RealtimeService } from "@/modules/realtime/realtime.service"
import { extractMentionedUsernames } from "@/modules/comments/utils/parse-mentions"
import { PrismaService } from "@/infra/database/prisma/prisma.service"

type CommentContext=
  | { id:string; taskId:string; projectId:null; workflowStepId:string|null; message:string; hasImage?:boolean }
  | { id:string; taskId:null; projectId:string; workflowStepId:null; message:string; hasImage?:boolean }

const DEFAULT_PAGE_SIZE=20

// deleteByCommentId corre casi siempre bien, pero si falla (timeout
// de DB, pool agotado, blip de red) y nadie reintenta, la
// notificación queda huérfana mostrando el texto del comentario ya
// borrado PARA SIEMPRE — nadie se entera salvo revisando logs del
// server. 3 intentos con backoff corto cubre la enorme mayoría de
// fallas transitorias sin agregar demora perceptible al borrado de
// un comentario.
const DELETE_BY_COMMENT_MAX_ATTEMPTS=3
const DELETE_BY_COMMENT_BACKOFF_MS=200

function sleep(ms:number){
  return new Promise(resolve=>setTimeout(resolve,ms))
}

@Injectable()
export class NotificationsService{

  private readonly logger=new Logger(NotificationsService.name)

  constructor(
    private readonly notificationRepository:NotificationRepository,
    private readonly realtime:RealtimeService,
    private readonly prisma:PrismaService,
  ){}

  private enrichNotification(
    notification:NotificationWithRelations,
  ){

    // Los comentarios de proyecto no tienen tarea (`task` es null acá):
    // no hay noción de "historial" que aplique, así que directamente
    // no son históricas.
    const history=
      !!notification.task &&
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
            :notification.task
              ?"tasks"
              :"projects",

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

    // El where ya excluye commentId null (ver repository), pero
    // Prisma no achica el TIPO en base al where — sigue viniendo
    // como string|null acá, así que se filtra también en runtime
    // para poder pasarlo a getCommentReadStatus (pide string).
    for(const { commentId } of unreadComments){

      if(!commentId)continue

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

    let notifications
    let lastError:unknown

    for(let attempt=1;attempt<=DELETE_BY_COMMENT_MAX_ATTEMPTS;attempt++){

      try{

        notifications=await this.notificationRepository.findManyByComment(commentId)
        if(notifications.length===0)return

        await this.notificationRepository.deleteByCommentId(commentId)
        lastError=undefined
        break

      }catch(error){

        lastError=error

        if(attempt<DELETE_BY_COMMENT_MAX_ATTEMPTS){
          this.logger.warn(
            `deleteByCommentId falló (intento ${attempt}/${DELETE_BY_COMMENT_MAX_ATTEMPTS}) para comentario ${commentId}, reintentando…`,
            error instanceof Error?error.stack:error,
          )
          await sleep(DELETE_BY_COMMENT_BACKOFF_MS*attempt)
        }

      }

    }

    if(lastError){
      // Se agotaron los reintentos: esto SÍ necesita ser visible más
      // allá de un log — el caller (comments.service.ts) lo espera
      // (await) y decide qué hacer (hoy: loguear como error propio;
      // mañana, opcionalmente, encolar para un reintento diferido).
      throw lastError
    }

    for(const notification of notifications??[]){
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

    // Armamos acá el trío taskId/projectId/workflowStepId correlacionado
    // UNA sola vez. Si se accede a comment.taskId y comment.projectId
    // por separado dentro de cada .map() de abajo, TS pierde la
    // correlación entre ambos campos (los ensancha cada uno a
    // `string|null` de forma independiente) y ya no calza con el tipo
    // discriminado que espera notificationRepository.createMany.
    const target:
      | { taskId:string; projectId:null; workflowStepId:string|null }
      | { taskId:null; projectId:string; workflowStepId:null } =
      comment.taskId===null
        ?{ taskId:null, projectId:comment.projectId, workflowStepId:null }
        :{ taskId:comment.taskId, projectId:null, workflowStepId:comment.workflowStepId }

    // Si hay @menciones, el comentario deja de ser global: solo se
    // notifica a las personas mencionadas. Si no hay menciones, se
    // notifica a todos los usuarios activos (comentario global).
    const rows=mentionedUserIds.size>0
      ?Array.from(mentionedUserIds).map(userId=>({
        userId,
        actorId,
        type:"MENTION" as const,
        ...target,
        commentId:comment.id,
        messageSnippet:snippet,
      }))
      :(await this.notificationRepository.getAllActiveUserIds(actorId)).map(u=>({
        userId:u.id,
        actorId,
        type:"COMMENT" as const,
        ...target,
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

  // "Convocar" desde TaskAreaPanel — a diferencia de notifyComment,
  // esto no nace de un comentario (commentId null) y siempre tiene
  // un destinatario puntual (nunca "todos los usuarios activos").
  async notifyTaskAssignment(params:{
    operatorId:string
    actorId:string
    taskId:string
    workflowStepId:string
    type:"TASK_ASSIGNED"|"TASK_SUMMONED"
    messageSnippet:string
  }){

    await this.notificationRepository.createMany([{
      userId:params.operatorId,
      actorId:params.actorId,
      type:params.type,
      taskId:params.taskId,
      projectId:null,
      workflowStepId:params.workflowStepId,
      commentId:null,
      messageSnippet:params.messageSnippet,
    }])

    // Mismo motivo que en notifyComment: volvemos a preguntarle a la
    // DB qué quedó creado para que el payload de realtime tenga la
    // forma exacta que el front espera (createdAt, isRead, etc.),
    // en vez de armarlo a mano acá.
    const [created]=await this.notificationRepository.findManyByWorkflowStepAndUser(
      params.workflowStepId,
      params.operatorId,
    )

    if(created){
      this.realtime.publishToUser(created.userId,{
        entity:"NOTIFICATION",
        action:"CREATED",
        id:created.id,
        payload:this.enrichNotification(created),
      })
    }

  }

  // "Desconvocar" desde TaskAreaPanel — deshace notifyTaskAssignment:
  // borra la(s) notificación(es) que se le habían mandado a este
  // operario por este step, y le avisa por realtime que
  // desaparecieron (mismo patrón que remove()/removeAll() de más
  // arriba).
  async retractTaskAssignment(workflowStepId:string,userId:string){

    const deleted=await this.notificationRepository.findAndDeleteTaskAssignmentNotifications(
      workflowStepId,
      userId,
    )

    for(const notification of deleted){
      this.realtime.publishToUser(userId,{
        entity:"NOTIFICATION",
        action:"DELETED",
        id:notification.id,
        payload:{ id:notification.id },
      })
    }

  }

  async markTargetAsRead(
    userId:string,
    target:{ scope:"task"; taskId:string } | { scope:"workflowStep"; workflowStepId:string } | { scope:"project"; projectId:string },
  ){

    // El tipo declarado sigue con commentId:string|null (los where
    // de las 3 queries de abajo ya excluyen null, pero Prisma no
    // angosta el TIPO generado en base al where) — se filtra en
    // runtime más abajo antes de usarlo donde se pide string puro.
    let unread:{ id:string; commentId:string|null }[]

    if(target.scope==="task"){
      unread=await this.notificationRepository.findUnreadByTaskId(userId,target.taskId)
    }else if(target.scope==="workflowStep"){
      unread=await this.notificationRepository.findUnreadByWorkflowStepId(userId,target.workflowStepId)
    }else{
      unread=await this.notificationRepository.findUnreadByProjectId(userId,target.projectId)
    }

    if(unread.length===0)return { success:true }

    const ids=unread.map(n=>n.id)
    await this.notificationRepository.markManyAsRead(ids)

    // Un mismo "abrir historial" puede marcar leídas notificaciones de
    // varios comentarios distintos: recalculamos y publicamos el doble
    // check de cada uno. .filter(Boolean) sale el null (ya no debería
    // haber ninguno por el where, esto es solo para el tipo).
    const uniqueCommentIds=Array.from(
      new Set(unread.map(n=>n.commentId)),
    ).filter((commentId):commentId is string=>commentId!==null)

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