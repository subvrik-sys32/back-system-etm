import { Module } from "@nestjs/common"
import { DetailAssetsController } from "./detail-assets.controller"
import { DetailAssetsService } from "./detail-assets.service"
import { PrismaModule } from "@/infra/database/prisma/prisma.module"

@Module({
  imports: [PrismaModule],
  controllers: [DetailAssetsController],
  providers: [DetailAssetsService],
  exports: [DetailAssetsService],
})
export class DetailAssetsModule {}
