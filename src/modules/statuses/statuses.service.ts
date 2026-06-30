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

    return this.prisma.status.create({

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

    dto: UpdateStatusDto,

  ) {

    await this.findOne(
      id,
    )

    return this.prisma.status.update({

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

    return this.prisma.status.update({

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