import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { readCadFile, isSupportedCadFile } from '../cad/rich/cad-reader'
import { parsePdf, isPdfFile } from '../cad/rich/pdf-parser'
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

function assertValid(cad: CadData, label: string): CadData {
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

  private toResponse(fileName: string, cad: CadData): CadParseResponse {
    const base = fileName.replace(/\.[^.]+$/, '') || 'piece'
    const piece = cadDataToNestingPiece(base, cad)
    this.logger.log(
      `CAD rich ${fileName}: entities=${cad.entities.length} ` +
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

  parseFile(fileName: string, content: string): CadParseResponse {
    if (!isSupportedCadFile(fileName)) {
      throw new BadRequestException(
        `Formato no soportado: ${fileName}. Use .dxf, .geo o .pdf`,
      )
    }
    return this.toResponse(fileName, assertValid(readCadFile(fileName, content), fileName))
  }

  async parseUpload(fileName: string, buffer: Buffer): Promise<CadParseResponse> {
    const lower = fileName.toLowerCase()
    if (isPdfFile(fileName) || lower.endsWith('.pdf')) {
      const ab = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      ) as ArrayBuffer
      const cad = assertValid(await parsePdf(fileName, ab), fileName)
      return this.toResponse(fileName, cad)
    }
    return this.parseFile(fileName, buffer.toString('utf-8'))
  }

  parseDxfBuffer(buffer: Buffer, fileName = 'upload.dxf'): CadParseResponse {
    return this.parseFile(fileName, buffer.toString('utf-8'))
  }
}
