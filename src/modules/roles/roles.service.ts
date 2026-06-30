import {
  Injectable,
  NotFoundException,
} from "@nestjs/common"

import {
  PrismaService,
} from "@/infra/database/prisma/prisma.service"

@Injectable()
export class RolesService {

  constructor(

    private readonly prisma:
      PrismaService,

  ){}

  findAll(){

    return this.prisma.role.findMany({

      orderBy:{
        name:"asc",
      },

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

}