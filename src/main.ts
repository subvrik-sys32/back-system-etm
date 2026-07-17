import {
  ValidationPipe,
} from "@nestjs/common"

import {
  NestFactory,
} from "@nestjs/core"

import {
  AppModule,
} from "./app.module"

async function bootstrap() {

  const app =
    await NestFactory.create(
      AppModule,
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

    // Así el navegador deja que fetch() lea este header en la
    // respuesta (necesario para descargas/exportaciones que leen
    // Content-Length del lado del cliente).
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