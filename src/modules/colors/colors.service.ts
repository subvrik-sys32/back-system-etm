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

  ) {}

  findAll() {

    return this.prisma.color.findMany({

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

    return this.prisma.color.create({

      data: {

        code,

        name: dto.name.trim(),

        icon: dto.icon,

        color: dto.color,

        active:
          dto.active ?? true,

      },

    })

  }

  async update(

    id: string,

    dto: UpdateColorDto,

  ) {

    await this.findOne(id)

    return this.prisma.color.update({

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

  }

  async remove(
    id: string,
  ) {

    await this.findOne(id)

    return this.prisma.color.update({

      where: {
        id,
      },

      data: {

        deletedAt:
          new Date(),

      },

    })

  }

}