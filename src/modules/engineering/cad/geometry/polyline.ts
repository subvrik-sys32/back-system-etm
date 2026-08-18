import type { Point2D } from './point'

export type Polyline2D = {
  type: 'POLYLINE'
  points: Point2D[]
  closed: boolean
  layer?: string
}

export function polyline(
  points: Point2D[],
  closed = false,
  layer?: string,
): Polyline2D {
  if (points.length < 2) {
    throw new Error('Polyline requires at least 2 points')
  }
  return layer
    ? { type: 'POLYLINE', points, closed, layer }
    : { type: 'POLYLINE', points, closed }
}
