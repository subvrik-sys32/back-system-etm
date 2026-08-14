import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from "@nestjs/common"

import { Reflector } from "@nestjs/core"

import { PERMISSIONS_KEY } from "@/shared/decorators/permissions.decorator"

/**
 * Única regla: el JWT debe traer TODOS los códigos requeridos.
 * Los permisos del token se recalculan en login / refresh / me
 * (issueSession) desde roles + overrides en DB.
 * Sin bypass por rol — ADMIN obtiene todos vía seed ROLE_PERMISSIONS.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name)

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const start = performance.now()

    const requiredPermissions =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ])

    if (!requiredPermissions || requiredPermissions.length === 0) {
      this.logger.debug(
        `PermissionsGuard ${(performance.now() - start).toFixed(1)} ms`,
      )
      return true
    }

    const request = context.switchToHttp().getRequest()
    const user = request.user

    if (!user) {
      throw new ForbiddenException()
    }

    const permissions: string[] = user.permissions ?? []

    const hasPermission = requiredPermissions.every(permission =>
      permissions.includes(permission),
    )

    if (!hasPermission) {
      throw new ForbiddenException("Insufficient permissions")
    }

    this.logger.debug(
      `PermissionsGuard ${(performance.now() - start).toFixed(1)} ms`,
    )
    return true
  }
}
