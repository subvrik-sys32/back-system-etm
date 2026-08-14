import { point } from '../geometry/point'
import { line } from '../geometry/line'
import { circle } from '../geometry/circle'
import {
  createGeometryModel,
  type GeometryModel,
} from '../model/geometry-model'
import type { GeometryEntity } from '../model/geometry-model'

export type PlateHolesInput = {
  /** Diámetro del agujero (mm). */
  diameter: number
  /**
   * Distancia del centro del agujero al borde más cercano
   * (mismo offset en X e Y → patrón rectangular de 4 esquinas).
   */
  offset: number
}

export type PlateGeneratorInput = {
  width: number
  height: number
  holes?: PlateHolesInput
}

/**
 * Genera una placa rectangular + 4 agujeros en las esquinas (si holes).
 *
 * Origen: esquina inferior izquierda (0,0).
 * Ejes: X → derecha, Y → arriba (convención CAD; el front puede
 * invertir Y al dibujar si el canvas es top-left).
 *
 * No conoce DXF, SVG ni nesting.
 */
export function generatePlate(input: PlateGeneratorInput): GeometryModel {
  const { width, height, holes } = input

  if (!(width > 0) || !(height > 0)) {
    throw new Error(
      `Plate width/height must be > 0 (got ${width} x ${height})`,
    )
  }

  const entities: GeometryEntity[] = [
    line(point(0, 0), point(width, 0)),
    line(point(width, 0), point(width, height)),
    line(point(width, height), point(0, height)),
    line(point(0, height), point(0, 0)),
  ]

  if (holes) {
    const { diameter, offset } = holes
    if (!(diameter > 0)) {
      throw new Error(`Hole diameter must be > 0 (got ${diameter})`)
    }
    if (!(offset >= 0)) {
      throw new Error(`Hole offset must be >= 0 (got ${offset})`)
    }
    const r = diameter / 2
    if (offset - r < 0 || offset + r > width || offset + r > height) {
      throw new Error(
        `Holes do not fit: diameter=${diameter}, offset=${offset}, plate=${width}x${height}`,
      )
    }
    const centers = [
      point(offset, offset),
      point(width - offset, offset),
      point(width - offset, height - offset),
      point(offset, height - offset),
    ]
    for (const c of centers) {
      entities.push(circle(c, r))
    }
  }

  return createGeometryModel(entities, 'mm')
}

/** Caso de prueba canónico del plan V1. */
export const DEFAULT_PLATE_DEMO: PlateGeneratorInput = {
  width: 400,
  height: 300,
  holes: { diameter: 20, offset: 50 },
}
