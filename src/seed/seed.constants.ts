import {
  RoleCode,
} from "@/core/enums/role-code.enum"

import {
  PermissionCode,
} from "@/core/enums/permission-code.enum"

export const ROLES = [

  {
    code: RoleCode.ADMIN,
    name: "Administrador",
    icon: "shield",
    color: "#DC2626",
    active: true,
  },

  {
    code: RoleCode.GERENCIA,
    name: "Gerencia",
    icon: "briefcase",
    color: "#7C3AED",
    active: true,
  },

  {
    code: RoleCode.PROJECT_MANAGER,
    name: "Project Manager",
    icon: "folder-kanban",
    color: "#0284C7",
    active: true,
  },

  {
    code: RoleCode.SUPERVISOR,
    name: "Supervisor",
    icon: "clipboard-check",
    color: "#F97316",
    active: true,
  },

  {
    code: RoleCode.OPERARIO,
    name: "Operario",
    icon: "hard-hat",
    color: "#22C55E",
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

  [RoleCode.GERENCIA]: [

    PermissionCode.PROJECT_CREATE,
    PermissionCode.PROJECT_READ,
    PermissionCode.PROJECT_UPDATE,
    PermissionCode.PROJECT_DELETE,

    PermissionCode.TASK_CREATE,
    PermissionCode.TASK_READ,
    PermissionCode.TASK_UPDATE,
    PermissionCode.TASK_DELETE,

    PermissionCode.WORKFLOW_READ,
    PermissionCode.WORKFLOW_UPDATE,

  ],

  [RoleCode.PROJECT_MANAGER]: [

    PermissionCode.PROJECT_CREATE,
    PermissionCode.PROJECT_READ,
    PermissionCode.PROJECT_UPDATE,

    PermissionCode.TASK_CREATE,
    PermissionCode.TASK_READ,
    PermissionCode.TASK_UPDATE,
    PermissionCode.TASK_DELETE,

    PermissionCode.WORKFLOW_READ,
    PermissionCode.WORKFLOW_UPDATE,

  ],

  [RoleCode.SUPERVISOR]: [

    PermissionCode.PROJECT_READ,

    PermissionCode.TASK_READ,
    PermissionCode.TASK_UPDATE,

    PermissionCode.WORKFLOW_READ,
    PermissionCode.WORKFLOW_UPDATE,

  ],

  [RoleCode.OPERARIO]: [

    PermissionCode.PROJECT_READ,

    PermissionCode.TASK_READ,

    PermissionCode.WORKFLOW_READ,
    PermissionCode.WORKFLOW_UPDATE,

  ],

} as const