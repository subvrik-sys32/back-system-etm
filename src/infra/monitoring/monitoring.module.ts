import {
  Global,
  Module,
} from "@nestjs/common"

import {
  APP_INTERCEPTOR,
} from "@nestjs/core"

import {
  ProfilerService,
} from "./profiler.service"

import {
  RequestInterceptor,
} from "./request.interceptor"

@Global()
@Module({

  providers:[

    ProfilerService,

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