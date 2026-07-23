import { Injectable } from "@nestjs/common"
import * as bcrypt from "bcrypt"
import { JobLevel } from "@prisma/client"

import { PrismaService } from "@/infra/database/prisma/prisma.service"
import { RoleCode } from "@/core/enums/role-code.enum"

import {
  ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
} from "./seed.constants"

import { PRIORITIES } from "./priority.seed"
import { ACTIVITY_TYPES } from "./activity-type.seed"
import { MATERIALS } from "./material.seed"
import { THICKNESSES } from "./thickness.seed"
import { COLORS } from "./color.seed"
import { STAGES } from "./stage.seed"
import { STATUSES } from "./status.seed"

@Injectable()
export class SeedService {

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async run() {

    await this.seedRoles()
    await this.migrateLegacyRoles()
    await this.seedPermissions()
    await this.seedRolePermissions()

    await this.seedPriorities()
    await this.seedActivityTypes()
    await this.seedMaterials()
    await this.seedThicknesses()
    await this.seedColors()
    await this.seedStages()
    await this.seedStatuses()

    await this.seedAdmin()

    return {
      success: true,
    }

  }

  private async seedRoles() {

    for (const role of ROLES) {

      await this.prisma.role.upsert({

        where: {
          code: role.code,
        },

        create: role,

        update: {

          name: role.name,

          icon: role.icon,

          color: role.color,

          active: role.active,

        },

      })

    }

  }

  // Migración de datos de la vieja estructura de roles (donde
  // SUPERVISOR, OPERARIO y PROJECT_MANAGER eran roles propios) a la
  // nueva (departamentos + level). Se corre después de seedRoles()
  // porque necesita que PRODUCCION y PROYECTOS ya existan como
  // destino. Es idempotente: si un rol viejo ya no existe (porque
  // ya se migró en una corrida anterior), simplemente lo salta.
  private async migrateLegacyRoles() {

    const LEGACY_TO_NEW: Record<
      string,
      { newCode: string; level?: JobLevel }
    > = {
      SUPERVISOR: {
        newCode: RoleCode.PRODUCCION,
        level: JobLevel.SUPERVISOR,
      },
      OPERARIO: {
        newCode: RoleCode.PRODUCCION,
        level: JobLevel.OPERARIO,
      },
      PROJECT_MANAGER: {
        newCode: RoleCode.PROYECTOS,
      },
    }

    for (const [legacyCode, mapping] of Object.entries(LEGACY_TO_NEW)) {

      const legacyRole =
        await this.prisma.role.findUnique({
          where: { code: legacyCode },
        })

      if (!legacyRole) {
        continue
      }

      const newRole =
        await this.prisma.role.findUniqueOrThrow({
          where: { code: mapping.newCode },
        })

      await this.prisma.user.updateMany({
        where: { roleId: legacyRole.id },
        data: {
          roleId: newRole.id,
          ...(mapping.level && { level: mapping.level }),
        },
      })

      await this.prisma.role.delete({
        where: { id: legacyRole.id },
      })

    }

    // GERENCIA se elimina sin reasignar a nadie porque se confirmó
    // que no tiene usuarios — igual lo validamos acá antes de borrar
    // en vez de asumirlo ciegamente.
    const gerenciaRole =
      await this.prisma.role.findUnique({
        where: { code: "GERENCIA" },
      })

    if (gerenciaRole) {

      const usersOnGerencia =
        await this.prisma.user.count({
          where: { roleId: gerenciaRole.id },
        })

      if (usersOnGerencia === 0) {
        await this.prisma.role.delete({
          where: { id: gerenciaRole.id },
        })
      }

    }

  }

  private async seedPermissions() {

    for (const permission of PERMISSIONS) {

      await this.prisma.permission.upsert({
        where: { code: permission.code },
        create: permission,
        update: {},
      })

    }

  }

