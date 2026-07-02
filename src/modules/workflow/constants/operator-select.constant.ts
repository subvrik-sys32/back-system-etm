import { Prisma } from "@prisma/client"

export const operatorSelect = {
  id: true,
  username: true,
  name: true,
  icon: true,
  color: true,
} satisfies Prisma.UserSelect

export type OperatorLite = Prisma.UserGetPayload<{ select: typeof operatorSelect }>