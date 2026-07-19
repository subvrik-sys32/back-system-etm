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

  // Genérico explícito: sin esto, NestFactory.create(...) devuelve
  // INestApplication (de @nestjs/common), que NO declara
  // useBodyParser — ese método vive en NestExpressApplication (de
  // @nestjs/platform-express). En runtime el objeto siempre tuvo el
  // método (Nest usa Express por default), esto es solo para que
  // TypeScript lo reconozca.
  const app =
    await NestFactory.create<NestExpressApplication>(
      AppModule,
    )

  // Límite default de Express/Nest para bodies JSON: ~100kb. Eso
  // alcanza de sobra para cualquier payload normal de la API, pero
  // los comentarios (y los avatares) mandan la foto como base64
  // adentro del JSON — una foto de celular sin comprimir todavía
  // (varios MB) más el ~33% extra que agrega la codificación base64
  // rebota bien por encima de 100kb. Sin este límite más alto, el
  // request se rechaza con 413 "request entity too large" ANTES de
  // llegar al controller, así que la compresión con sharp en
  // uploadCommentPhoto nunca llega a ejecutarse — no importa cuánto
  // comprima el servidor después, porque el body nunca llega tan lejos.
  // 20mb da margen de sobra para una foto de cámara moderna en base64.
  app.useBodyParser("json", { limit: "20mb" })
  app.useBodyParser("urlencoded", { limit: "20mb", extended: true })

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