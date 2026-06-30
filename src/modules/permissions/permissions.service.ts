import {
  Injectable,
} from "@nestjs/common"

import {
  PrismaService,
} from "@/infra/database/prisma/prisma.service"

@Injectable()
export class PermissionsService {

  constructor(

    private readonly prisma:
      PrismaService,

  ){}

  findAll(){

    return this.prisma.permission.findMany({

      orderBy:{
        code:"asc",
      },

    })

  }

}