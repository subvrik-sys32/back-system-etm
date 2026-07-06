import {
  Injectable,
  NotFoundException,
} from "@nestjs/common"

import * as bcrypt from "bcrypt"

import { PrismaService } from "@/infra/database/prisma/prisma.service"
import { RealtimeService } from "@/modules/realtime/realtime.service"

import { CreateUserDto } from "./dto/create-user.dto"
import { UpdateUserDto } from "./dto/update-user.dto"

import { UpdateProfileDto } from "./dto/update-profile.dto"
import { UpdateAvatarDto } from "./dto/update-avatar.dto"

@Injectable()
export class UsersService {

  constructor(
    private readonly prisma:PrismaService,
    private readonly realtime:RealtimeService,
  ){}

  async findAll(){

    const users=await this.prisma.user.findMany({
      where:{ deletedAt:null },
      include:{ role:true },
      omit:{ passwordHash:true },
      orderBy:{ createdAt:"asc" },
    })

    return users.map(user=>({
      ...user,
      online:this.realtime.isUserOnline(user.id),
    }))

  }

  async findOne(id:string){
    const user=await this.prisma.user.findFirst({
      where:{ id, deletedAt:null },
      include:{ role:true },
      omit:{ passwordHash:true },
    })

    if(!user){
      throw new NotFoundException("User not found")
    }

    return {
      ...user,
      online:this.realtime.isUserOnline(user.id),
    }
  }

  async create(dto:CreateUserDto,actorId?:string){

    const passwordHash=await bcrypt.hash(dto.password,10)

    const user=await this.prisma.user.create({
      data:{
        username:dto.username,
        name:dto.name,
        email:dto.email,
        passwordHash,
        roleId:dto.roleId,
        icon:dto.icon,
        color:dto.color,
        active:dto.active??true,
      },
      include:{ role:true },
      omit:{ passwordHash:true },
    })

    this.realtime.publish({
      entity:"USER",
      action:"CREATED",
      id:user.id,
      payload:user,
      excludeUserId:actorId,
    })

    return user
  }

  async update(id:string,dto:UpdateUserDto,actorId?:string){

    const existing=await this.prisma.user.findUnique({ where:{ id } })

    if(!existing){
      throw new NotFoundException("User not found")
    }

    let passwordHash:string|undefined

    if(dto.password){
      passwordHash=await bcrypt.hash(dto.password,10)
    }

    const user=await this.prisma.user.update({
      where:{ id },
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
      include:{ role:true },
      omit:{ passwordHash:true },
    })

    this.realtime.publish({
      entity:"USER",
      action:"UPDATED",
      id:user.id,
      payload:user,
      excludeUserId:actorId,
    })

    return user
  }

  async updateProfile(userId:string, dto:UpdateProfileDto, actorId?:string){

    const user=await this.prisma.user.update({
      where:{ id:userId },
      data:{
        name:dto.name,
        phone:dto.phone,
        position:dto.position,
      },
      include:{ role:true },
      omit:{ passwordHash:true },
    })

    this.realtime.publish({
      entity:"USER",
      action:"UPDATED",
      id:user.id,
      payload:user,
      excludeUserId:actorId,
    })

    return user

  }

  async updateAvatar(userId:string, dto:UpdateAvatarDto, actorId?:string){

    const user=await this.prisma.user.update({
      where:{ id:userId },
      data:{ avatarUrl:dto.imageBase64 },
      include:{ role:true },
      omit:{ passwordHash:true },
    })

    this.realtime.publish({
      entity:"USER",
      action:"UPDATED",
      id:user.id,
      payload:user,
      excludeUserId:actorId,
    })

    return { avatarUrl:user.avatarUrl }

  }

  async removeAvatar(userId:string, actorId?:string){

    const user=await this.prisma.user.update({
      where:{ id:userId },
      data:{ avatarUrl:null },
      include:{ role:true },
      omit:{ passwordHash:true },
    })

    this.realtime.publish({
      entity:"USER",
      action:"UPDATED",
      id:user.id,
      payload:user,
      excludeUserId:actorId,
    })

    return { avatarUrl:null }

  }

  async remove(id:string,actorId?:string){

    const user=await this.prisma.user.update({
      where:{ id },
      data:{ deletedAt:new Date() },
    })

    this.realtime.publish({
      entity:"USER",
      action:"DELETED",
      id,
      excludeUserId:actorId,
    })

    return user
  }

  async directory(){

    const users=await this.prisma.user.findMany({
      where:{ deletedAt:null, active:true },
      include:{ role:true },
      omit:{ passwordHash:true },
      orderBy:{ name:"asc" },
    })

    return users.map(user=>({
      ...user,
      online:this.realtime.isUserOnline(user.id),
    }))

  }

}