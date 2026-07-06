import { Prisma } from "@prisma/client"

export const commentUserSelect={
  id:true,
  username:true,
  name:true,
  avatarUrl:true,
  color:true,
  icon:true,
} satisfies Prisma.UserSelect

export const commentInclude={
  user:{
    select:commentUserSelect,
  },
} satisfies Prisma.CommentInclude

export type CommentWithUser=Prisma.CommentGetPayload<{
  include:typeof commentInclude
}>