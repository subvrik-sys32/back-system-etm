import {
  Injectable,
  Logger,
} from "@nestjs/common"

export interface QueryMetric{

  model:string

  action:string

  duration:number

}

@Injectable()
export class ProfilerService{

  private readonly logger=
    new Logger(
      "Profiler",
    )

  private readonly requests=
    new Map<string,QueryMetric[]>()

  start(
    requestId:string,
  ){

    this.requests.set(
      requestId,
      [],
    )

  }

  record(
    requestId:string,
    metric:QueryMetric,
  ){

    const metrics=
      this.requests.get(
        requestId,
      )

    if(!metrics){
      return
    }

    metrics.push(
      metric,
    )

  }

  finish(
    requestId:string,
    total:number,
  ){

    const metrics=
      this.requests.get(
        requestId,
      )

    if(!metrics){
      return
    }

    const dbTime=
      metrics.reduce(

        (
          sum,
          metric,
        )=>

          sum+
          metric.duration,

        0,

      )

    this.logger.log("")

    this.logger.log(
      "────────────────────────────────────────────",
    )

    metrics.forEach(
      metric=>{

        this.logger.log(

          `${metric.model}.${metric.action} ${metric.duration.toFixed(1)} ms`,

        )

      },
    )

    this.logger.log("")

    this.logger.log(
      `Queries: ${metrics.length}`,
    )

    this.logger.log(
      `DB: ${dbTime.toFixed(1)} ms`,
    )

    this.logger.log(
      `HTTP: ${total.toFixed(1)} ms`,
    )

    this.logger.log(
      "────────────────────────────────────────────",
    )

    this.requests.delete(
      requestId,
    )

  }

}

// prisma.profiler.ts vive afuera del contenedor de DI de Nest (es
// una extensión de Prisma, definida como const de módulo) — no
// puede simplemente @Inject() este servicio. Compartimos esta ÚNICA
// instancia para que las queries individuales que loguea Prisma se
// sumen al mismo acumulador por-request que ya arma RequestInterceptor,
// en vez de vivir como dos sistemas de profiling desconectados entre
// sí (que es como estaban: el resumen "Queries: 0 / DB: 0.0ms" por
// request siempre daba vacío porque nada llamaba a .record()).
export const profilerInstance=
  new ProfilerService()
