import type { Point2D } from './point'

/**
 * Arco CCW en grados, convención DXF (desde eje X positivo).
 * startAngle / endAngle en [0, 360).
 */
export type Arc2D = {
  type: 'ARC'
  center: Point2D
  radius: number
  startAngle: number
  endAngle: number
  layer?: string
}

export function arc(
  center: Point2D,
  radius: number,
  startAngle: number,
  endAngle: number,
  layer?: string,
): Arc2D {
  if (!(radius > 0)) {
    throw new Error(`Arc radius must be > 0, got ${radius}`)
  }
  return layer
    ? { type: 'ARC', center, radius, startAngle, endAngle, layer }
    : { type: 'ARC', center, radius, startAngle, endAngle }
}
