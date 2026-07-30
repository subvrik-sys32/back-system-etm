import { ActivityDepartment } from "@prisma/client"

import { RoleCode } from "@/core/enums/role-code.enum"

// Qué roles (además de ADMIN, que siempre pasa) pueden ver/crear en
// la bitácora de cada departamento. Hoy solo INGENIERIA está
// restringida — el resto de los departamentos se filtra por dato,
// no por rol, así que no necesitan entrada acá (ver
// assertDepartmentAccess: sin entrada = abierto a cualquiera con el
// permiso general ACTIVITY_LOG_*).
//
// Esta es la ÚNICA fuente de verdad de este chequeo en el backend.
// El frontend tiene su propio espejo en
// features/activity-log/constants/departments.ts (navigation.ts y el
// guard de /bitacora/[dept] leen de ahí) — si un rol nuevo necesita
// entrar a una bitácora departamental, hay que actualizar los DOS
// lados, o vuelve a pasar lo que le pasó a PROYECTOS: el sidebar lo
// dejaba entrar, pero el backend lo rechazaba con 403.
export const BITACORA_DEPARTMENT_ROLES: Partial<Record<ActivityDepartment, RoleCode[]>> = {
  [ActivityDepartment.INGENIERIA]: [RoleCode.INGENIERIA, RoleCode.PROYECTOS],
}