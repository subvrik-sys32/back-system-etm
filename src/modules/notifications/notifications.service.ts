import { Injectable } from "@nestjs/common"
import { NotificationRepository } from "./repositories/notification.repository"
import { RealtimeService } from "@/modules/realtime/realtime.service"
import { extractMentionedUsernames } from "@/modules/comments/utils/parse-mentions"
import { PrismaService } from "@/infra/database/prisma/prisma.service"

type CommentContext={
  id:string
  taskId:string
  workflowStepId:string|null
  message:string
}

const DEFAULT_PAGE_SIZE=20

@Injectable()
export class NotificationsService{

  constructor(
    private readonly notificationRepository:NotificationRepository,
    private readonly realtime:RealtimeService,
    private readonly prisma:PrismaService,
  ){}

  async findAllForUser(userId:string, cursor?:string, take=DEFAULT_PAGE_SIZE){

    const rows=await this.notificationRepository.findAllForUser(userId,{ cursor, take })

    const hasMore=rows.length>take
    const items=hasMore?rows.slice(0,take):rows
    const nextCursor=hasMore?items[items.length-1].id:null

    return { items, nextCursor }

  }

  async getUnreadCount(userId:string){
    const count=await this.notificationRepository.countUnread(userId)
    return { count }
  }

  async markAsRead(id:string,userId:string){

    const existing=await this.notificationRepository.findById(id,userId)
    if(!existing)return null

    return this.notificationRepository.markAsRead(id)

  }

  async markAllAsRead(userId:string){
    await this.notificationRepository.markAllAsRead(userId)
    return { success:true }
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

    const participantIds=new Set<string>()

    const taskInfo=await this.notificationRepository.getTaskParticipants(comment.taskId)

    if(taskInfo){
      participantIds.add(taskInfo.createdById)
      participantIds.add(taskInfo.updatedById)
      if(taskInfo.project?.pmId){
        participantIds.add(taskInfo.project.pmId)
      }
    }

    if(comment.workflowStepId){
      const step=await this.notificationRepository.getWorkflowStepOperator(comment.workflowStepId)
      if(step?.operatorId){
        participantIds.add(step.operatorId)
      }
    }

    participantIds.delete(actorId)
    for(const id of mentionedUserIds){
      participantIds.delete(id)
    }

    const snippet=comment.message.length>140
      ?`${comment.message.slice(0,140)}...`
      :comment.message

    const rows=[
      ...Array.from(mentionedUserIds).map(userId=>({
        userId,
        actorId,
        type:"MENTION" as const,
        taskId:comment.taskId,
        workflowStepId:comment.workflowStepId,
        commentId:comment.id,
        messageSnippet:snippet,
      })),
      ...Array.from(participantIds).map(userId=>({
        userId,
        actorId,
        type:"COMMENT" as const,
        taskId:comment.taskId,
        workflowStepId:comment.workflowStepId,
        commentId:comment.id,
        messageSnippet:snippet,
      })),
    ]

    if(rows.length===0)return

    await this.notificationRepository.createMany(rows)

    const created=await this.notificationRepository.findManyByComment(comment.id)

    for(const notification of created){
      this.realtime.publishToUser(notification.userId,{
        entity:"NOTIFICATION",
        action:"CREATED",
        id:notification.id,
        payload:notification,
      })
    }

  }

}