import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common"

import {
  Observable,
} from "rxjs"

import {
  finalize,
} from "rxjs/operators"

import {
  randomUUID,
} from "node:crypto"

import {
  requestContext,
} from "./request-context"

import {
  ProfilerService,
} from "./profiler.service"

@Injectable()
export class RequestInterceptor
  implements NestInterceptor{

  constructor(
    private readonly profiler:ProfilerService,
  ){}

  intercept(
    context:ExecutionContext,
    next:CallHandler,
  ):Observable<unknown>{

    const request=
      context
        .switchToHttp()
        .getRequest()

    const id=
      randomUUID()

    const startedAt=
      performance.now()

    this.profiler.start(id)

    return requestContext.run({

      id,

      method:request.method,

      path:request.url,

      startedAt,

    },()=>

      next.handle().pipe(

        finalize(()=>{

          this.profiler.finish(

            id,

            performance.now()-startedAt,

          )

        }),

      ),

    )

  }

}