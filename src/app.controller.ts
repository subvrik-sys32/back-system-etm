import {
  Controller,
  Get,
} from "@nestjs/common"

import {
  PrismaService,
} from "@/infra/database/prisma/prisma.service"

import {
  AppService,
} from "./app.service"

@Controller()
export class AppController {

  constructor(

    private readonly appService:
      AppService,

    private readonly prisma:
      PrismaService,

  ){}

  @Get()
  getHello(){

    return this.appService.getHello()

  }

  // ---------------------------------------
  // CONNECTION
  // ---------------------------------------

  @Get("ping")
  async ping(){

    const start=
      performance.now()

    await this.prisma.$queryRaw`SELECT 1`

    return{

      ms:Number(
        (
          performance.now()-start
        ).toFixed(1),
      ),

    }

  }

  // ---------------------------------------
  // RAW SQL
  // ---------------------------------------

  @Get("raw-projects")
  async rawProjects(){

    const start=
      performance.now()

    const result=
      await this.prisma.$queryRawUnsafe(`
        SELECT *
        FROM "Project"
        LIMIT 5
      `)

    return{

      count:
        Array.isArray(result)
          ?result.length
          :0,

      ms:Number(
        (
          performance.now()-start
        ).toFixed(1),
      ),

    }

  }

  // ---------------------------------------
  // SIMPLE FIND
  // ---------------------------------------

  @Get("projects-simple")
  async projectsSimple(){

    const start=
      performance.now()

    const result=
      await this.prisma.project.findMany({

        take:5,

      })

    return{

      count:result.length,

      ms:Number(
        (
          performance.now()-start
        ).toFixed(1),
      ),

    }

  }

  // ---------------------------------------
  // FIND + ORDER
  // ---------------------------------------

  @Get("projects-order")
  async projectsOrder(){

    const start=
      performance.now()

    const result=
      await this.prisma.project.findMany({

        take:5,

        orderBy:{
          position:"asc",
        },

      })

    return{

      count:result.length,

      ms:Number(
        (
          performance.now()-start
        ).toFixed(1),
      ),

    }

  }

  // ---------------------------------------
  // INCLUDE CLIENT
  // ---------------------------------------

  @Get("projects-client")
  async projectsClient(){

    const start=
      performance.now()

    const result=
      await this.prisma.project.findMany({

        take:5,

        include:{
          client:true,
        },

      })

    return{

      count:result.length,

      ms:Number(
        (
          performance.now()-start
        ).toFixed(1),
      ),

    }

  }

  // ---------------------------------------
  // INCLUDE PM
  // ---------------------------------------

  @Get("projects-pm")
  async projectsPm(){

    const start=
      performance.now()

    const result=
      await this.prisma.project.findMany({

        take:5,

        include:{

          pm:{

            select:{

              id:true,

              name:true,

              email:true,

            },

          },

        },

      })

    return{

      count:result.length,

      ms:Number(
        (
          performance.now()-start
        ).toFixed(1),
      ),

    }

  }

  // ---------------------------------------
  // FULL INCLUDE
  // ---------------------------------------

  @Get("projects-full")
  async projectsFull(){

    const start=
      performance.now()

    const result=
      await this.prisma.project.findMany({

        take:5,

        include:{

          client:true,

          stage:true,

          status:true,

          pm:{

            select:{

              id:true,

              name:true,

              email:true,

            },

          },

        },

      })

    return{

      count:result.length,

      ms:Number(
        (
          performance.now()-start
        ).toFixed(1),
      ),

    }

  }

  // ---------------------------------------
  // COUNT
  // ---------------------------------------

  @Get("projects-count")
  async projectsCount(){

    const start=
      performance.now()

    const total=
      await this.prisma.project.count()

    return{

      total,

      ms:Number(
        (
          performance.now()-start
        ).toFixed(1),
      ),

    }

  }

  // ---------------------------------------
  // TASKS
  // ---------------------------------------

  @Get("tasks-simple")
  async tasksSimple(){

    const start=
      performance.now()

    const result=
      await this.prisma.task.findMany({

        take:5,

      })

    return{

      count:result.length,

      ms:Number(
        (
          performance.now()-start
        ).toFixed(1),
      ),

    }

  }

  // ---------------------------------------
  // WORKFLOW
  // ---------------------------------------

  @Get("workflow-simple")
  async workflowSimple(){

    const start=
      performance.now()

    const result=
      await this.prisma.workflowStep.findMany({

        take:5,

      })

    return{

      count:result.length,

      ms:Number(
        (
          performance.now()-start
        ).toFixed(1),
      ),

    }

  }

}