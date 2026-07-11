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
  CreateStageDto,
} from "./dto/create-stage.dto"

import {
  UpdateStageDto,
} from "./dto/update-stage.dto"

@Injectable()
export class StagesService {

  constructor(

    private readonly prisma:
      PrismaService,

    private readonly codeGenerator:
      CodeGeneratorService,

    private readonly realtime:
      RealtimeService,

  ) {}

  findAll() {

    return this.prisma.stage.findMany({

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

    const stage =
      await this.prisma.stage.findFirst({

        where: {

          id,

          deletedAt: null,

        },

      })

    if (!stage) {

      throw new NotFoundException(
        "Stage not found",
      )

    }

    return stage

  }

  async create(
    dto: CreateStageDto,
    userId: string,
  ) {

    const code =
      await this.codeGenerator.generate(

        () =>
          this.prisma.stage.findMany({

            select: {

              code: true,

            },

          }),

        "STG",

      )

    const stage =
      await this.prisma.stage.create({

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
      entity: "STAGE",
      action: "CREATED",
      id: stage.id,
      payload: stage,
      excludeUserId: userId,
    })

    return stage

  }

  async update(

    id: string,

    dto: UpdateStageDto,

    userId: string,

  ) {

    await this.findOne(
      id,
    )

    const stage =
      await this.prisma.stage.update({

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
      entity: "STAGE",
      action: "UPDATED",
      id: stage.id,
      payload: stage,
      excludeUserId: userId,
    })

    return stage

  }

  async remove(
    id: string,
    userId: string,
  ) {

    await this.findOne(
      id,
    )

    const stage =
      await this.prisma.stage.update({

        where: {
          id,
        },

        data: {

          deletedAt:
            new Date(),

        },

      })

    this.realtime.publish({
      entity: "STAGE",
      action: "DELETED",
      id,
      excludeUserId: userId,
    })

    return stage

  }

}