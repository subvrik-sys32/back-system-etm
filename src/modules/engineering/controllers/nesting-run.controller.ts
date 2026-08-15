import {
  Body,
  Controller,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common'
import {
  NestingRunService,
  type NestRunRequest,
} from '../services/nesting-run.service'

/**
 * POST /engineering/nest
 *
 * Body grande (piezas con contornos). No usar whitelist global:
 * NestRunRequest es un type TS sin class-validator → forbidNonWhitelisted
 * vaciaría el body.
 */
@Controller('engineering')
export class NestingRunController {
  constructor(private readonly nesting: NestingRunService) {}

  @Post('nest')
  @UsePipes(
    new ValidationPipe({
      whitelist: false,
      forbidNonWhitelisted: false,
      transform: false,
    }),
  )
  run(@Body() body: NestRunRequest) {
    return this.nesting.run(body)
  }
}
