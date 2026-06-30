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
    origin: (origin, callback) => {

      const allowed = [
        "http://localhost:3000",
        "https://front-system-etm.vercel.app",
      ]

      if (
        !origin ||
        allowed.includes(origin) ||
        origin.endsWith(".vercel.app")
      ) {
        return callback(null, true)
      }

      callback(new Error("Not allowed by CORS"))

    },
    credentials: true,
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