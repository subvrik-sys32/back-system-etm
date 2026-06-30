import {
  Module,
} from "@nestjs/common"

import {
  PrismaModule,
} from "@/infra/database/prisma/prisma.module"

import {
  ThicknessesController,
} from "./thicknesses.controller"

import {
  ThicknessesService,
} from "./thicknesses.service"

@Module({

  imports:[

    PrismaModule,

  ],

  controllers:[

    ThicknessesController,

  ],

  providers:[

    ThicknessesService,

  ],

  exports:[

    ThicknessesService,

  ],

})
export class ThicknessesModule {}