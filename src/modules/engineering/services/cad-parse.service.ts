import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import DxfParser from 'dxf-parser'
import { parseDxfGeometry } from '../pdf/dxf-geometry-parser'
import { dxfPiecesToNestingPieces } from './dxf-to-nesting-pieces'
import type { NestingPiece } from '../nesting/engine/types'

export type CadParseResponse = {
  pieces: NestingPiece[]
  pieceCount: number
  layout?: { width: number; height: number }
}

@Injectable()
export class CadParseService {
  private readonly logger = new Logger(CadParseService.name)

  parseDxfBuffer(buffer: Buffer): CadParseResponse {
    let dxf: any
    try {
      const parser = new DxfParser()
      dxf = parser.parseSync(buffer.toString('utf-8'))
    } catch (err) {
      throw new BadRequestException(
        `DXF inválido: ${err instanceof Error ? err.message : 'parse error'}`,
      )
    }
    const entities: any[] = dxf?.entities ?? []
    if (!entities.length) {
      throw new BadRequestException('El DXF no contiene entidades')
    }
    const geometry = parseDxfGeometry(entities)
    const pieces = dxfPiecesToNestingPieces(geometry.pieces)
    this.logger.log(`CAD parse: ${pieces.length} piezas`)
    return {
      pieces,
      pieceCount: pieces.reduce((n, p) => n + (p.quantity ?? 1), 0),
      layout: geometry.layout
        ? { width: geometry.layout.width, height: geometry.layout.height }
        : undefined,
    }
  }
}
