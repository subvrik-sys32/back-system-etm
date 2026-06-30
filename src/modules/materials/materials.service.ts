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

    return this.prisma.material.create({

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

    dto: UpdateMaterialDto,

  ) {

    await this.findOne(id)

    return this.prisma.material.update({

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

    return this.prisma.material.update({

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