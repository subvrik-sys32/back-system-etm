import {
  Module,
} from "@nestjs/common"

import {
  PrismaModule,
} from "@/infra/database/prisma/prisma.module"

import {
  StagesController,
} from "./stages.controller"

import {
  StagesService,
} from "./stages.service"

@Module({

  imports:[

    PrismaModule,

  ],

  controllers:[

    StagesController,

  ],

  providers:[

    StagesService,

  ],

  exports:[

    StagesService,

  ],

})
export class StagesModule {}