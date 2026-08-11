import { Prisma } from "@prisma/client"

export const commentUserSelect = {
  id: true,
  username: true,
  name: true,
  avatarUrl: true,
  color: true,
  icon: true,
} satisfies Prisma.UserSelect

/** Include estándar de hilos (task/project/proceso). */
export const commentInclude = {
  user: {
    select: commentUserSelect,
  },
  parent: {
    select: {
      id: true,
      message: true,
      deletedAt: true,
      user: {
        select: { id: true, name: true },
      },
    },
  },
} satisfies Prisma.CommentInclude

/**
 * Include enriquecido para GET /comments/mine (centro Mensajes).
 * Misma idea que notificaciones: contexto de tarea/proyecto/proceso
 * + steps para calcular "historial".
 */
export const myCommentInclude = {
  user: {
    select: commentUserSelect,
  },
  parent: {
    select: {
      id: true,
      message: true,
      deletedAt: true,
      user: {
        select: { id: true, name: true },
      },
    },
  },
  task: {
    select: {
      id: true,
      reference: true,
      taskNumber: true,
      project: {
        select: {
          id: true,
          projectCode: true,
          name: true,
        },
      },
      workflowSteps: {
        select: { status: true },
      },
    },
  },
  project: {
    select: {
      id: true,
      projectCode: true,
      name: true,
    },
  },
  workflowStep: {
    select: {
      id: true,
      processCode: true,
      status: true,
    },
  },
} satisfies Prisma.CommentInclude

export type CommentWithUser = Prisma.CommentGetPayload<{
  include: typeof commentInclude
}>

export type MyCommentWithContext = Prisma.CommentGetPayload<{
  include: typeof myCommentInclude
}>
