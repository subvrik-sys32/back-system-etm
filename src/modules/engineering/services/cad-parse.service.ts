import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { readCadFile, isSupportedCadFile } from '../cad/rich/cad-reader'
import type { NestingPiece } from '../nesting/engine/types'
import type { CadData } from '../cad/rich/types'

export type CadParseResponse = {
  pieces: NestingPiece[]
  pieceCount: number
  width?: number
  height?: number
  valid: boolean
}

function cadDataToNestingPiece(id: string, cad: CadData): NestingPiece {
  return {
    id,
    outline: cad.outline,
    subEntities: cad.entities.map((e) => ({
      outline: e.outline,
      color: e.color,
      layer: e.layer,
    })),
    quantity: 1,
  }
}

/**
 * Parser CAD rico — mismo pipeline que el front (dxf-parser / geo-parser
 * / chain-fragments / classify-dxf-color). No usa parseDxfGeometry del reporte.
 */
@Injectable()
export class CadParseService {
  private readonly logger = new Logger(CadParseService.name)

  parseFile(fileName: string, content: string): CadParseResponse {
    if (!isSupportedCadFile(fileName)) {
      throw new BadRequestException(
        `Formato no soportado: ${fileName}. Use .dxf o .geo`,
      )
    }
    const cad = readCadFile(fileName, content)
    if (!cad.valid || cad.outline.points.length === 0) {
      throw new BadRequestException(
        'El archivo no contiene geometría válida de corte',
      )
    }
    const piece = cadDataToNestingPiece(
      fileName.replace(/\.[^.]+$/, '') || 'piece',
      cad,
    )
    this.logger.log(
      `CAD rich parse ${fileName}: entities=${cad.entities.length} ` +
        `${cad.width.toFixed(1)}x${cad.height.toFixed(1)}`,
    )
    return {
      pieces: [piece],
      pieceCount: 1,
      width: cad.width,
      height: cad.height,
      valid: true,
    }
  }

  parseDxfBuffer(buffer: Buffer, fileName = 'upload.dxf'): CadParseResponse {
    return this.parseFile(fileName, buffer.toString('utf-8'))
  }
}
