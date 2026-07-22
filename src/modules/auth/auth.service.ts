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

import { JobLevel } from "@prisma/client"
import * as bcrypt from "bcrypt"

import type {
  LoginResponseDto,
  MeResponseDto,
} from "./dto/auth-response.dto"

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
        include: {
          role: {
            include: {
              permissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      })

    if (!user) {
      throw new UnauthorizedException(
        "Invalid credentials",
      )
    }

    const valid =
      await bcrypt.compare(
        password,
        user.passwordHash,
      )

    if (!valid) {
      throw new UnauthorizedException(
        "Invalid credentials",
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
        include: {
          role: {
            include: {
              permissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      })

    if (!user) {
      throw new UnauthorizedException(
        "User not found",
      )
    }

    return this.issueSession(user)

  }

  private async issueSession(
    user: {
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
      role: {
        id: string
        code: string
        name: string
        icon: string
        color: string
        active: boolean
        permissions: {
          permission: { code: string }
        }[]
      }
    },
  ): Promise<LoginResponseDto> {

    const permissions =
      user.role.permissions.map(
        permission =>
          permission.permission.code,
      )

    const accessToken =
      await this.jwt.signAsync({
        sub: user.id,
        email: user.email,
        role: user.role.code,
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
        role: {
          id: user.role.id,
          code: user.role.code,
          name: user.role.name,
          icon: user.role.icon,
          color: user.color,
          active: user.role.active,
        },
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
        include: {
          role: {
            include: {
              permissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
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
      user.role.permissions.map(
        permission =>
          permission.permission.code,
      )

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
        role: {
          id: user.role.id,
          code: user.role.code,
          name: user.role.name,
          icon: user.role.icon,
          color: user.role.color,
          active: user.role.active,
        },
      },
    }

  }

}