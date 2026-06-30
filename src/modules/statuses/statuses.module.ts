import {
  Module,
} from "@nestjs/common"

import {
  PrismaModule,
} from "@/infra/database/prisma/prisma.module"

import {
  StatusesController,
} from "./statuses.controller"

import {
  StatusesService,
} from "./statuses.service"

@Module({

  imports:[

    PrismaModule,

  ],

  controllers:[

    StatusesController,

  ],

  providers:[

    StatusesService,

  ],

  exports:[

    StatusesService,

  ],

})
export class StatusesModule {}