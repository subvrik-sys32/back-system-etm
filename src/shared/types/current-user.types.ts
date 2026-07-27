import { JobLevel } from "@prisma/client"

export type CurrentUserType = {
  id: string
  email: string
  roles: string[]
  level: JobLevel
  permissions: string[]
}