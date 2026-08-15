import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import DxfParser from 'dxf-parser'
import { readCadFile, isSupportedCadFile } from '../cad/rich/cad-reader'
import { parsePdf, isPdfFile } from '../cad/rich/pdf-parser'
import { parseDxfGeometry } from '../pdf/dxf-geometry-parser'
import { dxfPiecesToNestingPieces } from './dxf-to-nesting-pieces'
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

function assertCad(cad: CadData, label: string): CadData {
  if (!cad.valid || cad.outline.points.length === 0) {
    throw new BadRequestException(
      `${label}: no contiene geometría válida de corte`,
    )
  }
  return cad
}

@Injectable()
export class CadParseService {
  private readonly logger = new Logger(CadParseService.name)

  private wrap(
    pieces: NestingPiece[],
    width?: number,
    height?: number,
  ): CadParseResponse {
    if (!pieces.length) {
      throw new BadRequestException('No se extrajeron piezas del archivo')
    }
    return {
      pieces,
      pieceCount: pieces.reduce((n, p) => n + (p.quantity ?? 1), 0),
      width,
      height,
      valid: true,
    }
  }

  /** DXF: multi-pieza (connectivity + holes) vía geometry-parser. */
  private parseDxfMulti(fileName: string, content: string): CadParseResponse {
    let dxf: any
    try {
      dxf = new DxfParser().parseSync(content)
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
    this.logger.log(
      `CAD multi DXF ${fileName}: ${pieces.length} piezas ` +
        `(layout ${geometry.layout?.width?.toFixed?.(1) ?? '?'}x` +
        `${geometry.layout?.height?.toFixed?.(1) ?? '?'})`,
    )
    return this.wrap(
      pieces,
      geometry.layout?.width,
      geometry.layout?.height,
    )
  }

  parseFile(fileName: string, content: string): CadParseResponse {
    const lower = fileName.toLowerCase()
    if (lower.endsWith('.dxf')) {
      return this.parseDxfMulti(fileName, content)
    }
    if (!isSupportedCadFile(fileName)) {
      throw new BadRequestException(
        `Formato no soportado: ${fileName}. Use .dxf, .geo o .pdf`,
      )
    }
    const cad = assertCad(readCadFile(fileName, content), fileName)
    const base = fileName.replace(/\.[^.]+$/, '') || 'piece'
    this.logger.log(
      `CAD rich ${fileName}: entities=${cad.entities.length} ` +
        `${cad.width.toFixed(1)}x${cad.height.toFixed(1)}`,
    )
    return this.wrap([cadDataToNestingPiece(base, cad)], cad.width, cad.height)
  }

  async parseUpload(
    fileName: string,
    buffer: Buffer,
  ): Promise<CadParseResponse> {
    const lower = fileName.toLowerCase()
    if (isPdfFile(fileName) || lower.endsWith('.pdf')) {
      const ab = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      ) as ArrayBuffer
      const cad = assertCad(await parsePdf(fileName, ab), fileName)
      const base = fileName.replace(/\.[^.]+$/, '') || 'piece'
      this.logger.log(
        `CAD PDF ${fileName}: entities=${cad.entities.length}`,
      )
      return this.wrap(
        [cadDataToNestingPiece(base, cad)],
        cad.width,
        cad.height,
      )
    }
    return this.parseFile(fileName, buffer.toString('utf-8'))
  }

  parseDxfBuffer(buffer: Buffer, fileName = 'upload.dxf'): CadParseResponse {
    return this.parseFile(fileName, buffer.toString('utf-8'))
  }
}
