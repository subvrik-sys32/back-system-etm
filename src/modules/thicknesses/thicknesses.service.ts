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
  CreateThicknessDto,
} from "./dto/create-thickness.dto"

import {
  UpdateThicknessDto,
} from "./dto/update-thickness.dto"

@Injectable()
export class ThicknessesService {

  constructor(

    private readonly prisma:
      PrismaService,

    private readonly codeGenerator:
      CodeGeneratorService,

    private readonly realtime:
      RealtimeService,

  ) {}

  findAll() {

    return this.prisma.thickness.findMany({

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

    const thickness =
      await this.prisma.thickness.findFirst({

        where: {

          id,

          deletedAt: null,

        },

      })

    if (!thickness) {

      throw new NotFoundException(
        "Thickness not found",
      )

    }

    return thickness

  }

  async create(
    dto: CreateThicknessDto,
    userId: string,
  ) {

    const code =
      await this.codeGenerator.generate(

        () =>
          this.prisma.thickness.findMany({

            select: {

              code: true,

            },

          }),

        "THK",

      )

    const thickness =
      await this.prisma.thickness.create({

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
      entity: "THICKNESS",
      action: "CREATED",
      id: thickness.id,
      payload: thickness,
      excludeUserId: userId,
    })

    return thickness

  }

  async update(

    id: string,

    dto: UpdateThicknessDto,

    userId: string,

  ) {

    await this.findOne(id)

    const thickness =
      await this.prisma.thickness.update({

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
      entity: "THICKNESS",
      action: "UPDATED",
      id: thickness.id,
      payload: thickness,
      excludeUserId: userId,
    })

    return thickness

  }

  async remove(
    id: string,
    userId: string,
  ) {

    await this.findOne(id)

    const thickness =
      await this.prisma.thickness.update({

        where: {
          id,
        },

        data: {

          deletedAt:
            new Date(),

        },

      })

    this.realtime.publish({
      entity: "THICKNESS",
      action: "DELETED",
      id,
      excludeUserId: userId,
    })

    return thickness

  }

}