import {
  Body,
  Controller,
  Post,
  Query,
  StreamableFile,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common'
import {
  CadPlateService,
  type CreatePlateDto,
} from '../services/cad-plate.service'
import type { NestingPiece } from '../nesting/engine/types'
import type { GeometryModel } from '../cad/model/geometry-model'

/**
 * POST /engineering/cad/plate
 *   ?format=json (default) → GeometryModel
 *   ?format=dxf            → .dxf
 *   ?format=piece          → NestingPiece (para /engineering/nest)
 */
@Controller('engineering/cad')
export class CadPlateController {
  constructor(private readonly plates: CadPlateService) {}

  @Post('plate')
  @UsePipes(
    new ValidationPipe({
      whitelist: false,
      forbidNonWhitelisted: false,
      transform: false,
    }),
  )
  generate(
    @Body() body: CreatePlateDto,
    @Query('format') format?: string,
  ): GeometryModel | NestingPiece | StreamableFile {
    const fmt = (format ?? 'json').toLowerCase()

    if (fmt === 'dxf') {
      const { buffer, model } = this.plates.buildDxf(body)
      const name = `plate-${model.bounds.maxX - model.bounds.minX}x${model.bounds.maxY - model.bounds.minY}.dxf`
      return new StreamableFile(buffer, {
        type: 'application/dxf',
        disposition: `attachment; filename="${name}"`,
      })
    }

    if (fmt === 'piece' || fmt === 'nesting-piece') {
      return this.plates.buildNestingPiece(body)
    }

    return this.plates.buildModel(body)
  }
}
