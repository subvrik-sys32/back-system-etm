import {
  ValidationPipe,
} from "@nestjs/common"

import {
  NestFactory,
} from "@nestjs/core"

import compression from "compression"

import {
  AppModule,
} from "./app.module"

async function bootstrap() {

  const app =
    await NestFactory.create(
      AppModule,
    )

  // Comprime las respuestas (gzip/brotli) — con la distancia de red
  // hasta el cliente, menos bytes viajando es menos tiempo de espera,
  // sobre todo en listas de Tareas/Proyectos con JSON que repite
  // muchos nombres de campo entre filas (comprime muy bien).
  // El filtro default de "compression" ya sabe saltear formatos
  // binarios/ya comprimidos (PDFs, imágenes) por mime-type, así que
  // las descargas del módulo de Engineering no se ven afectadas —
  // solo se comprime JSON/texto, que es donde realmente ahorra.
  app.use(
    compression(),
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