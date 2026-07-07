import {
  Controller,
  Delete,
  Get,
  Patch,
  Param,
  Query,
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
  findAll(
    @CurrentUser() user:CurrentUserType,
    @Query("cursor") cursor?:string,
    @Query("take") take?:string,
  ){
    return this.notificationsService.findAllForUser(
      user.id,
      cursor,
      take?Number(take):undefined,
    )
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

  @Delete(":id")
  remove(
    @Param("id") id:string,
    @CurrentUser() user:CurrentUserType,
  ){
    return this.notificationsService.remove(id,user.id)
  }

  @Delete()
  removeAll(@CurrentUser() user:CurrentUserType){
    return this.notificationsService.removeAll(user.id)
  }

}