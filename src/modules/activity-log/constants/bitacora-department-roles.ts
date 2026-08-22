import { ActivityDepartment } from "@prisma/client"

import { RoleCode } from "@/core/enums/role-code.enum"

export const BITACORA_DEPARTMENT_ROLES: Partial<Record<ActivityDepartment, RoleCode[]>> = {
  [ActivityDepartment.INGENIERIA]: [RoleCode.INGENIERIA, RoleCode.PROYECTOS],
}