  private async seedRolePermissions() {

    for (const [roleName, permissions] of Object.entries(ROLE_PERMISSIONS)) {

      const role =
        await this.prisma.role.findUnique({
          where: { code: roleName },
        })

      if (!role) {
        continue
      }

      const currentPermissions =
        await this.prisma.permission.findMany({
          where: {
            code: {
              in: permissions as unknown as string[],
            },
          },
        })

      const currentPermissionIds =
        currentPermissions.map(
          permission => permission.id,
        )

      await this.prisma.rolePermission.deleteMany({

        where: {

          roleId: role.id,

          permissionId: {
            notIn: currentPermissionIds,
          },

        },

      })

      for (const permission of currentPermissions) {

        await this.prisma.rolePermission.upsert({

          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permission.id,
            },
          },

          create: {
            roleId: role.id,
            permissionId: permission.id,
          },

          update: {},

        })

      }

    }

  }

  private async seedPriorities() {

    for (const priority of PRIORITIES) {

      await this.prisma.priority.upsert({

        where: {
          code: priority.code,
        },

        create: priority,

        update: {
          name: priority.name,
          icon: priority.icon,
          color: priority.color,
        },

      })

    }

  }

  private async seedActivityTypes() {

    for (const type of ACTIVITY_TYPES) {

      await this.prisma.activityType.upsert({

        where: {
          code: type.code,
        },

        create: type,

        update: {
          label: type.label,
          icon: type.icon,
          color: type.color,
          order: type.order,
          pinned: type.pinned ?? true,
        },

      })

    }

    // "OTRO" quedó redundante: el propio botón "Otros" del picker ya
    // cumple ese rol de catch-all, tener además un tipo llamado
    // literal "Otro" adentro era confuso ("otro dentro de otros").
    // Se sacó de ACTIVITY_TYPES — esto da de baja (soft-delete) la
    // fila si quedó de una corrida vieja del seed, sin tocar los
    // logs ya registrados con ese tipo (siguen viéndose igual, solo
    // deja de poder elegirse en logs nuevos).
    await this.prisma.activityType.updateMany({
      where: { code: "OTRO", deletedAt: null },
      data: { deletedAt: new Date(), active: false },
    })

  }

  private async seedMaterials() {

    for (const material of MATERIALS) {

      await this.prisma.material.upsert({

        where: {
          code: material.code,
        },

        create: material,

        update: {
          name: material.name,
          icon: material.icon,
          color: material.color,
        },

      })

    }

  }

  private async seedThicknesses() {

    for (const thickness of THICKNESSES) {

      await this.prisma.thickness.upsert({

        where: {
          code: thickness.code,
        },

        create: thickness,

        update: {
          name: thickness.name,
          icon: thickness.icon,
          color: thickness.color,
        },

      })

    }

  }

  private async seedColors() {

    for (const color of COLORS) {

      await this.prisma.color.upsert({

        where: {
          code: color.code,
        },

        create: color,

        update: {
          name: color.name,
          icon: color.icon,
          color: color.color,
        },

      })

    }

  }

  private async seedStages() {

    for (const stage of STAGES) {

      await this.prisma.stage.upsert({

        where: {
          code: stage.code,
        },

        create: stage,

        update: {
          name: stage.name,
          icon: stage.icon,
          color: stage.color,
        },

      })

    }

  }

  private async seedStatuses() {

    for (const status of STATUSES) {

      await this.prisma.status.upsert({

        where: {
          code: status.code,
        },

        create: status,

        update: {
          name: status.name,
          icon: status.icon,
          color: status.color,
        },

      })

    }

  }

  private async seedAdmin() {

    const adminRole =
      await this.prisma.role.findUnique({
        where: {
          code: RoleCode.ADMIN,
        },
      })

    if (!adminRole) {
      throw new Error(
        "ADMIN role not found",
      )
    }

    const passwordHash =
      await bcrypt.hash(
        "Admin123*",
        10,
      )

    await this.prisma.user.upsert({

      where: {
        email: "admin@etmperu.com",
      },

      create: {
        username: "admin",
        name: "Administrador ETM",
        email: "admin@etmperu.com",
        passwordHash,
        roleId: adminRole.id,
        level: JobLevel.GENERAL,
        icon: "user",
        color: "#7C3AED",
      },

      update: {
        username: "admin",
        name: "Administrador ETM",
        roleId: adminRole.id,
        level: JobLevel.GENERAL,
        icon: "user",
        color: "#7C3AED",
      },

    })

  }

}