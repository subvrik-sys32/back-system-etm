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

    return this.prisma.stage.create({

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

    dto: UpdateStageDto,

  ) {

    await this.findOne(
      id,
    )

    return this.prisma.stage.update({

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

    await this.findOne(
      id,
    )

    return this.prisma.stage.update({

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