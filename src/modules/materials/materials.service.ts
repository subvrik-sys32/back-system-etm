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
  CreateMaterialDto,
} from "./dto/create-material.dto"

import {
  UpdateMaterialDto,
} from "./dto/update-material.dto"

@Injectable()
export class MaterialsService {

  constructor(

    private readonly prisma:
      PrismaService,

    private readonly codeGenerator:
      CodeGeneratorService,

    private readonly realtime:
      RealtimeService,

  ) {}

  findAll() {

    return this.prisma.material.findMany({

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

    const material =
      await this.prisma.material.findFirst({

        where: {

          id,

          deletedAt: null,

        },

      })

    if (!material) {

      throw new NotFoundException(
        "Material not found",
      )

    }

    return material

  }

  async create(
    dto: CreateMaterialDto,
    userId: string,
  ) {

    const code =
      await this.codeGenerator.generate(

        () =>
          this.prisma.material.findMany({

            select: {

              code: true,

            },

          }),

        "MAT",

      )

    const material =
      await this.prisma.material.create({

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
      entity: "MATERIAL",
      action: "CREATED",
      id: material.id,
      payload: material,
      excludeUserId: userId,
    })

    return material

  }

  async update(

    id: string,

    dto: UpdateMaterialDto,

    userId: string,

  ) {

    await this.findOne(id)

    const material =
      await this.prisma.material.update({

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
      entity: "MATERIAL",
      action: "UPDATED",
      id: material.id,
      payload: material,
      excludeUserId: userId,
    })

    return material

  }

  async remove(
    id: string,
    userId: string,
  ) {

    await this.findOne(id)

    const material =
      await this.prisma.material.update({

        where: {
          id,
        },

        data: {

          deletedAt:
            new Date(),

        },

      })

    this.realtime.publish({
      entity: "MATERIAL",
      action: "DELETED",
      id,
      excludeUserId: userId,
    })

    return material

  }

}