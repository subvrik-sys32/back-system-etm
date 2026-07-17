import {
  Logger,
} from "@nestjs/common"

import {
  Prisma,
} from "@prisma/client"

import {
  requestContext,
} from "@/infra/monitoring/request-context"

import {
  profilerInstance,
} from "@/infra/monitoring/profiler.service"

const logger=
  new Logger(
    "Prisma",
  )

export const prismaProfiler=

  Prisma.defineExtension({

    name:"erp-profiler",

    query:{

      $allOperations:async({

        model,

        operation,

        args,

        query,

      })=>{

        const start=
          performance.now()

        const result=
          await query(
            args,
          )

        const duration=
          performance.now()-start

        logger.log(

          `${model ?? "Raw"}.${operation} ${duration.toFixed(1)} ms`,

        )

        // Esto es lo que faltaba: sin esto, el resumen por-request
        // de RequestInterceptor ("Queries: N / DB: Xms") siempre
        // quedaba vacío, porque nada le avisaba de estas queries —
        // dos sistemas de profiling que nunca se hablaban entre sí.
        const ctx=
          requestContext.getStore()

        if(ctx){

          profilerInstance.record(

            ctx.id,

            {
              model:model ?? "Raw",
              action:operation,
              duration,
            },

          )

        }

        return result

      },

    },

  })
