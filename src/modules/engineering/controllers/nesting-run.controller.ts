import { Body, Controller, Post } from '@nestjs/common'
import {
  NestingRunService,
  type NestRunRequest,
} from '../services/nesting-run.service'

/**
 * Ejecuta el motor de nesting en el servidor.
 *
 * POST /engineering/nest
 * body: { pieces: NestingPiece[], options: NestingOptions (sin callbacks) }
 * → { sheets, pieceCount, sheetCount }
 */
@Controller('engineering')
export class NestingRunController {
  constructor(private readonly nesting: NestingRunService) {}

  @Post('nest')
  run(@Body() body: NestRunRequest) {
    return this.nesting.run(body)
  }
}
