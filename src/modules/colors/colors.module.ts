import {
  Module,
} from "@nestjs/common"

import {
  PrismaModule,
} from "@/infra/database/prisma/prisma.module"

import {
  ColorsController,
} from "./colors.controller"

import {
  ColorsService,
} from "./colors.service"

@Module({

  imports:[

    PrismaModule,

  ],

  controllers:[

    ColorsController,

  ],

  providers:[

    ColorsService,

  ],

  exports:[

    ColorsService,

  ],

})
export class ColorsModule {}