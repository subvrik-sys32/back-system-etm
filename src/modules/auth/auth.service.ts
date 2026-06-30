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