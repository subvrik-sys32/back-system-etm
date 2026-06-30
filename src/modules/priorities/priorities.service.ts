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
  CreatePriorityDto,
} from "./dto/create-priority.dto"

import {
  UpdatePriorityDto,
} from "./dto/update-priority.dto"

@Injectable()
export class PrioritiesService {

  constructor(

    private readonly prisma:
      PrismaService,

    private readonly codeGenerator:
      CodeGeneratorService,

  ) {}

  findAll() {

    return this.prisma.priority.findMany({

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

    const priority =
      await this.prisma.priority.findFirst({

        where: {

          id,

          deletedAt: null,

        },

      })

    if (!priority) {

      throw new NotFoundException(
        "Priority not found",
      )

    }

    return priority

  }

  async create(
    dto: CreatePriorityDto,
  ) {

    const code =
      await this.codeGenerator.generate(

        () =>
          this.prisma.priority.findMany({

            select: {

              code: true,

            },

          }),

        "PRI",

      )

    return this.prisma.priority.create({

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

    dto: UpdatePriorityDto,

  ) {

    await this.findOne(id)

    return this.prisma.priority.update({

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

    return this.prisma.priority.update({

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