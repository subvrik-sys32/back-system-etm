import { Module } from "@nestjs/common"

import { EngineeringTasksController } from "./engineering-tasks.controller"
import { EngineeringTasksService } from "./engineering-tasks.service"
import { PrismaModule } from "@/infra/database/prisma/prisma.module"

@Module({
  imports: [PrismaModule],
  controllers: [EngineeringTasksController],
  providers: [EngineeringTasksService],
  exports: [EngineeringTasksService],
})
export class EngineeringTasksModule {}
