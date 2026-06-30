import { Injectable } from "@nestjs/common"
import * as bcrypt from "bcrypt"

import { PrismaService } from "@/infra/database/prisma/prisma.service"
import { RoleCode } from "@/core/enums/role-code.enum"

import {
  ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
} from "./seed.constants"

import { PRIORITIES } from "./priority.seed"
import { MATERIALS } from "./material.seed"
import { THICKNESSES } from "./thickness.seed"
import { COLORS } from "./color.seed"
import { STAGES } from "./stage.seed"
import { STATUSES } from "./status.seed"

@Injectable()
export class SeedService {

  constructor(
    private readonly prisma:PrismaService,
  ){}

  async run(){

    await this.seedRoles()
    await this.seedPermissions()
    await this.seedRolePermissions()

    await this.seedPriorities()
    await this.seedMaterials()
    await this.seedThicknesses()
    await this.seedColors()
    await this.seedStages()
    await this.seedStatuses()

    await this.seedAdmin()

    return {
      success:true,
    }

  }

  private async seedRoles(){

    for(const role of ROLES){

      await this.prisma.role.upsert({

        where:{
          code:role.code,
        },

        create:role,

        update:{

          name:role.name,

          icon:role.icon,

          color:role.color,

          active:role.active,

        },

      })

    }

  }

  private async seedPermissions(){

    for(const permission of PERMISSIONS){

      await this.prisma.permission.upsert({
        where:{ code:permission.code },
        create:permission,
        update:{},
      })

    }

  }

  private async seedRolePermissions(){

    for(const [roleName,permissions] of Object.entries(ROLE_PERMISSIONS)){

      const role =
        await this.prisma.role.findUnique({
          where:{ code:roleName },
        })

      if(!role){
        continue
      }

      for(const permissionCode of permissions){

        const permission =
          await this.prisma.permission.findUnique({
            where:{ code:permissionCode },
          })

        if(!permission){
          continue
        }

        await this.prisma.rolePermission.upsert({

          where:{
            roleId_permissionId:{
              roleId:role.id,
              permissionId:permission.id,
            },
          },

          create:{
            roleId:role.id,
            permissionId:permission.id,
          },

          update:{},

        })

      }

    }

  }

  private async seedPriorities(){

    for(const priority of PRIORITIES){

      await this.prisma.priority.upsert({

        where:{
          code:priority.code,
        },

        create:priority,

        update:{
          name:priority.name,
          icon:priority.icon,
          color:priority.color,
        },

      })

    }

  }

  private async seedMaterials(){

    for(const material of MATERIALS){

      await this.prisma.material.upsert({

        where:{
          code:material.code,
        },

        create:material,

        update:{
          name:material.name,
          icon:material.icon,
          color:material.color,
        },

      })

    }

  }

  private async seedThicknesses(){

    for(const thickness of THICKNESSES){

      await this.prisma.thickness.upsert({

        where:{
          code:thickness.code,
        },

        create:thickness,

        update:{
          name:thickness.name,
          icon:thickness.icon,
          color:thickness.color,
        },

      })

    }

  }

  private async seedColors(){

    for(const color of COLORS){

      await this.prisma.color.upsert({

        where:{
          code:color.code,
        },

        create:color,

        update:{
          name:color.name,
          icon:color.icon,
          color:color.color,
        },

      })

    }

  }

  private async seedStages(){

    for(const stage of STAGES){

      await this.prisma.stage.upsert({

        where:{
          code:stage.code,
        },

        create:stage,

        update:{
          name:stage.name,
          icon:stage.icon,
          color:stage.color,
        },

      })

    }

  }

  private async seedStatuses(){

    for(const status of STATUSES){

      await this.prisma.status.upsert({

        where:{
          code:status.code,
        },

        create:status,

        update:{
          name:status.name,
          icon:status.icon,
          color:status.color,
        },

      })

    }

  }

  private async seedAdmin(){

    const adminRole =
      await this.prisma.role.findUnique({
        where:{
          code:RoleCode.ADMIN,
        },
      })

    if(!adminRole){
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

      where:{
        email:"admin@etmsac.com",
      },

      create:{
        username:"admin",
        name:"Administrador ETM",
        email:"admin@etmsac.com",
        passwordHash,
        roleId:adminRole.id,
        icon:"user",
        color:"#7C3AED",
      },

      update:{
        username:"admin",
        name:"Administrador ETM",
        roleId:adminRole.id,
        icon:"user",
        color:"#7C3AED",
      },

    })

  }

}