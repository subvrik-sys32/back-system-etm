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
  CreateClientDto,
} from "./dto/create-client.dto"

import {
  UpdateClientDto,
} from "./dto/update-client.dto"

@Injectable()
export class ClientsService {

  constructor(

    private readonly prisma:
      PrismaService,

    private readonly codeGenerator:
      CodeGeneratorService,

  ) {}

  findAll() {

    return this.prisma.client.findMany({

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

    const client =
      await this.prisma.client.findFirst({

        where: {

          id,

          deletedAt: null,

        },

      })

    if (!client) {

      throw new NotFoundException(
        "Client not found",
      )

    }

    return client

  }

  async create(
    dto: CreateClientDto,
  ) {

    const code =
      await this.codeGenerator.generate(

        () =>
          this.prisma.client.findMany({

            select: {

              code: true,

            },

          }),

        "CLI",

      )

    return this.prisma.client.create({

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

    dto: UpdateClientDto,

  ) {

    await this.findOne(
      id,
    )

    return this.prisma.client.update({

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

    return this.prisma.client.update({

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