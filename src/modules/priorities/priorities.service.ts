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

    private readonly realtime:
      RealtimeService,

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
    userId: string,
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

    const priority =
      await this.prisma.priority.create({

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
      entity: "PRIORITY",
      action: "CREATED",
      id: priority.id,
      payload: priority,
      excludeUserId: userId,
    })

    return priority

  }

  async update(

    id: string,

    dto: UpdatePriorityDto,

    userId: string,

  ) {

    await this.findOne(id)

    const priority =
      await this.prisma.priority.update({

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
      entity: "PRIORITY",
      action: "UPDATED",
      id: priority.id,
      payload: priority,
      excludeUserId: userId,
    })

    return priority

  }

  async remove(
    id: string,
    userId: string,
  ) {

    await this.findOne(id)

    const priority =
      await this.prisma.priority.update({

        where: {
          id,
        },

        data: {

          deletedAt:
            new Date(),

        },

      })

    this.realtime.publish({
      entity: "PRIORITY",
      action: "DELETED",
      id,
      excludeUserId: userId,
    })

    return priority

  }

}