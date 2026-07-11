import {
  Injectable,
  NotFoundException,
} from "@nestjs/common"

import {
  PrismaService,
} from "@/infra/database/prisma/prisma.service"

import {
  CodeGeneratorService,
} from "@/shared/code-generator/code-generator.service"

import {
  RealtimeService,
} from "@/modules/realtime/realtime.service"

import {
  CreateStatusDto,
} from "./dto/create-status.dto"

import {
  UpdateStatusDto,
} from "./dto/update-status.dto"

@Injectable()
export class StatusesService {

  constructor(

    private readonly prisma:
      PrismaService,

    private readonly codeGenerator:
      CodeGeneratorService,

    private readonly realtime:
      RealtimeService,

  ) {}

  findAll() {

    return this.prisma.status.findMany({

      where: {
        deletedAt: null,
      },

      orderBy: {
        name: "asc",
      },

    })

  }

  async findOne(
    id: string,
  ) {

    const status =
      await this.prisma.status.findFirst({

        where: {

          id,

          deletedAt: null,

        },

      })

    if (!status) {

      throw new NotFoundException(
        "Status not found",
      )

    }

    return status

  }

  async create(
    dto: CreateStatusDto,
    userId: string,
  ) {

    const code =
      await this.codeGenerator.generate(

        () =>
          this.prisma.status.findMany({

            select: {

              code: true,

            },

          }),

        "STS",

      )

    const status =
      await this.prisma.status.create({

        data: {

          code,

          name: dto.name.trim(),

          icon: dto.icon,

          color: dto.color,

          active:
            dto.active ?? true,

        },

      })

    this.realtime.publish({
      entity: "STATUS",
      action: "CREATED",
      id: status.id,
      payload: status,
      excludeUserId: userId,
    })

    return status

  }

  async update(

    id: string,

    dto: UpdateStatusDto,

    userId: string,

  ) {

    await this.findOne(
      id,
    )

    const status =
      await this.prisma.status.update({

        where: {
          id,
        },

        data: {

          name: dto.name?.trim(),

          icon: dto.icon,

          color: dto.color,

          active: dto.active,

        },

      })

    this.realtime.publish({
      entity: "STATUS",
      action: "UPDATED",
      id: status.id,
      payload: status,
      excludeUserId: userId,
    })

    return status

  }

  async remove(
    id: string,
    userId: string,
  ) {

    await this.findOne(
      id,
    )

    const status =
      await this.prisma.status.update({

        where: {
          id,
        },

        data: {

          deletedAt:
            new Date(),

        },

      })

    this.realtime.publish({
      entity: "STATUS",
      action: "DELETED",
      id,
      excludeUserId: userId,
    })

    return status

  }

}