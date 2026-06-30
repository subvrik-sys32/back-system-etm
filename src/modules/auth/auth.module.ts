import {
  Module,
} from "@nestjs/common"

import {
  JwtModule,
} from "@nestjs/jwt"

import {
  PrismaModule,
} from "@/infra/database/prisma/prisma.module"

import {
  AuthController,
} from "./auth.controller"

import {
  AuthService,
} from "./auth.service"

import {
  PassportModule,
} from "@nestjs/passport"

import {
  JwtStrategy,
} from "./strategies/jwt.strategy"

@Module({

  imports:[

    PrismaModule,

    PassportModule,

    JwtModule.register({

      secret:
        process.env.JWT_SECRET,

      signOptions:{

        expiresIn:"12h",

      },

    }),

  ],

  controllers:[

    AuthController,

  ],

  providers:[

    AuthService,

    JwtStrategy,

  ],

  exports:[

    AuthService,

  ],

})
export class AuthModule{}