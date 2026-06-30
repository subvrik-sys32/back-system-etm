import {
  Logger,
} from "@nestjs/common"

import {
  Prisma,
} from "@prisma/client"

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

        return result

      },

    },

  })