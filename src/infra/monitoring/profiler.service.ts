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