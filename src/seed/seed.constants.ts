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
    icon: "clipboard-check",
    color: "#F97316",
    active: true,
  },
  {
    code: RoleCode.INGENIERIA,
    name: "Ingeniería",
    icon: "wrench",
    color: "#0284C7",
    active: true,
  },
  {
    code: RoleCode.PROYECTOS,
    name: "Proyectos",
    icon: "folder-kanban",
    color: "#7C3AED",
    active: true,
  },
  {
    code: RoleCode.PRODUCCION,
    name: "Producción",
    icon: "hard-hat",
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
  ],

  [RoleCode.PRODUCCION]: [
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
  ],

  [RoleCode.LOGISTICA]: [
    PermissionCode.PROJECT_READ,

    PermissionCode.TASK_READ,

    PermissionCode.WORKFLOW_READ,

    PermissionCode.MASTER_DATA_READ,

    PermissionCode.USER_READ,

    PermissionCode.COMMENT_READ,
    PermissionCode.COMMENT_CREATE,
  ],
} as const