import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common"

import { Reflector } from "@nestjs/core"
import { tap } from "rxjs"

import { RealtimeService } from "./realtime.service"

export const REALTIME_ENTITY_KEY = "realtime:entity"

export const RealtimeEntity = (entity: string) =>
  Reflect.metadata(
    REALTIME_ENTITY_KEY,
    entity,
  )

const METHOD_ACTION_MAP: Record<string, string> = {
  POST: "CREATED",
  PATCH: "UPDATED",
  PUT: "UPDATED",
  DELETE: "DELETED",
}

@Injectable()
export class EntityRealtimeInterceptor
  implements NestInterceptor
{
  constructor(
    private readonly reflector: Reflector,
    private readonly realtimeService: RealtimeService,
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ) {

    const entity =
      this.reflector.getAllAndOverride<string>(
        REALTIME_ENTITY_KEY,
        [
          context.getHandler(),
          context.getClass(),
        ],
      )

    if (!entity) {
      return next.handle()
    }

    const request =
      context.switchToHttp().getRequest()

    const action =
      METHOD_ACTION_MAP[request.method]

    if (!action) {
      return next.handle()
    }

    return next.handle().pipe(
      tap((result) => {

        this.realtimeService.broadcast({
          entity,
          action,
          id: result?.id,
          payload: result,
        })

      }),
    )

  }
}