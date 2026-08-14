import {
  Body,
  Controller,
  Header,
  Post,
  Query,
  StreamableFile,
} from '@nestjs/common'
import {
  CadPlateService,
  type CreatePlateDto,
} from '../services/cad-plate.service'

/**
 * API del generador de placa paramétrica.
 *
 * POST /engineering/cad/plate
 *   body: { width, height, holes?: { diameter, offset } }
 *   ?format=json (default) → GeometryModel
 *   ?format=dxf            → archivo .dxf (application/dxf)
 */
@Controller('engineering/cad')
export class CadPlateController {
  constructor(private readonly plates: CadPlateService) {}

  @Post('plate')
  generate(
    @Body() body: CreatePlateDto,
    @Query('format') format?: string,
  ):
    | ReturnType<CadPlateService['buildModel']>
    | StreamableFile {
    const fmt = (format ?? 'json').toLowerCase()

    if (fmt === 'dxf') {
      const { buffer, model } = this.plates.buildDxf(body)
      const name = `plate-${model.bounds.maxX - model.bounds.minX}x${model.bounds.maxY - model.bounds.minY}.dxf`
      return new StreamableFile(buffer, {
        type: 'application/dxf',
        disposition: `attachment; filename="${name}"`,
      })
    }

    return this.plates.buildModel(body)
  }
}
