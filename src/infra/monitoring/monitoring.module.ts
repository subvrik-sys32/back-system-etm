import {
  Global,
  Module,
} from "@nestjs/common"

import {
  APP_INTERCEPTOR,
} from "@nestjs/core"

import {
  ProfilerService,
  profilerInstance,
} from "./profiler.service"

import {
  RequestInterceptor,
} from "./request.interceptor"

@Global()
@Module({

  providers:[

    {

      provide:ProfilerService,

      // Misma instancia que prisma.profiler.ts importa directo
      // (fuera del contenedor de DI) — así las queries que loguea
      // Prisma se suman al mismo acumulador por-request que usa
      // RequestInterceptor, en vez de ser dos Maps separados que
      // nunca se enteran uno del otro.
      useValue:profilerInstance,

    },

    {

      provide:APP_INTERCEPTOR,

      useClass:RequestInterceptor,

    },

  ],

  exports:[

    ProfilerService,

  ],

})
export class MonitoringModule{}
