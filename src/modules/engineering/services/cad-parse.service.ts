import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { readCadFile, isSupportedCadFile } from '../cad/rich/cad-reader'
import { parseDxf } from '../cad/rich/dxf-parser'
import type { NestingPiece } from '../nesting/engine/types'
import type { CadData } from '../cad/rich/types'

export type CadParseResponse = {
  pieces: NestingPiece[]
  pieceCount: number
  width?: number
  height?: number
  valid: boolean
  /** Mismo dato que pieces[0] — preview y nesting comparten fuente. */
  drawing?: NestingPiece
}

function cadDataToNestingPiece(id: string, cad: CadData): NestingPiece {
  return {
    id,
    outline: cad.outline,
    subEntities: cad.entities.map((e) => ({
      outline: e.outline,
      color: e.color != null ? String(e.color) : undefined,
      layer: e.layer,
    })),
    quantity: 1,
  }
}

/**
 * Invierte Y para alinear el espacio CAD (Y↑) con el canvas/nesting (Y↓).
 * Tras normalizar minY≈0, equivale a y' = maxY - y.
 */
function flipYPiece(piece: NestingPiece): NestingPiece {
  // DXF exportado por nesting (MARCO_CHAPA) ya está en Y-down del canvas.
  // No volver a voltear: eso invierte filas del mosaico y de planchas.
  const fromNesting = (piece.subEntities ?? []).some((s) =>
    (s.layer ?? "").toUpperCase().includes("MARCO_CHAPA"),
  )
  if (fromNesting) return piece

  let minY = Infinity
  let maxY = -Infinity
  const eat = (pts: { y: number }[]) => {
    for (const p of pts) {
      if (p.y < minY) minY = p.y
      if (p.y > maxY) maxY = p.y
    }
  }
  eat(piece.outline.points)
  for (const sub of piece.subEntities ?? []) eat(sub.outline.points)
  if (!Number.isFinite(minY)) return piece
  const fy = (p: { x: number; y: number }) => ({
    x: p.x,
    y: maxY - p.y + minY,
  })

  return {
    ...piece,
    outline: { points: piece.outline.points.map(fy) },
    subEntities: (piece.subEntities ?? []).map((s) => ({
      ...s,
      outline: { points: s.outline.points.map(fy) },
    })),
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
    const drawing = pieces[0]
    return {
      pieces,
      pieceCount: pieces.reduce((n, p) => n + (p.quantity ?? 1), 0),
      width,
      height,
      valid: true,
      drawing,
    }
  }

  /** Un solo camino: parser rich + flipY. */
  private parseDxfRich(fileName: string, content: string): CadParseResponse {
    const cad = assertCad(parseDxf(content), fileName)
    const base = fileName.replace(/\.[^.]+$/, '') || 'piece'
    const piece = flipYPiece(cadDataToNestingPiece(base, cad))

    this.logger.log(
      `CAD DXF ${fileName}: rich entities=${cad.entities.length} (${cad.width}x${cad.height})`,
    )

    return this.wrap([piece], cad.width, cad.height)
  }

  parseFile(fileName: string, content: string): CadParseResponse {
    const lower = fileName.toLowerCase()

    if (lower.endsWith('.pdf')) {
      throw new BadRequestException(
        'PDF no se parsea en servidor. El cliente debe enviar geometría ya extraída o usar import local de PDF.',
      )
    }

    if (lower.endsWith('.dxf')) {
      return this.parseDxfRich(fileName, content)
    }

    if (!isSupportedCadFile(fileName)) {
      throw new BadRequestException(
        `Formato no soportado: ${fileName}. Use .dxf o .geo`,
      )
    }

    const cad = assertCad(readCadFile(fileName, content), fileName)
    const base = fileName.replace(/\.[^.]+$/, '') || 'piece'
    const piece = flipYPiece(cadDataToNestingPiece(base, cad))
    this.logger.log(
      `CAD ${fileName}: entities=${cad.entities.length}`,
    )
    return this.wrap([piece], cad.width, cad.height)
  }

  async parseUpload(
    fileName: string,
    buffer: Buffer,
  ): Promise<CadParseResponse> {
    const lower = fileName.toLowerCase()
    if (lower.endsWith('.pdf')) {
      throw new BadRequestException(
        'PDF no se parsea en servidor. Importar PDF desde el cliente.',
      )
    }
    return this.parseFile(fileName, buffer.toString('utf-8'))
  }

  parseDxfBuffer(buffer: Buffer, fileName = 'upload.dxf'): CadParseResponse {
    return this.parseFile(fileName, buffer.toString('utf-8'))
  }
}