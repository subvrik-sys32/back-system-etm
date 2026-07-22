import { Injectable } from "@nestjs/common"
import { PassportStrategy } from "@nestjs/passport"
import { ExtractJwt, Strategy } from "passport-jwt"
import { JobLevel } from "@prisma/client"

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const secret = process.env.JWT_SECRET

    if (!secret) {
      throw new Error("JWT_SECRET is not defined")
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    })
  }

  async validate(payload: {
    sub: string
    email: string
    role: string
    level: JobLevel
    permissions: string[]
  }) {
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      level: payload.level,
      permissions: payload.permissions,
    }
  }
}