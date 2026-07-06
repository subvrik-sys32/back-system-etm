import {
  Controller,
  Get,
  Patch,
  Param,
  UseGuards,
} from "@nestjs/common"

import { NotificationsService } from "./notifications.service"
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard"
import { CurrentUser } from "@/shared/decorators/current-user.decorator"
import type { CurrentUserType } from "@/shared/types/current-user.types"

@UseGuards(JwtAuthGuard)
@Controller("notifications")
export class NotificationsController{

  constructor(
    private readonly notificationsService:NotificationsService,
  ){}

  @Get()
  findAll(@CurrentUser() user:CurrentUserType){
    return this.notificationsService.findAllForUser(user.id)
  }

  @Get("unread-count")
  unreadCount(@CurrentUser() user:CurrentUserType){
    return this.notificationsService.getUnreadCount(user.id)
  }

  @Patch(":id/read")
  markAsRead(
    @Param("id") id:string,
    @CurrentUser() user:CurrentUserType,
  ){
    return this.notificationsService.markAsRead(id,user.id)
  }

  @Patch("read-all")
  markAllAsRead(@CurrentUser() user:CurrentUserType){
    return this.notificationsService.markAllAsRead(user.id)
  }

}