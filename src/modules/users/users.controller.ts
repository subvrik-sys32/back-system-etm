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
  PermissionCode,
} from "@/core/enums/permission-code.enum"

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
  ) {

    return this.usersService.create(
      dto,
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
  ) {

    return this.usersService.update(
      id,
      dto,
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
  ) {

    return this.usersService.remove(
      id,
    )

  }

}