import { Module } from "@nestjs/common"
import { NotificationsController } from "./notifications.controller"
import { NotificationsService } from "./notifications.service"
import { NotificationRepository } from "./repositories/notification.repository"
import { PrismaModule } from "@/infra/database/prisma/prisma.module"

@Module({
  imports:[PrismaModule],
  controllers:[NotificationsController],
  providers:[NotificationsService,NotificationRepository],
  exports:[NotificationsService],
})
export class NotificationsModule{}