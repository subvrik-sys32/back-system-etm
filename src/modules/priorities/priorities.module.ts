import {
  Module,
} from "@nestjs/common"

import {
  PrismaModule,
} from "@/infra/database/prisma/prisma.module"

import {
  PrioritiesController,
} from "./priorities.controller"

import {
  PrioritiesService,
} from "./priorities.service"

@Module({

  imports:[

    PrismaModule,

  ],

  controllers:[

    PrioritiesController,

  ],

  providers:[

    PrioritiesService,

  ],

  exports:[

    PrioritiesService,

  ],

})
export class PrioritiesModule {}