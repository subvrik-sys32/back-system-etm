import {
  ValidationPipe,
} from "@nestjs/common"

import {
  NestFactory,
} from "@nestjs/core"

import type {
  NestExpressApplication,
} from "@nestjs/platform-express"

import compression from "compression"

import {
  AppModule,
} from "./app.module"

async function bootstrap() {

  const app =
    await NestFactory.create<NestExpressApplication>(
      AppModule,
    )

  app.useBodyParser("json", { limit: "20mb" })
  app.useBodyParser("urlencoded", { limit: "20mb", extended: true })

  app.use(
    compression({
      filter: (req, res) => {
        if (res.getHeader("Content-Type")?.toString().includes("text/event-stream")) {
          return false
        }
        return compression.filter(req, res)
      },
    }),
  )

  app.enableCors({

    origin:(origin,callback)=>{

      const allowed=[
        "http://localhost:3000",
        "https://front-system-etm.vercel.app",
      ]

      if(
        !origin||
        allowed.includes(origin)||
        origin.endsWith(".vercel.app")
      ){
        return callback(null,true)
      }

      callback(
        new Error("Not allowed by CORS"),
      )

    },

    credentials:true,

    allowedHeaders:[
      "Authorization",
      "Content-Type",
    ],

    exposedHeaders:[
      "Content-Length",
    ],

    methods:[
      "GET",
      "POST",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

  })

  app.useGlobalPipes(

    new ValidationPipe({

      whitelist: true,

      transform: true,

      forbidNonWhitelisted: true,

    }),

  )

  const port =
    Number(
      process.env.PORT,
    ) || 3001

  await app.listen(
    port,
  )

  console.log(

    `🚀 Backend running on port ${port}`,

  )

}

bootstrap()