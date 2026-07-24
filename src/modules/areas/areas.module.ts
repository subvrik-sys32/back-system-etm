import {
  Module,
} from "@nestjs/common"

import {
  PrismaModule,
} from "@/infra/database/prisma/prisma.module"

import {
  AreasController,
} from "./areas.controller"

import {
  AreasService,
} from "./areas.service"

@Module({

  imports: [

    PrismaModule,

  ],

  controllers: [

    AreasController,

  ],

  providers: [

    AreasService,

  ],

  exports: [

    AreasService,

  ],

})
export class AreasModule {}