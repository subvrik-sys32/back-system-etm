import type { Point2D } from './point'

export type Line2D = {
  type: 'LINE'
  start: Point2D
  end: Point2D
  /** CUT | BEND | HOLE — capa DXF; omit = "0" */
  layer?: string
}

export function line(
  start: Point2D,
  end: Point2D,
  layer?: string,
): Line2D {
  return layer
    ? { type: 'LINE', start, end, layer }
    : { type: 'LINE', start, end }
}
