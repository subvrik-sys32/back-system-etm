import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common"

import {
  UsersService,
} from "./users.service"

import {
  CreateUserDto,
} from "./dto/create-user.dto"

import {
  UpdateUserDto,
} from "./dto/update-user.dto"

import {
  JwtAuthGuard,
} from "@/modules/auth/guards/jwt-auth.guard"

import {
  PermissionsGuard,
} from "@/shared/guards/permissions.guard"

import {
  Permissions,
} from "@/shared/decorators/permissions.decorator"

import {
  CurrentUser,
} from "@/shared/decorators/current-user.decorator"

import type {
  CurrentUserType,
} from "@/shared/types/current-user.types"

import {
  PermissionCode,
} from "@/core/enums/permission-code.enum"

import { UpdateProfileDto } from "./dto/update-profile.dto"

import { UpdateAvatarDto } from "./dto/update-avatar.dto"

@Controller("users")
export class UsersController {

  constructor(
    private readonly usersService: UsersService,
  ) {}

  @UseGuards(
    JwtAuthGuard,
  )
  @Get("directory")
  directory() {

    return this.usersService.directory()

  }

  @UseGuards(
    JwtAuthGuard,
  )
  @Patch("profile")
  updateProfile(
    @Body()
    dto: UpdateProfileDto,

    @CurrentUser()
    user: CurrentUserType,
  ) {

    return this.usersService.updateProfile(
      user.id,
      dto,
      user.id,
    )

  }

  @UseGuards(
    JwtAuthGuard,
  )
  @Post("avatar")
  updateAvatar(
    @Body()
    dto: UpdateAvatarDto,

    @CurrentUser()
    user: CurrentUserType,
  ) {

    return this.usersService.updateAvatar(
      user.id,
      dto,
      user.id,
    )

  }

  @UseGuards(
    JwtAuthGuard,
  )
  @Delete("avatar")
  removeAvatar(
    @CurrentUser()
    user: CurrentUserType,
  ) {

    return this.usersService.removeAvatar(
      user.id,
      user.id,
    )

  }

  @UseGuards(
    JwtAuthGuard,
    PermissionsGuard,
  )
  @Permissions(
    PermissionCode.USER_READ,
  )
  @Get()
  findAll() {

    return this.usersService.findAll()

  }

  @UseGuards(
    JwtAuthGuard,
    PermissionsGuard,
  )
  @Permissions(
    PermissionCode.USER_READ,
  )
  @Get(":id")
  findOne(
    @Param("id")
    id: string,
  ) {

    return this.usersService.findOne(
      id,
    )

  }

  @UseGuards(
    JwtAuthGuard,
    PermissionsGuard,
  )
  @Permissions(
    PermissionCode.USER_CREATE,
  )
  @Post()
  create(
    @Body()
    dto: CreateUserDto,

    @CurrentUser()
    user: CurrentUserType,
  ) {

    return this.usersService.create(
      dto,
      user.id,
    )

  }

  @UseGuards(
    JwtAuthGuard,
    PermissionsGuard,
  )
  @Permissions(
    PermissionCode.USER_UPDATE,
  )
  @Patch(":id")
  update(
    @Param("id")
    id: string,

    @Body()
    dto: UpdateUserDto,

    @CurrentUser()
    user: CurrentUserType,
  ) {

    return this.usersService.update(
      id,
      dto,
      user.id,
    )

  }

  @UseGuards(
    JwtAuthGuard,
    PermissionsGuard,
  )
  @Permissions(
    PermissionCode.USER_DELETE,
  )
  @Delete(":id")
  remove(
    @Param("id")
    id: string,

    @CurrentUser()
    user: CurrentUserType,
  ) {

    return this.usersService.remove(
      id,
      user.id,
    )

  }

}