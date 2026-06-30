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

  ) {}

  findAll() {

    return this.prisma.thickness.findMany({

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

    return this.prisma.thickness.create({

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

    dto: UpdateThicknessDto,

  ) {

    await this.findOne(id)

    return this.prisma.thickness.update({

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

    return this.prisma.thickness.update({

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