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
  // Solo lo justo para mostrar "respondiendo a: fulano, 'texto'" en
  // la UI — no se incluye el user completo del parent, ni se sigue
  // la cadena hacia arriba (si el parent A SU VEZ es una respuesta).
  parent:{
    select:{
      id:true,
      message:true,
      deletedAt:true,
      user:{
        select:{ id:true, name:true },
      },
    },
  },
} satisfies Prisma.CommentInclude

export type CommentWithUser=Prisma.CommentGetPayload<{
  include:typeof commentInclude
}>