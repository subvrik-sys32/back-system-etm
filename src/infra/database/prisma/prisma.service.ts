import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common"

import {
  PrismaClient,
} from "@prisma/client"

import {
  prismaProfiler,
} from "./prisma.profiler"

@Injectable()
export class PrismaService
  extends PrismaClient
  implements
    OnModuleInit,
    OnModuleDestroy{

  private readonly logger=
    new Logger(
      PrismaService.name,
    )

  constructor(){

    super({

      log:[
        "warn",
        "error",
      ],

    })

    this.logger.log(
      "PrismaService created",
    )

    return Object.assign(

      this,

      this.$extends(
        prismaProfiler,
      ),

    )

  }

  async onModuleInit(){

    console.time(
      "PRISMA CONNECT",
    )

    await this.$connect()

    console.timeEnd(
      "PRISMA CONNECT",
    )

  }

  async onModuleDestroy(){

    await this.$disconnect()

  }

}