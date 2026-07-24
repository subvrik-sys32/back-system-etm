import {
  RoleCode,
} from "@/core/enums/role-code.enum"

import {
  PermissionCode,
} from "@/core/enums/permission-code.enum"

export const ROLES = [
  {
    code: RoleCode.ADMIN,
    name: "Super Administrador",
    icon: "shield",
    color: "#DC2626",
    active: true,
  },
  {
    code: RoleCode.ADMINISTRACION,
    name: "Administración",
    icon: "quality",
    color: "#F97316",
    active: true,
  },
  {
    code: RoleCode.INGENIERIA,
    name: "Ingeniería",
    icon: "tool",
    color: "#0284C7",
    active: true,
  },
  {
    code: RoleCode.PROYECTOS,
    name: "Proyectos",
    icon: "project",
    color: "#7C3AED",
    active: true,
  },
  {
    code: RoleCode.PRODUCCION,
    name: "Producción",
    icon: "operator",
    color: "#22C55E",
    active: true,
  },
  {
    code: RoleCode.LOGISTICA,
    name: "Logística",
    icon: "truck",
    color: "#64748B",
    active: true,
  },
]

export const PERMISSIONS =
  Object
    .values(
      PermissionCode,
    )
    .map(
      code => ({
        code,
        description: code,
      }),
    )

export const ROLE_PERMISSIONS = {
  [RoleCode.ADMIN]:
    Object.values(
      PermissionCode,
    ),

  [RoleCode.ADMINISTRACION]: [
    PermissionCode.PROJECT_READ,

    PermissionCode.TASK_READ,
    PermissionCode.TASK_UPDATE,

    PermissionCode.WORKFLOW_READ,
    PermissionCode.WORKFLOW_UPDATE,
    PermissionCode.WORKFLOW_REVIEW,

    PermissionCode.USER_READ,

    PermissionCode.COMMENT_READ,
    PermissionCode.COMMENT_CREATE,
    PermissionCode.COMMENT_UPDATE,
    PermissionCode.COMMENT_DELETE,

    // Bitácora hoy usa la misma bitácora "de Producción" (no tiene
    // department propio todavía) hasta que se arme una bitácora
    // específica para Administración a futuro.
    PermissionCode.ACTIVITY_LOG_CREATE,
    PermissionCode.ACTIVITY_LOG_READ,
    PermissionCode.ACTIVITY_LOG_DELETE,
  ],

  [RoleCode.INGENIERIA]: [
    PermissionCode.PROJECT_READ,
    PermissionCode.PROJECT_UPDATE,

    PermissionCode.TASK_READ,
    PermissionCode.TASK_UPDATE,

    PermissionCode.WORKFLOW_READ,
    PermissionCode.WORKFLOW_UPDATE,

    PermissionCode.MASTER_DATA_READ,

    PermissionCode.USER_READ,

    PermissionCode.COMMENT_READ,
    PermissionCode.COMMENT_CREATE,
    PermissionCode.COMMENT_UPDATE,

    // Sin esto, la Bitácora de Ingeniería que se armó en esta
    // sesión queda inaccesible para el único rol al que pertenece
    // — el ítem de nav no aparece (gateado por ACTIVITY_LOG_READ) y
    // el backend rechaza cualquier intento igual.
    PermissionCode.ACTIVITY_LOG_CREATE,
    PermissionCode.ACTIVITY_LOG_READ,
    PermissionCode.ACTIVITY_LOG_DELETE,
  ],

  [RoleCode.PROYECTOS]: [
    PermissionCode.PROJECT_CREATE,
    PermissionCode.PROJECT_READ,
    PermissionCode.PROJECT_UPDATE,

    PermissionCode.TASK_CREATE,
    PermissionCode.TASK_READ,
    PermissionCode.TASK_UPDATE,
    PermissionCode.TASK_DELETE,

    PermissionCode.WORKFLOW_READ,
    PermissionCode.WORKFLOW_UPDATE,
    PermissionCode.WORKFLOW_REVIEW,

    PermissionCode.MASTER_DATA_READ,
    PermissionCode.MASTER_DATA_UPDATE,

    PermissionCode.USER_READ,

    PermissionCode.COMMENT_READ,
    PermissionCode.COMMENT_CREATE,
    PermissionCode.COMMENT_UPDATE,
    PermissionCode.COMMENT_DELETE,

    PermissionCode.ACTIVITY_LOG_CREATE,
    PermissionCode.ACTIVITY_LOG_READ,
    PermissionCode.ACTIVITY_LOG_DELETE,
  ],

  [RoleCode.PRODUCCION]: [
    PermissionCode.PROJECT_READ,

    PermissionCode.TASK_READ,
    PermissionCode.TASK_UPDATE,

    PermissionCode.WORKFLOW_READ,
    PermissionCode.WORKFLOW_UPDATE,
    PermissionCode.WORKFLOW_REVIEW,

    // Sin esto, EntitySelect (material/espesor/prioridad/cliente en
    // los formularios de tarea/proyecto) tira 403 al abrir el
    // dropdown — Producción tiene TASK_UPDATE, así que sí llega a
    // esos formularios.
    PermissionCode.MASTER_DATA_READ,

    PermissionCode.USER_READ,

    PermissionCode.COMMENT_READ,
    PermissionCode.COMMENT_CREATE,
    PermissionCode.COMMENT_UPDATE,
    PermissionCode.COMMENT_DELETE,

    // Sin esto, la Bitácora de Producción (el corazón de todo el
    // plan de esta sesión) queda inaccesible para Operarios y
    // Supervisores — exactamente el equipo para el que se construyó.
    PermissionCode.ACTIVITY_LOG_CREATE,
    PermissionCode.ACTIVITY_LOG_READ,
    PermissionCode.ACTIVITY_LOG_DELETE,
  ],

  [RoleCode.LOGISTICA]: [
    PermissionCode.PROJECT_READ,

    PermissionCode.TASK_READ,

    PermissionCode.WORKFLOW_READ,

    PermissionCode.MASTER_DATA_READ,

    PermissionCode.USER_READ,

    PermissionCode.COMMENT_READ,
    PermissionCode.COMMENT_CREATE,

    PermissionCode.ACTIVITY_LOG_CREATE,
    PermissionCode.ACTIVITY_LOG_READ,
    PermissionCode.ACTIVITY_LOG_DELETE,
  ],
} as const