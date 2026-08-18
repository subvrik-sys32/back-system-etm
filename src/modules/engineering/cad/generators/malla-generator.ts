import { point } from '../geometry/point'
import { line } from '../geometry/line'
import { polyline } from '../geometry/polyline'
import {
  createGeometryModel,
  type GeometryModel,
  type GeometryEntity,
} from '../model/geometry-model'

export type MallaGeneratorInput = {
  width: number
  height: number
  /** Margen exterior al primer hueco (mm). */
  margin: number
  cols: number
  rows: number
  /**
   * Ancho de hueco. Si se omite (o fit=auto y no cabe), el motor lo calcula.
   */
  holeWidth?: number
  holeHeight?: number
  /** Separación mínima entre huecos cuando el motor dimensiona (default 2). */
  minGap?: number
  /** Gaps fijos (opcional). Si no van, se reparte el sobrante. */
  gapX?: number
  gapY?: number
  /**
   * auto (default): ajusta huecos/gaps para que siempre quepa.
   * strict: error si la grilla pedida no cabe.
   */
  fit?: 'auto' | 'strict'
  thicknessMm?: number
  material?: string
  name?: string
}

export type MallaLayout = {
  holeWidth: number
  holeHeight: number
  gapX: number
  gapY: number
  startX: number
  startY: number
  adjusted: boolean
}

/**
 * Resuelve huecos y gaps para que la grilla quepa en la placa.
 * El taller solo fija placa + filas/columnas (+ margen); el motor hace el resto.
 */
export function resolveMallaLayout(input: MallaGeneratorInput): MallaLayout {
  const { width, height, margin, cols, rows } = input
  if (!(width > 0) || !(height > 0)) {
    throw new Error(`Malla size must be > 0`)
  }
  if (!(cols >= 1) || !(rows >= 1)) {
    throw new Error(`cols/rows must be >= 1`)
  }
  if (!(margin >= 0)) throw new Error(`margin must be >= 0`)

  const innerW = width - 2 * margin
  const innerH = height - 2 * margin
  if (!(innerW > 0) || !(innerH > 0)) {
    throw new Error(`Margin leaves no usable area`)
  }

  const fit = input.fit ?? 'auto'
  const minGap = Math.max(0, input.minGap ?? 2)

  let holeWidth = input.holeWidth
  let holeHeight = input.holeHeight
  let adjusted = false

  // Sin tamaño de hueco → repartir área útil con minGap
  if (!(holeWidth != null && holeWidth > 0) || !(holeHeight != null && holeHeight > 0)) {
    holeWidth = (innerW - minGap * Math.max(0, cols - 1)) / cols
    holeHeight = (innerH - minGap * Math.max(0, rows - 1)) / rows
    adjusted = true
    if (!(holeWidth > 0) || !(holeHeight > 0)) {
      throw new Error(
        `Cannot fit ${cols}x${rows} cells in ${innerW.toFixed(1)}x${innerH.toFixed(1)} useful area`,
      )
    }
  }

  // Con tamaño pedido: comprobar / auto-escalar
  const maxW = (innerW - minGap * Math.max(0, cols - 1)) / cols
  const maxH = (innerH - minGap * Math.max(0, rows - 1)) / rows
  if (holeWidth > maxW + 1e-9 || holeHeight > maxH + 1e-9) {
    if (fit === 'strict') {
      throw new Error(
        `Grid does not fit: plate ${width}x${height}, margin ${margin}, holes ${cols}x${rows} of ${holeWidth}x${holeHeight} (max ${maxW.toFixed(1)}x${maxH.toFixed(1)})`,
      )
    }
    const sx = maxW / holeWidth
    const sy = maxH / holeHeight
    const s = Math.min(sx, sy)
    holeWidth = holeWidth * s
    holeHeight = holeHeight * s
    adjusted = true
  }

  const freeX = innerW - holeWidth * cols
  const freeY = innerH - holeHeight * rows
  let gapX =
    input.gapX != null
      ? input.gapX
      : cols > 1
        ? freeX / (cols - 1)
        : 0
  let gapY =
    input.gapY != null
      ? input.gapY
      : rows > 1
        ? freeY / (rows - 1)
        : 0

  // Gaps fijos demasiado grandes → en auto, comprimir a lo que quepa
  const needW = holeWidth * cols + gapX * Math.max(0, cols - 1)
  const needH = holeHeight * rows + gapY * Math.max(0, rows - 1)
  if (needW > innerW + 1e-6 || needH > innerH + 1e-6) {
    if (fit === 'strict') {
      throw new Error(
        `Grid with gaps does not fit (need ${needW.toFixed(2)}x${needH.toFixed(2)} inside ${innerW.toFixed(2)}x${innerH.toFixed(2)})`,
      )
    }
    gapX = cols > 1 ? Math.max(0, (innerW - holeWidth * cols) / (cols - 1)) : 0
    gapY = rows > 1 ? Math.max(0, (innerH - holeHeight * rows) / (rows - 1)) : 0
    adjusted = true
  }

  const usedW = holeWidth * cols + gapX * Math.max(0, cols - 1)
  const usedH = holeHeight * rows + gapY * Math.max(0, rows - 1)
  const startX = margin + (innerW - usedW) / 2
  const startY = margin + (innerH - usedH) / 2

  return {
    holeWidth,
    holeHeight,
    gapX,
    gapY,
    startX,
    startY,
    adjusted,
  }
}

/**
 * Placa + grilla de recortes. Por defecto fit=auto (el motor dimensiona).
 */
export function generateMalla(input: MallaGeneratorInput): GeometryModel {
  const { width, height, cols, rows } = input
  const layout = resolveMallaLayout(input)
  const { holeWidth, holeHeight, gapX, gapY, startX, startY } = layout

  const entities: GeometryEntity[] = [
    line(point(0, 0), point(width, 0), 'CUT'),
    line(point(width, 0), point(width, height), 'CUT'),
    line(point(width, height), point(0, height), 'CUT'),
    line(point(0, height), point(0, 0), 'CUT'),
  ]

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = startX + c * (holeWidth + gapX)
      const y0 = startY + r * (holeHeight + gapY)
      const x1 = x0 + holeWidth
      const y1 = y0 + holeHeight
      entities.push(
        polyline(
          [
            point(x0, y0),
            point(x1, y0),
            point(x1, y1),
            point(x0, y1),
            point(x0, y0),
          ],
          true,
          'HOLE',
        ),
      )
    }
  }

  return createGeometryModel(entities, 'mm')
}

export const DEFAULT_MALLA_DEMO: MallaGeneratorInput = {
  width: 320,
  height: 220,
  margin: 12,
  cols: 8,
  rows: 6,
  // sin holeWidth/Height → el motor reparte
  minGap: 2,
  fit: 'auto',
  thicknessMm: 1.5,
  material: 'AlMg3',
  name: 'malla-demo',
}
