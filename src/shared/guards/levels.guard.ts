import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from "@nestjs/common"

import { Reflector } from "@nestjs/core"
import { JobLevel } from "@prisma/client"
import { LEVELS_KEY } from "@/shared/decorators/levels.decorator"

@Injectable()
export class LevelsGuard implements CanActivate {

  private readonly logger = new Logger(LevelsGuard.name)

  constructor(
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {

    const start = performance.now()

    const requiredLevels =
      this.reflector.getAllAndOverride<JobLevel[]>(
        LEVELS_KEY,
        [
          context.getHandler(),
          context.getClass(),
        ],
      )

    if (!requiredLevels || requiredLevels.length === 0) {
      this.logger.debug(
        `LevelsGuard ${(performance.now() - start).toFixed(1)} ms`,
      )
      return true
    }

    const request = context.switchToHttp().getRequest()
    const user = request.user

    if (!user) {
      throw new ForbiddenException()
    }

    // Comprueba si el nivel del usuario está en la lista de niveles permitidos
    const hasLevel = requiredLevels.includes(user.level)

    if (!hasLevel) {
      throw new ForbiddenException(
        "Insufficient job level",
      )
    }

    this.logger.debug(
      `LevelsGuard ${(performance.now() - start).toFixed(1)} ms`,
    )

    return true

  }

}