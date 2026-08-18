import {
  Body,
  Controller,
  Post,
  Query,
  StreamableFile,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common'
import { CadPieceService, type CreateTiraDto } from '../services/cad-piece.service'
import type { GeometryModel } from '../cad/model/geometry-model'
import type { NestingPiece } from '../nesting/engine/types'

/**
 * POST /engineering/cad/piece
 * Body: TiraSpec (template implícito tira en V1)
 * ?format=json | dxf | piece
 */
@Controller('engineering/cad/piece')
export class CadPieceController {
  constructor(private readonly cadPiece: CadPieceService) {}

  @Post()
  @UsePipes(new ValidationPipe({ transform: true, whitelist: false }))
  generate(
    @Body() body: CreateTiraDto,
    @Query('format') format?: string,
  ): GeometryModel | NestingPiece | StreamableFile {
    const fmt = (format ?? 'json').toLowerCase()
    if (fmt === 'dxf') {
      const text = this.cadPiece.buildDxf(body)
      const buf = Buffer.from(text, 'utf8')
      return new StreamableFile(buf, {
        type: 'application/dxf',
        disposition: `attachment; filename="tira.dxf"`,
      })
    }
    if (fmt === 'piece') {
      return this.cadPiece.buildNestingPiece(body)
    }
    return this.cadPiece.buildModel(body)
  }
}
