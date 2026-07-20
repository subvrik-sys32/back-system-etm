import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common"

import {
  PrismaService,
} from "@/infra/database/prisma/prisma.service"

import {
  CreateRoleDto,
} from "./dto/create-role.dto"

import {
  UpdateRoleDto,
} from "./dto/update-role.dto"

import {
  RealtimeService,
} from "@/modules/realtime/realtime.service"

@Injectable()
export class RolesService {

  constructor(

    private readonly prisma:
      PrismaService,

    private readonly realtime:
      RealtimeService,

  ){}

  findAll(){

    return this.prisma.role.findMany({

      orderBy:{
        name:"asc",
      },

    })

  }

  async create(dto:CreateRoleDto){

    const existing =
      await this.prisma.role.findUnique({

        where:{
          code:dto.code,
        },

      })

    if(existing){

      throw new BadRequestException(
        `Ya existe un rol con el code "${dto.code}"`,
      )

    }

    return this.prisma.role.create({

      data:{
        code:dto.code,
        name:dto.name,
        icon:dto.icon,
        color:dto.color,
        active:dto.active??true,
      },

    })

  }

  async update(
    id:string,
    dto:UpdateRoleDto,
  ){

    const existing =
      await this.prisma.role.findUnique({

        where:{ id },

        select:{ id:true },

      })

    if(!existing){

      throw new NotFoundException(
        "Role not found",
      )

    }

    return this.prisma.role.update({

      where:{ id },

      data:dto,

    })

  }

  async remove(id:string){

    const role =
      await this.prisma.role.findUnique({

        where:{ id },

        include:{

          _count:{
            select:{ users:true },
          },

        },

      })

    if(!role){

      throw new NotFoundException(
        "Role not found",
      )

    }

    // Sin este chequeo, el borrado fallaría igual (la FK de
    // User.roleId no tiene onDelete:Cascade a propósito — perder
    // gente asignada de la nada sería mucho peor que bloquear el
    // borrado) — pero con un error crudo de constraint de la base
    // en vez de este mensaje claro.
    if(role._count.users>0){

      throw new BadRequestException(
        `No se puede eliminar "${role.name}": tiene ${role._count.users} usuario(s) asignado(s). Reasigná esos usuarios a otro rol primero.`,
      )

    }

    await this.prisma.role.delete({

      where:{ id },

    })

  }

  async findPermissions(
    roleId:string,
  ){

    const role =
      await this.prisma.role.findUnique({

        where:{
          id:roleId,
        },

      })

    if(!role){

      throw new NotFoundException(
        "Role not found",
      )

    }

    const permissions =
      await this.prisma.rolePermission.findMany({

        where:{
          roleId,
        },

        include:{
          permission:true,
        },

        orderBy:{
          permission:{
            code:"asc",
          },
        },

      })

    return permissions.map(

      item => item.permission,

    )

  }

  async updatePermissions(
    roleId:string,
    permissionIds:string[],
  ){

    const role =
      await this.prisma.role.findUnique({

        where:{
          id:roleId,
        },

      })

    if(!role){

      throw new NotFoundException(
        "Role not found",
      )

    }

    // Antes de tocar nada: si viene algún id que no corresponde a
    // un permiso real (typo del cliente, id de otra tabla, etc.),
    // se corta ACÁ — nunca se llega a borrar los permisos actuales
    // del rol por una lista inválida.
    if(permissionIds.length>0){

      const validCount =
        await this.prisma.permission.count({

          where:{
            id:{ in:permissionIds },
          },

        })

      if(validCount!==permissionIds.length){

        throw new BadRequestException(
          "Uno o más permisos no existen",
        )

      }

    }

    // Transacción: borrar-y-recrear tiene que ser atómico. Sin
    // esto, si el create fallara justo después de que el delete ya
    // corrió, el rol quedaría sin NINGÚN permiso hasta el próximo
    // intento — con roles como OPERARIO eso bloquea gente
    // trabajando en planta de la nada.
    await this.prisma.$transaction([

      this.prisma.rolePermission.deleteMany({

        where:{
          roleId,
        },

      }),

      this.prisma.rolePermission.createMany({

        data:permissionIds.map(
          permissionId=>({
            roleId,
            permissionId,
          }),
        ),

      }),

    ])

    // A todos los conectados con ESTE rol — así su frontend refresca
    // los permisos al instante, en vez de quedarse con los que
    // tenía al iniciar sesión hasta que refresquen la página a mano.
    this.realtime.publishToRole(role.code,{
      entity:"ROLE_PERMISSIONS",
      action:"UPDATED",
      payload:{ roleCode:role.code },
    })

    return this.findPermissions(roleId)

  }

}