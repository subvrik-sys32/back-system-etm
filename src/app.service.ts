import {
  Injectable,
} from "@nestjs/common"

import {
  PrismaService,
} from "./infra/database/prisma/prisma.service"

@Injectable()
export class AppService {

  constructor(

    private readonly prisma:
      PrismaService,

  ){}

  async getHello(){

    const roles=
      await this.prisma.role.count()

    const users=
      await this.prisma.user.count()

    const projects=
      await this.prisma.project.count()

    const tasks=
      await this.prisma.task.count()

    return {

      status:"online",

      database:"connected",

      roles,

      users,

      projects,

      tasks,

    }

  }

}