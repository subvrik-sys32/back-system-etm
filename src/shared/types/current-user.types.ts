import { JobLevel } from "@prisma/client"

export type CurrentUserType = {
  id: string
  email: string
  role: string
  level: JobLevel
  permissions: string[]
}