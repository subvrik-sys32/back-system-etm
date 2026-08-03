import {
  Injectable,
  UnauthorizedException,
} from "@nestjs/common"

import {
  JwtService,
} from "@nestjs/jwt"

import {
  PrismaService,
} from "@/infra/database/prisma/prisma.service"

import { JobLevel, PermissionEffect } from "@prisma/client"
import * as bcrypt from "bcrypt"

import type {
  LoginResponseDto,
  MeResponseDto,
} from "./dto/auth-response.dto"

// Include compartido por login/refresh/me — roles con sus permisos
// (para armar la unión) + los overrides puntuales del propio
// usuario (para aplicar ALLOW/DENY encima) + areas, igual que antes.
const SESSION_USER_INCLUDE = {
  roles: {
    include: {
      permissions: {
        include: {
          permission: true,
        },
      },
    },
  },
  permissionOverrides: {
    include: {
      permission: true,
    },
  },
  areas: true,
} as const

type SessionUser = {
  id: string
  username: string | null
  name: string
  email: string
  level: JobLevel
  icon: string
  color: string
  active: boolean
  avatarUrl: string | null
  phone: string | null
  position: string | null
  roles: {
    id: string
    code: string
    name: string
    icon: string
    color: string
    active: boolean
    permissions: {
      permission: { code: string }
    }[]
  }[]
  permissionOverrides: {
    effect: PermissionEffect
    expiresAt: Date | null
    permission: { code: string }
  }[]
  areas: {
    id: string
    code: string
    label: string
    processCode: string | null
  }[]
}

@Injectable()
export class AuthService {

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(
    email: string,
    password: string,
  ): Promise<LoginResponseDto> {

    const user =
      await this.prisma.user.findUnique({
        where: {
          email,
        },
        include: SESSION_USER_INCLUDE,
      })

    if (!user) {
      throw new UnauthorizedException(
        "Credenciales inválidas",
      )
    }

    const valid =
      await bcrypt.compare(
        password,
        user.passwordHash,
      )

    if (!valid) {
      throw new UnauthorizedException(
        "Credenciales inválidas",
      )
    }

    return this.issueSession(user)

  }

  async refresh(
    userId: string,
  ): Promise<LoginResponseDto> {

    const user =
      await this.prisma.user.findUnique({
        where: {
          id: userId,
        },
        include: SESSION_USER_INCLUDE,
      })

    if (!user) {
      throw new UnauthorizedException(
        "User not found",
      )
    }

    return this.issueSession(user)

  }

  // Permisos efectivos = unión de los permisos de TODOS los roles
  // del usuario, más los overrides ALLOW que no estén vencidos,
  // menos los overrides DENY que no estén vencidos. DENY siempre
  // gana: si (por lo que sea) un mismo código quedara con ALLOW y
  // DENY a la vez, se aplica el DENY. Los overrides vencidos
  // (expiresAt en el pasado) se ignoran solos, sin necesidad de un
  // job que los borre.
  private computeEffectivePermissions(
    user: Pick<SessionUser, "roles" | "permissionOverrides">,
  ): string[] {

    const rolePermissions = new Set<string>()

    for (const role of user.roles) {
      for (const rolePermission of role.permissions) {
        rolePermissions.add(rolePermission.permission.code)
      }
    }

    const now = new Date()

    const allows = new Set<string>()
    const denies = new Set<string>()

    for (const override of user.permissionOverrides) {

      if (override.expiresAt && override.expiresAt < now) {
        continue
      }

      if (override.effect === PermissionEffect.DENY) {
        denies.add(override.permission.code)
      } else {
        allows.add(override.permission.code)
      }

    }

    const effective = new Set<string>(rolePermissions)

    for (const code of allows) {
      effective.add(code)
    }

    for (const code of denies) {
      effective.delete(code)
    }

    return Array.from(effective)

  }

  private async issueSession(
    user: SessionUser,
  ): Promise<LoginResponseDto> {

    const permissions =
      this.computeEffectivePermissions(user)

    const roleCodes =
      user.roles.map(role => role.code)

    const accessToken =
      await this.jwt.signAsync({
        sub: user.id,
        email: user.email,
        roles: roleCodes,
        level: user.level,
        permissions,
      })

    return {
      accessToken,
      permissions,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        level: user.level,
        icon: user.icon,
        color: user.color,
        active: user.active,
        avatarUrl: user.avatarUrl,
        phone: user.phone,
        position: user.position,
        roles: user.roles.map(role => ({
          id: role.id,
          code: role.code,
          name: role.name,
          icon: role.icon,
          color: role.color,
          active: role.active,
        })),
        // Array ahora (m2m) — antes un solo area nullable.
        areas: user.areas.map(area => ({
          id: area.id,
          code: area.code,
          label: area.label,
          processCode: area.processCode,
        })),
      },
    }

  }

  async me(
    userId: string,
  ): Promise<MeResponseDto> {

    const user =
      await this.prisma.user.findUnique({
        where: {
          id: userId,
        },
        include: SESSION_USER_INCLUDE,
        omit: {
          passwordHash: true,
        },
      })

    if (!user) {
      throw new UnauthorizedException(
        "User not found",
      )
    }

    const permissions =
      this.computeEffectivePermissions(user)

    return {
      permissions,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        level: user.level,
        icon: user.icon,
        color: user.color,
        active: user.active,
        avatarUrl: user.avatarUrl,
        phone: user.phone,
        position: user.position,
        roles: user.roles.map(role => ({
          id: role.id,
          code: role.code,
          name: role.name,
          icon: role.icon,
          color: role.color,
          active: role.active,
        })),
        // Array ahora (m2m) — antes un solo area nullable.
        areas: user.areas.map(area => ({
          id: area.id,
          code: area.code,
          label: area.label,
          processCode: area.processCode,
        })),
      },
    }

  }

}