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
  CreateColorDto,
} from "./dto/create-color.dto"

import {
  UpdateColorDto,
} from "./dto/update-color.dto"

@Injectable()
export class ColorsService {

  constructor(

    private readonly prisma:
      PrismaService,

    private readonly codeGenerator:
      CodeGeneratorService,

    private readonly realtime:
      RealtimeService,

  ) {}

  findAll() {

    return this.prisma.color.findMany({

      where: {
        deletedAt: null,
      },

      orderBy: {
        createdAt: "asc",
      },

    })

  }

  async findOne(
    id: string,
  ) {

    const color =
      await this.prisma.color.findFirst({

        where: {

          id,

          deletedAt: null,

        },

      })

    if (!color) {

      throw new NotFoundException(
        "Color not found",
      )

    }

    return color

  }

  async create(
    dto: CreateColorDto,
    userId: string,
  ) {

    const code =
      await this.codeGenerator.generate(

        () =>
          this.prisma.color.findMany({

            select: {

              code: true,

            },

          }),

        "CLR",

      )

    const color =
      await this.prisma.color.create({

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
      entity: "COLOR",
      action: "CREATED",
      id: color.id,
      payload: color,
      excludeUserId: userId,
    })

    return color

  }

  async update(

    id: string,

    dto: UpdateColorDto,

    userId: string,

  ) {

    await this.findOne(id)

    const color =
      await this.prisma.color.update({

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
      entity: "COLOR",
      action: "UPDATED",
      id: color.id,
      payload: color,
      excludeUserId: userId,
    })

    return color

  }

  async remove(
    id: string,
    userId: string,
  ) {

    await this.findOne(id)

    const color =
      await this.prisma.color.update({

        where: {
          id,
        },

        data: {

          deletedAt:
            new Date(),

        },

      })

    this.realtime.publish({
      entity: "COLOR",
      action: "DELETED",
      id,
      excludeUserId: userId,
    })

    return color

  }

}