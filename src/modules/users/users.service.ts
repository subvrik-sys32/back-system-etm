import {
  Injectable,
  NotFoundException,
} from "@nestjs/common"

import * as bcrypt from "bcrypt"

import {
  PrismaService,
} from "@/infra/database/prisma/prisma.service"

import {
  CreateUserDto,
} from "./dto/create-user.dto"

import {
  UpdateUserDto,
} from "./dto/update-user.dto"

@Injectable()
export class UsersService {

  constructor(
    private readonly prisma:PrismaService,
  ){}

  async findAll(){

    return this.prisma.user.findMany({

      where:{
        deletedAt:null,
      },

      include:{
        role:true,
      },

      omit:{
        passwordHash:true,
      },

      orderBy:{
        createdAt:"desc",
      },

    })

  }

  async findOne(
    id:string,
  ){

    const user =
      await this.prisma.user.findFirst({

        where:{
          id,
          deletedAt:null,
        },

        include:{
          role:true,
        },

        omit:{
          passwordHash:true,
        },

      })

    if(!user){

      throw new NotFoundException(
        "User not found",
      )

    }

    return user

  }

  async create(
    dto:CreateUserDto,
  ){

    const passwordHash =
      await bcrypt.hash(
        dto.password,
        10,
      )

    return this.prisma.user.create({

      data:{

        username:dto.username,

        name:dto.name,

        email:dto.email,

        passwordHash,

        roleId:dto.roleId,

        icon:dto.icon,

        color:dto.color,

        active:
          dto.active ?? true,

      },

      include:{
        role:true,
      },

      omit:{
        passwordHash:true,
      },

    })

  }

  async update(
    id:string,
    dto:UpdateUserDto,
  ){

    const user =
      await this.prisma.user.findUnique({

        where:{
          id,
        },

      })

    if(!user){

      throw new NotFoundException(
        "User not found",
      )

    }

    let passwordHash:
      string | undefined

    if(dto.password){

      passwordHash =
        await bcrypt.hash(
          dto.password,
          10,
        )

    }

    return this.prisma.user.update({

      where:{
        id,
      },

      data:{

        username:dto.username,

        name:dto.name,

        email:dto.email,

        roleId:dto.roleId,

        icon:dto.icon,

        color:dto.color,

        active:dto.active,

        passwordHash,

      },

      include:{
        role:true,
      },

      omit:{
        passwordHash:true,
      },

    })

  }

  async remove(
    id:string,
  ){

    return this.prisma.user.update({

      where:{
        id,
      },

      data:{

        deletedAt:
          new Date(),

      },

    })

  }

  async directory(){

    return this.prisma.user.findMany({

      where:{
        deletedAt:null,
        active:true,
      },

      include:{
        role:true,
      },

      omit:{
        passwordHash:true,
      },

      orderBy:{
        name:"asc",
      },

    })

  }

}