import {
  Injectable,
  NotFoundException,
} from "@nestjs/common"

import * as bcrypt from "bcrypt"
import sharp from "sharp"

import { PrismaService } from "@/infra/database/prisma/prisma.service"
import { RealtimeService } from "@/modules/realtime/realtime.service"
import { SupabaseStorageService } from "@/infra/storage/supabase-storage.service"

import { CreateUserDto } from "./dto/create-user.dto"
import { UpdateUserDto } from "./dto/update-user.dto"

import { UpdateProfileDto } from "./dto/update-profile.dto"
import { UpdateAvatarDto } from "./dto/update-avatar.dto"

@Injectable()
export class UsersService {

  constructor(
    private readonly prisma:PrismaService,
    private readonly realtime:RealtimeService,
    private readonly storage:SupabaseStorageService,
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

    const existing=await this.prisma.user.findUnique({
      where:{ id },
      select:{ id:true },
    })

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

    // Arreglo de raíz: antes esto guardaba la imagen COMPLETA en
    // base64 directo en la columna avatarUrl — ese blob (varios MB
    // en base64 para una foto de celular normal) viajaba entero en
    // CADA fetch de /users/directory, que se pide en TODA página de
    // la app (sidebar-presence). Ahora se comprime, se sube a
    // Supabase Storage (mismo proyecto que ya usás para la base,
    // sin cuenta/credenciales nuevas), y en avatarUrl queda
    // guardada solo la URL pública — una string corta, no una
    // imagen entera repetida en cada fetch de cada usuario.
    const compressedBuffer=
      await this.compressAvatar(dto.imageBase64)

    // Borra los avatares viejos de este usuario ANTES de subir el
    // nuevo — si no, cada cambio de foto deja el archivo anterior
    // huérfano en el storage para siempre.
    await this.storage.deleteUserAvatars(userId)

    const avatarUrl=
      await this.storage.uploadAvatar(
        userId,
        compressedBuffer,
        "image/webp",
      )

    const user=await this.prisma.user.update({
      where:{ id:userId },
      data:{ avatarUrl },
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

  private async compressAvatar(imageBase64:string):Promise<Buffer>{

    const commaIndex=imageBase64.indexOf(",")

    const rawBase64=
      commaIndex>=0
        ?imageBase64.slice(commaIndex+1)
        :imageBase64

    const inputBuffer=
      Buffer.from(rawBase64,"base64")

    // 200x200 + WebP calidad 80: de sobra para un avatar que solo
    // se muestra como círculo chico (24-40px) en toda la app —
    // deja el archivo típicamente en 5-15KB.
    return sharp(inputBuffer)
      .resize(200,200,{
        fit:"cover",
        position:"centre",
      })
      .webp({ quality:80 })
      .toBuffer()

  }

  async removeAvatar(userId:string, actorId?:string){

    await this.storage.deleteUserAvatars(userId)

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

    // select explícito, no include+omit: antes traía CASI todos los
    // campos del usuario (email, phone, position, roleId, createdAt,
    // updatedAt) MÁS la relación completa "role" (con su array de
    // permisos) — nada de eso lo usa ninguno de los consumidores
    // reales de este endpoint (presencia del sidebar, filtros,
    // autocompletado de @menciones, filtro de operarios en
    // Procesos/Pipeline), que solo necesitan estos campos.
    //
    // role.code (un campo, no el objeto role completo) se agregó
    // para que ProcessOperatorCell pueda filtrar "solo operarios"
    // sin necesitar pegarle al endpoint pesado /users (protegido
    // con USER_READ, pensado para la página de administración).
    const users=await this.prisma.user.findMany({
      where:{ deletedAt:null, active:true },
      select:{
        id:true,
        name:true,
        username:true,
        avatarUrl:true,
        color:true,
        icon:true,
        role:{
          select:{ code:true },
        },
      },
      orderBy:{ name:"asc" },
    })

    return users.map(user=>({
      ...user,
      online:this.realtime.isUserOnline(user.id),
    }))

  }

}