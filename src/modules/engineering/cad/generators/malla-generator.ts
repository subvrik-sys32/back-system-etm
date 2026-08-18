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
  /** Ancho de cada hueco rectangular. */
  holeWidth: number
  /** Alto de cada hueco rectangular. */
  holeHeight: number
  /** Separación libre entre huecos en X (si se omite, se reparte). */
  gapX?: number
  gapY?: number
  thicknessMm?: number
  material?: string
  name?: string
}

/**
 * Placa rectangular + grilla de recortes rectangulares (estilo BandejaPC).
 */
export function generateMalla(input: MallaGeneratorInput): GeometryModel {
  const { width, height, margin, cols, rows, holeWidth, holeHeight } = input
  if (!(width > 0) || !(height > 0)) {
    throw new Error(`Malla size must be > 0`)
  }
  if (!(cols >= 1) || !(rows >= 1)) {
    throw new Error(`cols/rows must be >= 1`)
  }
  if (!(holeWidth > 0) || !(holeHeight > 0)) {
    throw new Error(`hole size must be > 0`)
  }
  if (!(margin >= 0)) throw new Error(`margin must be >= 0`)

  const innerW = width - 2 * margin
  const innerH = height - 2 * margin
  if (innerW < holeWidth * cols || innerH < holeHeight * rows) {
    throw new Error(
      `Grid does not fit: plate ${width}x${height}, margin ${margin}, holes ${cols}x${rows} of ${holeWidth}x${holeHeight}`,
    )
  }

  const freeX = innerW - holeWidth * cols
  const freeY = innerH - holeHeight * rows
  const gapX =
    input.gapX != null
      ? input.gapX
      : cols > 1
        ? freeX / (cols - 1)
        : 0
  const gapY =
    input.gapY != null
      ? input.gapY
      : rows > 1
        ? freeY / (rows - 1)
        : 0

  // Validate with explicit gaps
  const needW = holeWidth * cols + gapX * Math.max(0, cols - 1)
  const needH = holeHeight * rows + gapY * Math.max(0, rows - 1)
  if (needW > innerW + 1e-6 || needH > innerH + 1e-6) {
    throw new Error(
      `Grid with gaps does not fit in margins (need ${needW.toFixed(2)}x${needH.toFixed(2)} inside ${innerW.toFixed(2)}x${innerH.toFixed(2)})`,
    )
  }

  const entities: GeometryEntity[] = [
    line(point(0, 0), point(width, 0), 'CUT'),
    line(point(width, 0), point(width, height), 'CUT'),
    line(point(width, height), point(0, height), 'CUT'),
    line(point(0, height), point(0, 0), 'CUT'),
  ]

  // Center grid in remaining space
  const startX = margin + (innerW - needW) / 2
  const startY = margin + (innerH - needH) / 2

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
  holeWidth: 28,
  holeHeight: 22,
  thicknessMm: 1.5,
  material: 'AlMg3',
  name: 'malla-demo',
}
