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

import * as bcrypt from "bcrypt"

import type {
  LoginResponseDto,
  MeResponseDto,
} from "./dto/auth-response.dto"

@Injectable()
export class AuthService{

  constructor(

    private readonly prisma:PrismaService,

    private readonly jwt:JwtService,

  ){}

  async login(

    email:string,

    password:string,

  ):Promise<LoginResponseDto>{

    const user=
      await this.prisma.user.findUnique({

        where:{
          email,
        },

        include:{

          role:{

            include:{

              permissions:{

                include:{
                  permission:true,
                },

              },

            },

          },

        },

      })

    if(!user){

      throw new UnauthorizedException(
        "Invalid credentials",
      )

    }

    const valid=
      await bcrypt.compare(

        password,

        user.passwordHash,

      )

    if(!valid){

      throw new UnauthorizedException(
        "Invalid credentials",
      )

    }

    return this.issueSession(user)

  }

  // Reemite el accessToken con los permisos ACTUALES del rol del
  // usuario, tomados de la base de datos. Se usa cuando un admin
  // edita un rol mientras hay gente logueada con ese rol: el evento
  // realtime les llega, y en vez de solo refrescar los stores del
  // front (que no cambia nada del lado del backend, porque el guard
  // de permisos solo confía en lo que venga firmado en el JWT), el
  // front llama a este endpoint y reemplaza el token guardado por
  // uno nuevo con los permisos al día. Requiere un accessToken
  // válido vigente (JwtAuthGuard) — no es un "login sin password",
  // solo renueva el contenido del token para el mismo usuario.
  async refresh(

    userId:string,

  ):Promise<LoginResponseDto>{

    const user=
      await this.prisma.user.findUnique({

        where:{
          id:userId,
        },

        include:{

          role:{

            include:{

              permissions:{

                include:{
                  permission:true,
                },

              },

            },

          },

        },

      })

    if(!user){

      throw new UnauthorizedException(
        "User not found",
      )

    }

    return this.issueSession(user)

  }

  private async issueSession(

    user:{

      id:string

      username:string|null

      name:string

      email:string

      icon:string

      color:string

      active:boolean

      avatarUrl:string|null

      phone:string|null

      position:string|null

      role:{

        id:string

        code:string

        name:string

        icon:string

        color:string

        active:boolean

        permissions:{
          permission:{code:string}
        }[]

      }

    },

  ):Promise<LoginResponseDto>{

    const permissions=
      user.role.permissions.map(

        permission=>
          permission.permission.code,

      )

    const accessToken=
      await this.jwt.signAsync({

        sub:user.id,

        email:user.email,

        role:user.role.code,

        permissions,

      })

    return{

      accessToken,

      permissions,

      user:{

        id:user.id,

        username:user.username,

        name:user.name,

        email:user.email,

        icon:user.icon,

        color:user.color,

        active:user.active,

        avatarUrl:user.avatarUrl,

        phone:user.phone,

        position:user.position,

        role:{

          id:user.role.id,

          code:user.role.code,

          name:user.role.name,

          icon:user.role.icon,

          color:user.role.color,

          active:user.role.active,

        },

      },

    }

  }

  async me(

    userId:string,

  ):Promise<MeResponseDto>{

    const user=
      await this.prisma.user.findUnique({

        where:{
          id:userId,
        },

        include:{

          role:{

            include:{

              permissions:{

                include:{
                  permission:true,
                },

              },

            },

          },

        },

        omit:{
          passwordHash:true,
        },

      })

    if(!user){

      throw new UnauthorizedException(
        "User not found",
      )

    }

    const permissions=
      user.role.permissions.map(

        permission=>
          permission.permission.code,

      )

    return{

      permissions,

      user:{

        id:user.id,

        username:user.username,

        name:user.name,

        email:user.email,

        icon:user.icon,

        color:user.color,

        active:user.active,

        avatarUrl:user.avatarUrl,

        phone:user.phone,

        position:user.position,

        role:{

          id:user.role.id,

          code:user.role.code,

          name:user.role.name,

          icon:user.role.icon,

          color:user.role.color,

          active:user.role.active,

        },

      },

    }

  }

}