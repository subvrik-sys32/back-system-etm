import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
} from "@nestjs/common"

import {
  LoginDto,
} from "./dto/login.dto"

import {
  LoginResponseDto,
  MeResponseDto,
} from "./dto/auth-response.dto"

import {
  AuthService,
} from "./auth.service"

import {
  JwtAuthGuard,
} from "./guards/jwt-auth.guard"

@Controller("auth")
export class AuthController{

  constructor(

    private readonly authService:AuthService,

  ){}

  @Post("login")
  login(

    @Body()
    dto:LoginDto,

  ):Promise<LoginResponseDto>{

    return this.authService.login(

      dto.email,

      dto.password,

    )

  }

  @UseGuards(
    JwtAuthGuard,
  )
  @Get("me")
  me(

    @Request()
    req:any,

  ):Promise<MeResponseDto>{

    return this.authService.me(

      req.user.id,

    )

  }

}