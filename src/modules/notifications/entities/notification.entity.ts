import { Prisma } from "@prisma/client"
import { commentUserSelect } from "@/modules/comments/entities/comment.entity"

export const notificationInclude={
  actor:{
    select:commentUserSelect,
  },
  task:{
    select:{
      id:true,
      reference:true,
      taskNumber:true,
    },
  },
  workflowStep:{
    select:{
      id:true,
      processCode:true,
    },
  },
} satisfies Prisma.NotificationInclude

export type NotificationWithRelations=Prisma.NotificationGetPayload<{
  include:typeof notificationInclude
}>