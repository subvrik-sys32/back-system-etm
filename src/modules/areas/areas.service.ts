import {
  Injectable,
} from "@nestjs/common"

import {
  PrismaService,
} from "@/infra/database/prisma/prisma.service"

@Injectable()
export class AreasService {

  constructor(

    private readonly prisma:
      PrismaService,

  ) {}

  // Solo lectura por ahora — las 6 áreas de Producción se
  // administran vía seed (ver src/seed/area.seed.ts). Cuando
  // Ingeniería tenga las suyas propias, este es el lugar donde
  // agregar create/update/remove (mismo patrón que ColorsService).
  findAll() {

    return this.prisma.area.findMany({

      where: {
        active: true,
      },

      orderBy: {
        createdAt: "asc",
      },

    })

  }

}